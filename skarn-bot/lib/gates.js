function ensureAiConfigured() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('AI is not configured. Add OPENAI_API_KEY to the environment.');
  }
}

module.exports = { ensureAiConfigured };
