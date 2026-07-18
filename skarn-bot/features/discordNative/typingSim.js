function getTypingDelay(responseLength) {
  if (responseLength < 100) return 500 + Math.random() * 1000;
  if (responseLength < 300) return 1000 + Math.random() * 2000;
  return 2000 + Math.random() * 2000;
}

async function simulateTyping(channel, responseLength) {
  try {
    await channel.sendTyping();
    const delay = getTypingDelay(responseLength);
    await new Promise(resolve => setTimeout(resolve, delay));
  } catch {
    // Permission issue — skip silently
  }
}

module.exports = { simulateTyping };
