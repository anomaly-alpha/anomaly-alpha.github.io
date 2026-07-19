const { getThreadsNeedingSummary, getThreadMessages, insertSummary, updateThreadSummary } = require('../../db/database');
const getOpenAIClient = require('../../ai/client');

const SUMMARY_CUTOFF_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';

async function summarizeOldThreads() {
  const threads = getThreadsNeedingSummary(SUMMARY_CUTOFF_MS);

  for (const thread of threads) {
    try {
      const messages = getThreadMessages(thread.thread_id);
      if (messages.length < 3) continue;

      const summary = await generateSummary(messages);
      insertSummary(thread.thread_id, summary, messages[0].created_at, messages[messages.length - 1].created_at, messages.length);
      updateThreadSummary(thread.thread_id, summary);

      console.log(`[Summarizer] Summarized thread ${thread.thread_id} (${messages.length} messages)`);
    } catch (error) {
      console.error(`[Summarizer] Failed to summarize thread ${thread.thread_id}:`, error.message);
    }
  }
}

async function generateSummary(messages) {
  const openai = getOpenAIClient();
  const conversation = messages.slice(-20).map(m => `${m.role}: ${m.content}`).join('\n');

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [{
      role: 'user',
      content: `Summarize this conversation in 2-3 sentences. Focus on key topics, decisions, and emotional tone:\n\n${conversation}`
    }],
    max_completion_tokens: 200,
    temperature: 0.3,
  });

  return completion.choices[0].message.content;
}

module.exports = { summarizeOldThreads };
