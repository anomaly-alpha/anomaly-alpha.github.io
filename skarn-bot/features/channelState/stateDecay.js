const { db } = require('../../db/database');
const { runDecay } = require('../relationship/relationshipTracker');

const CHARGED_DECAY_MS = 30 * 60 * 1000; // 30 minutes
const DORMANT_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours

function runDecayPass() {
  const now = Date.now();

  // Revert Charged/Weathering to Attentive after 30min of no new transition
  db.prepare(
    `UPDATE channel_state
     SET current_state = 'Attentive', last_transition_at = ?
     WHERE current_state IN ('Charged', 'Weathering')
     AND (? - last_transition_at) > ?`
  ).run(now, now, CHARGED_DECAY_MS);

  // Set Dormant after 6h of no new messages at all — this is the ONLY place
  // Dormant is ever assigned.
  db.prepare(
    `UPDATE channel_state
     SET current_state = 'Dormant'
     WHERE current_state != 'Dormant'
     AND (? - last_message_at) > ?`
  ).run(now, DORMANT_THRESHOLD_MS);

  // Relationship familiarity decay (daily)
  runDecay();
}

module.exports = { runDecayPass };
