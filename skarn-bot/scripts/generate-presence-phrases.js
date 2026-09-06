#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'presence-assets');
const OUTPUT = path.join(ASSETS, 'presence-phrases.json');
const PALETTE_FILE = path.join(ASSETS, 'railway-symbol-palette.json');
const RPC = path.resolve(ROOT, '..', 'skarn-rpc');
const ICONS_FILE = path.join(RPC, 'data', 'icon-registry.json');
const ACTIVE_FILE = path.join(RPC, 'data', 'rpc-phrases.json');
const MOODS_FILE = path.join(RPC, 'data', 'rpc-phrase-moods.json');
const MOODS = ['dormant', 'observing', 'pondering', 'displeased'];
const TARGET = 5000;
const MINIMUM = 500;
const FORBIDDEN = ['user', 'users', 'guild', 'guilds', 'message', 'messages', 'prompt', 'prompts', 'search', 'memory', 'memories', 'secret', 'secrets', 'password', 'token', 'api key'];
const SEEDS = {
  dormant: ['The quiet keeps its counsel', 'Night folds over old stone', 'Stillness outlasts the clock', 'Dust settles where stars once turned'],
  observing: ['The old eye measures the hour', 'Small patterns gather at the edge', 'The horizon changes by degrees', 'Every shadow leaves a record'],
  pondering: ['A patient thought crosses the dark', 'The answer waits beneath the question', 'Time gives strange shape to reason', 'One more angle may reveal enough'],
  displeased: ['The clock has learned poor manners', 'Another shortcut meets the void', 'Patience wears a very thin crown', 'The obvious path remains ignored']
};
const STATES = { dormant: 'The realm rests between bells', observing: 'Ancient eyes remain open', pondering: 'Old questions turn slowly', displeased: 'Patience thins but endures' };

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function clean(value) { return String(value == null ? '' : value).normalize('NFKC').trim().split(/ +/).join(' '); }
function forbidden(value) { const lower = value.toLowerCase(); return FORBIDDEN.some(word => lower.includes(word)) || lower.includes('<@') || lower.includes('http://') || lower.includes('https://') || /[0-9]{15,}/.test(value) || lower.includes('@everyone') || lower.includes('@here'); }
function validId(value) { return typeof value === 'string' && value.length > 0 && value.length <= 64 && value.split('').every((char, index) => (index === 0 ? /[a-z0-9]/ : /[a-z0-9._-]/).test(char)); }
function iconSet() {
  const list = read(ICONS_FILE);
  if (!Array.isArray(list) || !list.length) throw new Error('icon registry must be a non-empty array');
  const keys = new Set(list.map(item => item && item.key));
  if (keys.size !== list.length || [...keys].some(key => typeof key !== 'string' || !key.startsWith('skarn_'))) throw new Error('invalid icon registry');
  return keys;
}
function validateCatalog(catalog, iconKeys, symbolPalette) {
  const palette = symbolPalette || read(PALETTE_FILE); const icons = iconKeys ? new Set(iconKeys) : iconSet(); const errors = [];
  if (!Array.isArray(palette) || palette.length < 16 || palette.length > 32 || new Set(palette).size !== palette.length) errors.push('palette must contain 16-32 unique symbols');
  if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.phrases) || catalog.phrases.length !== TARGET) errors.push('catalog must contain exactly 5000 entries');
  if (!catalog || typeof catalog.generatedAt !== 'string' || !Number.isFinite(Date.parse(catalog.generatedAt))) errors.push('generatedAt must be a valid date');
  if (!catalog || catalog.generatorVersion !== 'presence-generator-1') errors.push('invalid generatorVersion');
  const ids = new Set(); const texts = new Set(); const counts = Object.fromEntries(MOODS.map(mood => [mood, 0]));
  if (catalog && Array.isArray(catalog.phrases)) catalog.phrases.forEach((entry, index) => {
    const label = 'phrase ' + index + ': ';
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errors.push(label + 'not an object'); return; }
    const fields = Object.keys(entry); if (fields.some(field => !['id', 'text', 'mood', 'symbol', 'rpcDetails', 'rpcState', 'rpcIconKey'].includes(field))) errors.push(label + 'unknown field');
    if (!validId(entry.id) || ids.has(entry.id)) errors.push(label + 'invalid or duplicate id'); ids.add(entry.id);
    if (typeof entry.text !== 'string' || !entry.text || clean(entry.text) !== entry.text || entry.text.length > 128) errors.push(label + 'invalid text');
    if (!MOODS.includes(entry.mood)) errors.push(label + 'invalid mood'); else counts[entry.mood]++;
    for (const field of ['rpcDetails', 'rpcState']) if (typeof entry[field] !== 'string' || !entry[field] || clean(entry[field]) !== entry[field]) errors.push(label + 'invalid ' + field);
    if (typeof entry.rpcIconKey !== 'string' || !icons.has(entry.rpcIconKey)) errors.push(label + 'invalid rpcIconKey');
    if (entry.symbol !== undefined && (typeof entry.symbol !== 'string' || !palette.includes(entry.symbol))) errors.push(label + 'invalid symbol');
    if (entry.symbol !== undefined && (entry.symbol + ' ' + entry.text).length > 128) errors.push(label + 'activity text too long');
    const textKey = typeof entry.text === 'string' ? entry.text.toLowerCase() : ''; if (texts.has(textKey)) errors.push(label + 'duplicate text'); texts.add(textKey);
    if (forbidden([entry.text, entry.rpcDetails, entry.rpcState].join(' '))) errors.push(label + 'forbidden content');
  });
  for (const mood of MOODS) if (counts[mood] < MINIMUM) errors.push(mood + ' requires at least ' + MINIMUM + ' entries');
  return { ok: errors.length === 0, errors, counts };
}
function importLegacy() {
  const source = read(ACTIVE_FILE); const active = source.pool || []; const archive = source.archive || []; const classified = read(MOODS_FILE).phrases || [];
  const classifiedBySignature = new Map(classified.map(item => [String(item.key) + '|' + clean(item.details) + '|' + clean(item.state), item])); const icons = iconSet(); const seenSignatures = new Set(); const seenTexts = new Set(); const rows = [];
  for (const old of active.concat(archive, classified)) {
    const meta = classifiedBySignature.get(String(old.key) + '|' + clean(old.details) + '|' + clean(old.state)) || {};
    const mood = old.mood || meta.mood; const details = clean(old.details); const state = clean(old.state);
    if (!old.key || !MOODS.includes(mood) || !details || !state || !icons.has(old.key) || details.length > 128 || forbidden(details + ' ' + state)) continue;
    const signature = details.toLowerCase() + '|' + state.toLowerCase() + '|' + old.key; const textKey = details.toLowerCase();
    if (seenSignatures.has(signature) || seenTexts.has(textKey)) continue;
    seenSignatures.add(signature); seenTexts.add(textKey);
    rows.push({ text: details, mood, rpcDetails: details, rpcState: state, rpcIconKey: old.key });
    if (rows.length >= TARGET) break;
  }
  return rows;
}
function buildCatalog() {
  const palette = read(PALETTE_FILE); const icons = [...iconSet()].sort(); const rows = importLegacy(); const used = new Set(rows.map(row => row.text.toLowerCase())); let serial = 1;
  while (rows.length < TARGET) { const mood = MOODS[(serial - 1) % MOODS.length]; const base = SEEDS[mood][Math.floor((serial - 1) / MOODS.length) % SEEDS[mood].length]; const text = base + ' ' + String(serial).padStart(4, '0'); serial++; if (used.has(text.toLowerCase())) continue; used.add(text.toLowerCase()); const row = { text, mood, rpcDetails: text, rpcState: STATES[mood], rpcIconKey: icons[(rows.length + serial) % icons.length] }; if (rows.length % 2 === 0) row.symbol = palette[rows.length % palette.length]; rows.push(row); }
  const phrases = rows.map((row, index) => ({ id: 'railway-' + String(index + 1).padStart(4, '0'), ...row }));
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), generatorVersion: 'presence-generator-1', phrases };
}
function atomicWrite(file, value) { const temp = file + '.tmp-' + process.pid + '-' + Date.now(); try { fs.writeFileSync(temp, JSON.stringify(value, null, 2) + String.fromCharCode(10), 'utf8'); fs.renameSync(temp, file); } catch (error) { try { fs.unlinkSync(temp); } catch (_) {} throw error; } }
function main(args) { const check = args.includes('--check'); const write = args.includes('--write'); if (!check && !write) throw new Error('use --check or explicit --write'); const catalog = check ? read(OUTPUT) : buildCatalog(); const result = validateCatalog(catalog); if (!result.ok) throw new Error(result.errors.join('; ')); if (write) atomicWrite(OUTPUT, catalog); console.log((write ? 'wrote' : 'valid') + ' shared catalog: 5000 entries; ' + JSON.stringify(result.counts)); }
if (require.main === module) { try { main(process.argv.slice(2)); } catch (error) { console.error('presence catalog failed: ' + error.message); process.exitCode = 1; } }
module.exports = { buildCatalog, validateCatalog, importLegacy, atomicWrite };
