const ROLE_NATURE = {
  consult: 'casual',
  roast: 'casual',
  compliment: 'casual',
  insult: 'casual',
  pickup: 'casual',
  joke: 'casual',
  meme: 'casual',
  fortune: 'casual',
  improv: 'casual',
  search: 'casual',

  story: 'moderate',
  song: 'moderate',
  debate: 'moderate',
  adventure: 'moderate',
  realm: 'moderate',
  realm_combat: 'moderate',
  realm_npc: 'moderate',

  homework: 'serious',
  recipe: 'serious',
  code: 'serious',
  aitrivia: 'serious',
  vein: 'serious',
  charades: 'serious',
  wouldyourather: 'serious',
  unpopularopinion: 'serious',
};

const CASUAL_ABBREVIATIONS = [' fr', ' ngl', ' tbh', ' imo', ' ngl tbh'];
const CASUAL_EMOJIS = ['💀', '😭', '🔥', '💯', '🗿', '👀', '😂', '🤌'];

function postProcess(response, roleNature) {
  if (!response || response.length === 0) return response;

  if (roleNature === 'casual') {
    response = applyLowercase(response);
    response = stripPeriod(response, 60);
    response = injectAbbreviation(response);
    response = injectEmoji(response);
  } else if (roleNature === 'moderate') {
    response = stripPeriod(response, 60, 0.2);
  } else {
    response = stripPeriod(response, 40, 0.1);
  }

  return response;
}

function applyLowercase(text) {
  if (Math.random() > 0.3) return text;
  if (text.length > 80) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function stripPeriod(text, maxLength, probability) {
  if (Math.random() > probability) return text;
  if (text.length > maxLength) return text;
  if (text.endsWith('.') && !text.endsWith('...')) {
    return text.slice(0, -1);
  }
  return text;
}

function injectAbbreviation(text) {
  if (Math.random() > 0.15) return text;
  if (text.length > 200) return text;
  const lower = text.toLowerCase();
  if (lower.endsWith(' fr') || lower.endsWith(' ngl') || lower.endsWith(' tbh') || lower.endsWith(' imo')) return text;
  const abbr = CASUAL_ABBREVIATIONS[Math.floor(Math.random() * CASUAL_ABBREVIATIONS.length)];
  return text + abbr;
}

function injectEmoji(text) {
  if (Math.random() > 0.1) return text;
  if (text.length > 200) return text;
  const emoji = CASUAL_EMOJIS[Math.floor(Math.random() * CASUAL_EMOJIS.length)];
  return text + ' ' + emoji;
}

function splitMessage(text, maxLength) {
  if (!maxLength) maxLength = 400;
  if (text.length <= maxLength) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > maxLength && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : [text];
}

async function maybeBurst(chunks, channel) {
  if (chunks.length <= 1) return chunks;
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  if (totalLen >= 200 && totalLen <= 400) {
    const delay = 2000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return chunks;
}

module.exports = { postProcess, splitMessage, maybeBurst, ROLE_NATURE };
