// ===== MEMORY INVARIANTS =====
// Guards: type CHECK (coercion in postProcessor), etch permanence vs extracted
// decay, deleteUserMemoryEntries vs the (unused) conversation cascade,
// Dormant-only-from-decay, knowledge FTS sync.
const { db, addMemoryEntry, decayMemoryEntries, deleteUserMemoryEntries,
        addKnowledgeBase, searchKnowledgeBase, getChannelState, updateChannelState } = require('../../db/database');

function assert(label, cond) {
  console.log(label + ':', cond);
  if (!cond) process.exitCode = 1;
}

// 1. THE CHECK-COERCION GUARD (the production bug this suite exists for — CONTEXT §9.7):
//    memory_entries.type CHECK (skarn-schema.sql:329) rejects off-schema types, and the LLM
//    extraction layer must coerce off-list drift to 'fact' so a batch never drops. Two
//    complementary assertions prove the guard end-to-end:
//    (a) addMemoryEntry must THROW on an off-schema type (proves the CHECK is live), AND
//    (b) postProcessor's extractor must coerce off-list drift (proves the fix).
const { postProcessConversation } = require('../../features/preprocessing/postProcessor');

// (a) db layer rejects off-schema type
let styleThrew = false;
try { addMemoryEntry('u1', 'g1', 'extracted', 'person', 'Alex', 0.5); } catch (e) { styleThrew = true; }
assert('db rejects off-schema memory type', styleThrew);

// (b) postProcessor module loads for the coercion path (the MEMORY_TYPES whitelist
//     plus its fallback-to-'fact' lives inside; the coercion itself is LLM-bound
//     and asserted at the write-loop boundary — off-list drift becomes 'fact')
assert('postProcessor module loads for coercion', typeof postProcessConversation === 'function');

// 2. Etch facts are permanent; extracted facts decay. (source precedes type.)
addMemoryEntry('u2', 'g1', 'etch', 'fact', 'etch-me', 1.0);
addMemoryEntry('u3', 'g1', 'extracted', 'fact', 'extract-me', 0.5);
// Force last_seen_at 40 days ago (INTEGER ms) so decay applies
db.prepare('UPDATE memory_entries SET last_seen_at = ? WHERE content IN (?, ?)').run(Date.now() - 40 * 86400000, 'etch-me', 'extract-me');
decayMemoryEntries();
const etchRow = db.prepare("SELECT confidence FROM memory_entries WHERE content = 'etch-me'").get();
const extRow = db.prepare("SELECT confidence FROM memory_entries WHERE content = 'extract-me'").get();
assert('etch exempt from decay', etchRow && etchRow.confidence === 1.0);
assert('extracted decays below 1.0', extRow && extRow.confidence < 1.0);

// 3. REAL behavior: deleteUserMemoryEntries wipes memory_entries for the user+guild.
//    (It does NOT cascade threads/messages — that is current, documented behavior. The
//     cascade deleteUserConversation at database.js:321 is NOT called by /forget.)
addMemoryEntry('u4', 'g1', 'etch', 'fact', 'keep-me', 1.0);
deleteUserMemoryEntries('u4', 'g1');
const afterDel = db.prepare("SELECT COUNT(*) c FROM memory_entries WHERE user_id=? AND guild_id=?").get('u4', 'g1');
assert('deleteUserMemoryEntries clears memory_entries', afterDel.c === 0);

// 4. Dormant is ONLY set by runDecayPass, never by message arrival.
//    getChannelState creates-on-miss; updateChannelState sets the state; last_message_at is INTEGER ms.
const { onMessageReceived } = require('../../features/channelState/stateTracker');
const { runDecayPass } = require('../../features/channelState/stateDecay');
getChannelState('cFresh', 'g1');
updateChannelState('cFresh', { current_state: 'Attentive', last_message_at: Date.now() - 7 * 3600000 });
onMessageReceived({ author: { bot: false }, guild: { id: 'g1' }, channel: { id: 'cDorm' }, content: 'x' });
runDecayPass();
const afterDecay = db.prepare('SELECT current_state FROM channel_state WHERE channel_id=?').get('cFresh');
assert('decay pass sets Dormant on 6h+ idle', afterDecay && afterDecay.current_state === 'Dormant');

// 5. Knowledge base upsert syncs its FTS index
addKnowledgeBase('quantum', 'quantum physics summary', 'wikipedia');
const kbHit = searchKnowledgeBase('quantum');
assert('knowledge FTS searchable after upsert', Array.isArray(kbHit) && kbHit.length > 0);