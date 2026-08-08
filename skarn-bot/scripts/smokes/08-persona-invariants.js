// ===== PERSONA INVARIANTS =====
// Guards the deterministic persona logic (no LLM involved). DB-backed functions
// are seeded first. All assertions are pure-string / DB-seeded — no OpenAI.
const { db, addMemoryEntry } = require('../../db/database');
const { getSocraticQuestion } = require('../../features/wisdom/socraticEngine');
const mood = require('../../features/mood/moodManager');
const { getEmotionDirective } = require('../../features/wisdom/emotionalIntelligence');
const { setUserEmotion } = require('../../db/database');   // NOT on emotionalIntelligence exports
const { getRelationshipLine } = require('../../features/relationship/relationshipTracker');
const { buildSystemPrompt } = require('../../persona/identity');

function assert(label, cond) {
  console.log(label + ':', cond);
  if (!cond) process.exitCode = 1;
}

// 1. Socratic triggers fire on advice phrasings (directive returned on match)
const socraticLine = getSocraticQuestion('i cant decide between two jobs');
assert('socratic fires on advice phrasing', !!socraticLine && socraticLine.includes('question'));

// 2. Non-advice chatter gets no socratic line (socraticEngine returns '' on no-match)
assert('socratic silent on small talk', getSocraticQuestion('what time is it') === '');

// 3. Wrath mood: seed a busy + unfamiliar guild in user_relationship
//    (evaluateMood reads: SUM(interaction_count)>100 AND AVG(familiarity)<10)
db.prepare("INSERT INTO user_relationship (user_id, guild_id, familiarity, interaction_count, last_interaction_at) VALUES (?,?,?,?,?)")
  .run('wu1', 'gWrath', 5, 60, Date.now());
db.prepare("INSERT INTO user_relationship (user_id, guild_id, familiarity, interaction_count, last_interaction_at) VALUES (?,?,?,?,?)")
  .run('wu2', 'gWrath', 3, 60, Date.now());
const wrathMood = mood.evaluateMood('gWrath');
assert('wrath mood on busy-unfamiliar server', wrathMood === 'wrath');

// 4. Emotion directives read DB; seed first, assert the real steady-angry text.
//    NOTE: the angry directive CONTAINS "Don't match the anger" — assert inclusion, not exclusion.
setUserEmotion('uAngry', 'g1', 'angry');
const angryLine = getEmotionDirective('uAngry', 'g1');
assert("anger directive steadies tone", !!angryLine && angryLine.includes("Don't match the anger"));
setUserEmotion('uSad', 'g1', 'sad');
const sadLine = getEmotionDirective('uSad', 'g1');
assert('sad directive present', !!sadLine);

// 5. Familiarity tiers produce distinct lines (getRelationshipLine(userId, guildId))
db.prepare("INSERT INTO user_relationship (user_id, guild_id, familiarity, interaction_count, last_interaction_at) VALUES (?,?,?,?,?)")
  .run('fLow', 'g1', 10, 1, Date.now());
db.prepare("INSERT INTO user_relationship (user_id, guild_id, familiarity, interaction_count, last_interaction_at) VALUES (?,?,?,?,?)")
  .run('fHigh', 'g1', 85, 200, Date.now());
const low = getRelationshipLine('fLow', 'g1');
const high = getRelationshipLine('fHigh', 'g1');
assert('familiarity tiers differ', low && high && low !== high);

// 6. No philosopher names ever in the identity prompt (wisdom layer rule)
const prompt = buildSystemPrompt({ roleLine: '', contextLine: '' });
const names = ['socrates', 'marcus aurelius', 'sun tzu', 'laozi', 'nietzsche', 'seneca', 'epictetus'];
assert('no philosopher names in prompt', !names.some((n) => prompt.toLowerCase().includes(n)));

// ===== PRIMARY-PATH PROMPT GUARDRAILS (regression for the 2026-08-08 drift) =====
// sharedPipeline.js now ALWAYS builds the prompt via buildContext + buildSystemPrompt.
// Replicate that exact construction here and assert the guardrails that the old
// thin assembler path silently dropped: SKARN_RULES, safetyLine, untrusted-data
// wrapping, and at least one wisdom-layer line.
const { buildContext } = require('../../features/promptContext');
const { roles } = require('../../persona/roles');

// Seed a fact (source='etch') so memoryLine is non-empty — the untrusted_data
// assertion must check real wrapped content, not the literal tag inside SKARN_RULES.
addMemoryEntry('uPrimary', 'gPrimary', 'etch', 'fact', 'this is a seeded fact to verify untrusted-data wrapping', 1.0, null);

// A ≥50-char message with a socratic trigger: passes the analyzer gate (Task 1)
// and promotes to full tier via getSocraticQuestion (promptContext.js:30-33).
const socraticMsg = 'i cant decide between two jobs, what would you advise?';
const ctx = buildContext('uPrimary', 'gPrimary', 'cPrimary', {
  roleNature: 'casual',
  userContent: socraticMsg,
  interactionCount: 0,
});
const primaryPrompt = buildSystemPrompt({ roleLine: roles.consult, ...ctx });

assert('primary path prompt includes SKARN_RULES', primaryPrompt.includes('Discord TOS compliance'));
assert('primary path prompt includes safetyLine', !!ctx.safetyLine && primaryPrompt.includes(ctx.safetyLine));
assert('primary path prompt wraps memory in untrusted_data', !!ctx.memoryLine && primaryPrompt.includes('<untrusted_data>\n' + ctx.memoryLine + '\n</untrusted_data>'));
assert('primary path prompt includes socratic wisdom line', !!ctx.socraticLine && primaryPrompt.includes(ctx.socraticLine));
assert('primary path prompt ends with SKARN_FOOTER', primaryPrompt.trim().endsWith('That\'s why you\'re here.'));