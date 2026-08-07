// ===== TRADE =====
// Ported from README.md "Trade exploit regression" — duplicate offer rejected,
// atomic transfer of 2 DIFFERENT items.
require('../../db/database');
const store = require('../../features/realm/realmStore');
const { startTrade, addToTrade, confirmTrade } = require('../../features/realm/economy');
const S = { hp_current: 50, hp_max: 50, strength: 10, dexterity: 10, intelligence: 10, constitution: 10, wisdom: 10, charisma: 10, luck: 10 };
store.saveCharacter('A', 'G', { name: 'A', race: 'human', class: 'warrior', level: 1, gold: 100, ...S });
store.saveCharacter('B', 'G', { name: 'B', race: 'elf', class: 'mage', level: 1, gold: 100, ...S });
store.addItem('A', 'G', 'sword1', 'Sword', 'weapon', 'a sword', 'rare');
store.addItem('A', 'G', 'shield1', 'Shield', 'armor', 'a shield', 'rare');
startTrade('A', 'G', 'B');
const d1 = addToTrade('A', 'sword1', 0);
const d2 = addToTrade('A', 'sword1', 0);
const dupRejected = d1.ok && !d2.ok && d2.error === 'Item already in your offer';
console.log('dup rejected:', dupRejected);
addToTrade('A', 'shield1', 0);
confirmTrade('A');
const done = confirmTrade('B');
const tradeDone = done.ok && done.completed === true;
const invA = store.getInventory('A', 'G').length;
const invB = store.getInventory('B', 'G').length;
console.log('trade done:', tradeDone, '| A inv:', invA, '| B inv:', invB);
if (!(dupRejected && tradeDone && invA === 0 && invB === 2)) process.exitCode = 1;