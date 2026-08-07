// ===== PERSONA INVARIANTS =====
// Guards the deterministic persona logic (no LLM involved). DB-backed functions
// are seeded first. All assertions are pure-string / DB-seeded — no OpenAI.
const { db } = require('../../db/database');
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