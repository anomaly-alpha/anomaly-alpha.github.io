// Snapshot the live DB via VACUUM INTO (safe while the bot runs, WAL-aware)
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'skarn.db');
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');
const RETENTION_DAYS = 14;

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const out = path.join(BACKUP_DIR, `skarn-${stamp}.db`);

const db = new Database(DB_PATH, { readonly: true });
// Readonly VACUUM INTO reads the logical DB including -wal content, so no
// checkpoint is needed (and readonly connections cannot checkpoint anyway).
db.exec(`VACUUM INTO '${out}'`);
db.close();

// Prune old backups
const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
for (const f of fs.readdirSync(BACKUP_DIR)) {
  const p = path.join(BACKUP_DIR, f);
  if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
}

console.log(`[Backup] Wrote ${out}`);
