const AFTERTHOUGHTS = [' lol', ' tbh', ' fr', ' ngl'];
const MAX_EDITS_PER_HOUR = 2;
const EDIT_WINDOW_MS = 3600000;
const MIN_DELAY = 500;
const MAX_DELAY = 2500;

const editTimestamps = [];

function pruneTimestamps() {
  const now = Date.now();
  const recent = editTimestamps.filter(t => now - t < EDIT_WINDOW_MS);
  editTimestamps.length = 0;
  editTimestamps.push(...recent);
  return recent;
}

function shouldEdit() {
  pruneTimestamps();
  if (editTimestamps.length >= MAX_EDITS_PER_HOUR) return false;
  return Math.random() < 0.05;
}

function generateEdit(original) {
  const roll = Math.random() * 100;
  if (roll < 40) {
    // Capitalize first letter
    return original.charAt(0).toUpperCase() + original.slice(1);
  }
  if (roll < 70) {
    // Add period if not already ending with sentence punctuation
    const trimmed = original.trimEnd();
    if (/[.!?]$/.test(trimmed)) return null;
    return trimmed + '.';
  }
  if (roll < 90) {
    // Add afterthought
    return original + AFTERTHOUGHTS[Math.floor(Math.random() * AFTERTHOUGHTS.length)];
  }
  return null;
}

function scheduleEdit(message, original) {
  const edited = generateEdit(original);
  if (!edited) return;
  editTimestamps.push(Date.now());
  const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  setTimeout(() => {
    message.edit(edited).catch(() => {});
  }, delay);
}

module.exports = { shouldEdit, generateEdit, scheduleEdit };
