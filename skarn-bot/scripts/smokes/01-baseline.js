// ===== BASELINE =====
// Ported from README.md "Verification" — schema version + baseline familiarity.
require('../../db/database');
const { db } = require('../../db/database');
const { MIGRATIONS } = require('../../db/migrations');
const v = db.pragma('user_version', { simple: true });
console.log('user_version', v);
const { applyBaselineFamiliarity } = require('../../features/relationship/relationshipTracker');
applyBaselineFamiliarity();
console.log('baseline OK');
// Fresh DB must be fully migrated. The README block predates Migration 2, so
// assert against the migration table, not the stale literal "1".
if (v !== MIGRATIONS.length) process.exitCode = 1;