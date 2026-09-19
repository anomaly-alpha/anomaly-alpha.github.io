const fs = require('fs');
const path = require('path');
const { loadPresenceContract, loadSharedPresenceContract } = require('../features/presence/presenceContract');
const { CATALOG_PATH, validateIconRegistry, validateSharedCatalog } = require('../features/presence/sharedCatalogAdapter');

const iconPath = path.join(__dirname, '..', 'data', 'icon-registry.json');
const catalogPath = process.env.SKARN_PRESENCE_CATALOG || CATALOG_PATH;

function fail(message) {
  console.error('shared catalog verification failed: ' + message);
  process.exitCode = 1;
}

try {
  const icons = JSON.parse(fs.readFileSync(iconPath, 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const iconValidation = validateIconRegistry(icons);
  if (!iconValidation.ok) throw new Error(iconValidation.errors.join('; '));
  const validation = validateSharedCatalog(catalog, icons.map(icon => icon.key));
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const counts = Object.fromEntries(['dormant', 'observing', 'pondering', 'displeased'].map(mood => [mood, catalog.phrases.filter(entry => entry.mood === mood).length]));
  if (catalog.phrases.length !== 5000) throw new Error('expected exactly 5000 phrases, found ' + catalog.phrases.length);
  if (Object.values(counts).some(count => count < 500)) throw new Error('each mood requires at least 500 phrases: ' + JSON.stringify(counts));
  const localContract = loadPresenceContract();
  const sharedContract = loadSharedPresenceContract();
  if (sharedContract.sleepWindow.utcOffset !== 0 || sharedContract.sleepWindow.timeZone !== undefined) {
    throw new Error('shared contract must retain its UTC sleep policy');
  }
  console.log('shared catalog verified: ' + catalog.phrases.length + ' phrases; moods ' + JSON.stringify(counts) + '; icons ' + icons.length + '; unknown icons ' + validation.unknownIconCount + '; local policy ' + localContract.policyRevision + ' ' + localContract.sleepWindow.timeZone);
} catch (error) {
  fail(error.message);
}
