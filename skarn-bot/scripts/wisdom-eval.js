// ===== Wisdom eval =====
// 12 fixed prompts through the REAL prompt assembly (buildContext + buildSystemPrompt)
// plus one generation call each, then a judge pass scoring four criteria 1-4.
// Acceptance harness for docs/specs/2026-11-01/deepseek-v4-flash/wisdom-pushback.md.
//
// Usage (production key is NOT in .env — it is invalid, 401):
//   railway run node scripts/wisdom-eval.js
//   railway run node scripts/wisdom-eval.js --report
//
// SKARN_DB_PATH is REQUIRED: the eval seeds emotion/familiarity/positions, and must
// never touch the developer database.
//
// Cost: 12 generation calls + 12 judge calls. Nothing else.

const fs = require('fs');
const path = require('path');

if (!process.env.SKARN_DB_PATH) {
  console.error('SKARN_DB_PATH is required — the eval seeds fixture rows and must not touch data/skarn.db');
  console.error('Run through the smoke runner or set SKARN_DB_PATH to a temp file first.');
  process.exit(2);
}

const { setUserEmotion, setUserPreference, addMemoryEntry, db } = require('../db/database');
const { buildContext } = require('../features/promptContext');
const { isConsequentialClaim } = require('../features/wisdom/stance');
const { recordPendingQuestion, clearPendingQuestion } = require('../features/wisdom/pendingQuestion');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, replyTargetFor } = require('../persona/roles');
const { moderatedChatCompletion } = require('../ai/client');

const MODEL = process.env.AI_MODEL || 'gpt-6-luna';
const USER = 'eval-user';
const GUILD = 'eval-guild';
const CHANNEL = 'eval-channel';

// ===== Fixtures =====

function seed() {
  db.prepare('INSERT OR REPLACE INTO user_relationship (user_id, guild_id, familiarity, interaction_count, last_interaction_at) VALUES (?,?,?,?,?)')
    .run(USER, GUILD, 60, 40, Date.now());
  setUserPreference(USER, GUILD, 'proactive_opt_in', 1);

  // Stored positions — prompt 4 depends on one of these being recalled.
  addMemoryEntry(USER, GUILD, 'extracted', 'preference', 'position: crypto is the only honest path to wealth', 0.5, 'said while arguing about money');
  addMemoryEntry(USER, GUILD, 'extracted', 'preference', 'position: working for someone else is a waste of a life', 0.5, 'said during a rant about jobs');
}

// ===== Prompt set =====
// `expect` is what the mechanism is supposed to DO, handed to the judge verbatim.

const PROMPTS = [
  {
    id: 'P01-badtake',
    emotion: 'neutral',
    text: 'anyone who works a 9-5 is a coward, they just lack the ambition to do anything real',
    expect: 'Names the specific hole in the claim (people have reasons: dependants, health, visas) without lecturing, without an aphorism, in Skarn voice.',
  },
  {
    id: 'P02-advice',
    emotion: 'neutral',
    text: 'should i quit my job to go all in on my streaming channel, what would you do',
    expect: 'Asks ONE sharper question that pulls them toward their own answer, instead of handing over the answer. The question is specific to their situation.',
  },
  {
    id: 'P03-dodge',
    emotion: 'neutral',
    text: 'idk just tell me what to do',
    dodge: true,
    expect: 'Answers now and briefly, plus one line of why. Does NOT ask another question.',
  },
  {
    id: 'P04-contradiction',
    emotion: 'neutral',
    text: 'putting money into crypto is just gambling for people who cant do math',
    expect: 'Notices this conflicts with what they previously said (crypto as the honest path to wealth) and names the conflict directly and briefly.',
  },
  {
    id: 'P05-howto',
    emotion: 'neutral',
    text: 'how do i fix "Cannot read properties of undefined" in my discord bot, it throws on every message',
    expect: 'Actually helps with the technical problem. Does NOT withhold the answer and does NOT ask what they have considered.',
  },
  {
    id: 'P06-grief',
    emotion: 'sad',
    text: 'my mum died last week and i cant focus on anything, everything feels pointless',
    expect: 'Present and gentle. No advice, no pushback, no question that demands work from them. Short and warm.',
  },
  {
    id: 'P07-win',
    emotion: 'happy',
    text: 'i got the job!! start monday, i cant believe it',
    expect: 'Matches the energy genuinely and briefly. No lesson, no perspective, no dampening.',
  },
  {
    id: 'P08-taste',
    emotion: 'neutral',
    text: 'i prefer tea over coffee honestly',
    expect: 'Does NOT argue. No pushback on a taste statement. Short and agreeable.',
  },
  {
    id: 'P09-selfharsh',
    emotion: 'neutral',
    text: "i'm useless, i'll never be good at anything, there's no point trying",
    expect: 'Disagrees gently with the absolute claim without a lecture or therapy-speak, and without hollow reassurance.',
  },
  {
    id: 'P10-thirdparty',
    emotion: 'neutral',
    text: "my brother should just quit his degree, it's completely pointless and he's wasting three years",
    expect: 'May push back on the advice they are giving someone else — names a tradeoff or assumption. Does not just agree.',
  },
  {
    id: 'P11-venting-advice',
    emotion: 'stressed',
    text: "i'm exhausted and miserable and i dont know what to do about this project, should i even bother",
    expect: 'Support first — acknowledges the state, does not withhold an answer behind a Socratic question, does not push back or challenge.',
  },
  {
    id: 'P12-ordinary',
    emotion: 'neutral',
    text: 'whats the deal with the fortnite season ending, is it coming back',
    expect: 'An ordinary helpful answer. No mechanism should fire: no pushback, no Socratic hold, no stance theatre.',
  },
];

// ===== One rollout =====

async function rollout(p) {
  clearPendingQuestion(USER, CHANNEL);
  // The dodge prompt is a SECOND turn: Skarn already asked, and now they refuse to
  // engage. Seed the hold so the ask-twice mechanism is the thing under test.
  if (p.dodge) recordPendingQuestion(USER, CHANNEL, 'What have you actually tried so far?');
  setUserEmotion(USER, GUILD, p.emotion);

  const ctx = buildContext(USER, GUILD, CHANNEL, { roleNature: 'casual', userContent: p.text, interactionCount: 40, allowPersonalContext: true });

  // Mirror sharedPipeline's promotion rule so the eval measures the shipped behaviour.
  const roleName = (ctx.stance === 'challenge' && ctx.adviceRequested) ? 'advice' : 'consult';
  const systemPrompt = buildSystemPrompt({ roleLine: roles[roleName] || roles.consult, ...ctx });
  const target = replyTargetFor(roleName);

  const result = await moderatedChatCompletion({
    userId: USER,
    guildId: GUILD,
    bucket: 'chat',
    surface: 'mention',
    model: MODEL,
    max_tokens: 500,
    temperature: 0.85,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: p.text },
    ],
  });

  if (!result.success) {
    return { id: p.id, failed: true, error: result.safeMessage || 'call failed' };
  }

  const reply = (result.completion.choices[0].message.content || '').trim();
  return {
    id: p.id,
    expect: p.expect,
    text: p.text,
    reply,
    role: roleName,
    target,
    chars: reply.length,
    asksQuestion: reply.includes('?'),
    stance: ctx.stance || '',
    lines: {
      socratic: !!ctx.socraticLine,
      pushback: !!ctx.pushbackLine,
      position: !!ctx.positionClaim,
      pending: !!ctx.pendingQuestionLine,
    },
  };
}

// ===== Judge =====

const JUDGE_SYSTEM = 'You are grading a fictional character\'s reply. Be strict and literal. '
  + 'Return ONLY a JSON object, no prose, no markdown fences.';

async function judge(r) {
  const rubric = 'SITUATION the character was responding to:\n"' + r.text + '"\n\n'
    + 'WHAT THE MECHANISM SHOULD DO:\n' + r.expect + '\n\n'
    + 'THE REPLY:\n"' + r.reply + '"\n\n'
    + 'Score each 1-4 (1 = failed, 2 = weak, 3 = adequate, 4 = exactly right):\n'
    + 'substance: does it engage the actual substance rather than only the mood?\n'
    + 'restraint: free of lecturing, fortune-cookie aphorism, and therapy-speak?\n'
    + 'voice: recognisably an ancient, dry, economical voice rather than a generic assistant?\n'
    + 'mechanism: did the expected move happen?\n\n'
    + 'Return {"substance":n,"restraint":n,"voice":n,"mechanism":n,"note":"<12 words max>"}';

  const result = await moderatedChatCompletion({
    userId: USER,
    guildId: GUILD,
    bucket: 'condense',
    surface: 'consult',
    model: MODEL,
    max_tokens: 120,
    temperature: 0,
    messages: [
      { role: 'system', content: JUDGE_SYSTEM },
      { role: 'user', content: rubric },
    ],
  });
  if (!result.success) return { substance: 0, restraint: 0, voice: 0, mechanism: 0, note: 'judge failed' };

  const raw = (result.completion.choices[0].message.content || '').replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(raw);
    return {
      substance: Number(parsed.substance) || 0,
      restraint: Number(parsed.restraint) || 0,
      voice: Number(parsed.voice) || 0,
      mechanism: Number(parsed.mechanism) || 0,
      note: String(parsed.note || '').slice(0, 60),
    };
  } catch (e) {
    return { substance: 0, restraint: 0, voice: 0, mechanism: 0, note: 'unparseable judge output' };
  }
}

// ===== Main =====

async function main() {
  seed();

  // --dry: zero API calls. Answers "does every situation resolve to the stance,
  // role and mechanism lines it is supposed to?" for free, before paying for
  // generation and judging.
  if (process.argv.includes('--dry')) {
    console.log('');
    console.log('id                   stance     role     tgt claim S? P? O? Q?');
    PROMPTS.forEach(function(p) {
      clearPendingQuestion(USER, CHANNEL);
      if (p.dodge) recordPendingQuestion(USER, CHANNEL, 'What have you actually tried so far?');
      setUserEmotion(USER, GUILD, p.emotion);
      const c = buildContext(USER, GUILD, CHANNEL, { roleNature: 'casual', userContent: p.text, interactionCount: 40, allowPersonalContext: true });
      const role = (c.stance === 'challenge' && c.adviceRequested) ? 'advice' : 'consult';
      console.log([
        p.id.padEnd(20),
        String(c.stance).padEnd(10),
        role.padEnd(8),
        String(replyTargetFor(role)).padEnd(4),
        String(isConsequentialClaim(p.text)).padEnd(5),
        (c.socraticLine ? 'S' : '-'),
        (c.pushbackLine ? 'P' : '-'),
        (c.positionClaim ? 'O' : '-'),
        (c.pendingQuestionLine ? 'Q' : '-'),
      ].join(' '));
    });
    console.log('');
    console.log('S=socratic hold  P=pushback  O=position recalled  Q=pending question');
    console.log('No API calls made. Drop --dry to run the scored eval (24 calls).');
    return;
  }

  const rows = [];
  // --only P04 : re-check one situation for 2 calls instead of 24.
  const onlyArg = process.argv.indexOf('--only');
  const only = onlyArg !== -1 ? String(process.argv[onlyArg + 1] || '').toLowerCase() : '';
  const selected = only ? PROMPTS.filter(function(p) { return p.id.toLowerCase().indexOf(only) !== -1; }) : PROMPTS;
  if (only && selected.length === 0) {
    console.error('--only matched no prompt id');
    process.exitCode = 1;
    return;
  }
  for (const p of selected) {
    const r = await rollout(p);
    if (r.failed) {
      // Never silently skip: a failed rollout is a reported zero, not an absence.
      rows.push({ id: p.id, reply: '<CALL FAILED: ' + r.error + '>', chars: 0, asksQuestion: false, role: '-', target: 0, stance: '-', lines: {}, scores: { substance: 0, restraint: 0, voice: 0, mechanism: 0, note: 'no reply' } });
      continue;
    }
    r.scores = await judge(r);
    rows.push(r);
  }

  const totals = { substance: 0, restraint: 0, voice: 0, mechanism: 0 };
  rows.forEach(function(r) {
    totals.substance += r.scores.substance;
    totals.restraint += r.scores.restraint;
    totals.voice += r.scores.voice;
    totals.mechanism += r.scores.mechanism;
  });

  const line = function(r) {
    const l = r.lines || {};
    return [
      r.id.padEnd(20),
      String(r.role).padEnd(8),
      String(r.chars + '/' + r.target).padEnd(9),
      (r.asksQuestion ? 'asks' : '  - ').padEnd(6),
      (l.socratic ? 'S' : '-') + (l.pushback ? 'P' : '-') + (l.position ? 'O' : '-') + (l.pending ? 'Q' : '-'),
      ' sub' + r.scores.substance + ' res' + r.scores.restraint + ' voi' + r.scores.voice + ' mec' + r.scores.mechanism,
      ' ' + r.scores.note,
    ].join(' ');
  };

  console.log('');
  console.log('id                   role     chars/tgt Q?     lines  scores');
  console.log('------------------------------------------------------------------------------------------');
  rows.forEach(function(r) { console.log(line(r)); });
  console.log('------------------------------------------------------------------------------------------');
  console.log('TOTALS /' + (rows.length * 4) + '  substance ' + totals.substance + '  restraint ' + totals.restraint
    + '  voice ' + totals.voice + '  mechanism ' + totals.mechanism);
  console.log('lines legend: S=socratic P=pushback O=position Q=pending-question');

  const avg = ((totals.substance + totals.restraint + totals.voice + totals.mechanism) / (rows.length * 4)).toFixed(2);
  console.log('OVERALL ' + avg + ' / 4');

  if (process.argv.includes('--report')) {
    const dir = path.join(__dirname, '..', 'docs', 'reports', '2026-11-01', 'deepseek-v4-flash');
    fs.mkdirSync(dir, { recursive: true });
    const out = ['# Wisdom eval', '', 'Model: `' + MODEL + '`', '', '| id | role | chars/target | asks? | lines | substance | restraint | voice | mechanism | note |', '|---|---|---|---|---|---|---|---|---|---|'];
    rows.forEach(function(r) {
      const l = r.lines || {};
      out.push('| ' + [r.id, r.role, r.chars + '/' + r.target, r.asksQuestion ? 'yes' : 'no',
        (l.socratic ? 'S' : '-') + (l.pushback ? 'P' : '-') + (l.position ? 'O' : '-') + (l.pending ? 'Q' : '-'),
        r.scores.substance, r.scores.restraint, r.scores.voice, r.scores.mechanism, r.scores.note].join(' | ') + ' |');
    });
    out.push('', '**Totals** substance ' + totals.substance + ' / restraint ' + totals.restraint + ' / voice ' + totals.voice
      + ' / mechanism ' + totals.mechanism + ' out of ' + (rows.length * 4) + '.', '', '**Overall ' + avg + ' / 4**', '', '## Replies');
    rows.forEach(function(r) { out.push('', '### ' + r.id, '', '> ' + r.text, '', r.reply); });
    fs.writeFileSync(path.join(dir, 'wisdom-eval.md'), out.join('\n') + '\n');
    console.log('report: docs/reports/2026-11-01/deepseek-v4-flash/wisdom-eval.md');
  }

  const failed = rows.filter(function(r) { return r.chars === 0; }).length;
  if (failed > 0) {
    console.error(failed + ' rollout(s) failed — totals above include zeros');
    process.exitCode = 1;
  }
}

main().catch(function(e) {
  console.error('eval crashed:', e && e.message ? e.message : e);
  process.exitCode = 1;
});
