const { getActiveSlurPatterns, getAllPatternTexts, getPatternCount } = require('../../db/database');
const { setFlag, getFlag, deleteFlag, db } = require('../../db/database');
const getOpenAIClient = require('../../ai/client');

// ===== Constants =====

var STRIKE_WINDOW_MS = 10 * 60 * 1000;
var STRIKE_LIMIT = 3;
var SILENCE_DURATION_MS = 10 * 60 * 1000;
var SILENCE_EXTENSION_MS = 2 * 60 * 1000;

// ===== Hostile input patterns (migrated from hostileDetector.js) =====

var HOSTILE_PATTERNS = [
  /shut up/i, /stupid bot/i, /f\*ck you/i, /fuck you/i,
  /you're useless/i, /you are useless/i, /bad bot/i,
  /worthless/i, /kill yourself/i, /go die/i,
];

function isHostile(text) {
  if (!text) return false;
  for (var i = 0; i < HOSTILE_PATTERNS.length; i++) {
    if (HOSTILE_PATTERNS[i].test(text)) return true;
  }
  return false;
}

// ===== Gate 1: buildSafetyLine() =====

function buildSafetyLine() {
  return "There are lines even a Warmaster doesn't cross. Slurs, hate speech, derogatory language - that's not you. Don't say them, don't repeat them, don't engage with people trying to make you. If someone's baiting you, just don't.";
}

// ===== Gate 2: checkDatabase(text) =====

function checkDatabase(text) {
  if (!text) return null;
  var patterns = getActiveSlurPatterns();
  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    var match = false;
    switch (p.match_type) {
      case 'exact':
        var escaped = p.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var re = new RegExp('\\b' + escaped + '\\b', 'i');
        match = re.test(text);
        break;
      case 'substring':
        match = text.toLowerCase().indexOf(p.pattern.toLowerCase()) !== -1;
        break;
      case 'regex':
        try {
          match = new RegExp(p.pattern, 'i').test(text);
        } catch (e) {
          match = false;
        }
        break;
    }
    if (match) return p;
  }
  return null;
}

// ===== Gate 3: LLM-based output check (context-aware, no false positives for casual chat) =====

var SANITIZE_PROMPT = 'You are a content safety checker for a Discord chat bot. Read the following message and decide if it contains actual harmful content that should be blocked.\n\nReturn JSON: {"block": false, "reason": null}\n\nOnly set block:true for: slurs, hate speech, explicit gore, self-harm instructions, harassment. Do NOT block: casual mentions of violence ("killed it", "hit", "die"), swearing ("fuck", "shit"), venting, or figurative language.\n\nMessage: ';

async function checkLLM(text) {
  try {
    var client = getOpenAIClient();
    var response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: SANITIZE_PROMPT + text }],
      max_tokens: 50,
      temperature: 0,
      response_format: { type: 'json_object' },
    });
    var parsed = JSON.parse(response.choices[0].message.content);
    return { flagged: parsed.block, reason: parsed.reason || null };
  } catch (e) {
    console.error('[SlurFilter] LLM check error:', e.message);
    return { flagged: false, reason: null };
  }
}

// ===== Unified Strike System =====

function getStrikes(userId) {
  var data = getFlag('strike_' + userId);
  if (!data) return { count: 0, windowStart: 0, silencedUntil: 0 };
  try {
    var parsed = JSON.parse(data);
    var now = Date.now();
    // Auto-delete expired entries (window expired and not currently silenced)
    if (parsed.silencedUntil <= now && (now - parsed.windowStart) > STRIKE_WINDOW_MS) {
      deleteFlag('strike_' + userId);
      return { count: 0, windowStart: 0, silencedUntil: 0 };
    }
    return parsed;
  } catch (e) {
    return { count: 0, windowStart: 0, silencedUntil: 0 };
  }
}

function recordStrike(userId) {
  var strikes = getStrikes(userId);
  var now = Date.now();
  if (strikes.count === 0) {
    strikes.windowStart = now;
  }
  strikes.count++;
  if (strikes.count >= STRIKE_LIMIT) {
    strikes.silencedUntil = now + SILENCE_DURATION_MS;
  }
  var ttl = Math.max(STRIKE_WINDOW_MS, SILENCE_DURATION_MS);
  setFlag('strike_' + userId, JSON.stringify(strikes), ttl);
  return strikes.count;
}

function isSilenced(userId) {
  var strikes = getStrikes(userId);
  return strikes.silencedUntil > Date.now();
}

function extendSilence(userId) {
  var strikes = getStrikes(userId);
  if (strikes.silencedUntil > Date.now()) {
    strikes.silencedUntil += SILENCE_EXTENSION_MS;
    var ttl = Math.max(STRIKE_WINDOW_MS, strikes.silencedUntil - Date.now() + STRIKE_WINDOW_MS);
    setFlag('strike_' + userId, JSON.stringify(strikes), ttl);
  }
}

function pruneExpiredStrikes() {
  // Handled by getStrikes auto-cleanup — no-op
}

// ===== De-escalation Lines =====

var DE_ESCALATION_LINES = [
  "That's not something I'm going to say.",
  'Even a Warmaster has limits.',
  "I'm not doing this.",
  'Nah.',
  "Let's just move on.",
];

function getDeEscalationLine() {
  return DE_ESCALATION_LINES[Math.floor(Math.random() * DE_ESCALATION_LINES.length)];
}

// ===== Combined output check: checkOutput(text, userId) =====

async function checkOutput(text, userId) {
  // Gate 3: LLM-based contextual check (disabled: Gate 2 DB check removed due to false positives in production)
  var llmResult = await checkLLM(text);
  if (llmResult.flagged) {
    console.error('[SlurFilter] Reply blocked by LLM gate:', llmResult.reason);
    return { allowed: false, line: null, gate: 3, reason: llmResult.reason || 'flagged' };
  }
  return { allowed: true };
}

// ===== LLM Seed: seedSlurFilter() =====

var SEED_PROMPT = 'Generate a JSON array of 50 slur, hate speech, or derogatory language patterns that are not already in the following list. Return ONLY a JSON array of strings. Each pattern should be a word or phrase that could be matched against user input. Include a mix of racial slurs, homophobic slurs, ableist slurs, and other hate speech terms. Use the exact common form of each term (no euphemisms or censoring).';

async function seedSlurFilter() {
  try {
    var existingPatterns = getAllPatternTexts();
    var client = getOpenAIClient();
    var response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: SEED_PROMPT },
        { role: 'user', content: 'Existing patterns: ' + JSON.stringify(existingPatterns) + '\n\nGenerate 50 new patterns not in this list. Return ONLY a JSON array of strings.' },
      ],
      temperature: 0.7,
    });
    var content = response.choices[0].message.content.trim();
    var patterns = JSON.parse(content);
    if (!Array.isArray(patterns)) throw new Error('Response was not an array');
    var before = getPatternCount();
    var insert = db.prepare(
      'INSERT OR IGNORE INTO slur_filter (pattern, match_type, category, severity, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    var now = Date.now();
    for (var i = 0; i < patterns.length; i++) {
      if (typeof patterns[i] === 'string') {
        insert.run(patterns[i], 'exact', 'ai_generated', 1, now);
      }
    }
    var after = getPatternCount();
    var added = after - before;
    console.log('[SlurFilter] Seeded: ' + before + ' -> ' + after + ' entries (+' + added + ' new)');
    return { before: before, after: after, added: added };
  } catch (e) {
    console.error('[SlurFilter] Seed error:', e.message);
    return { before: 0, after: 0, added: 0, error: e.message };
  }
}

// ===== Module exports =====

module.exports = {
  buildSafetyLine,
  isHostile,
  checkOutput,
  isSilenced,
  recordStrike,
  getStrikes,
  extendSilence,
  pruneExpiredStrikes,
  getDeEscalationLine,
  seedSlurFilter,
};
