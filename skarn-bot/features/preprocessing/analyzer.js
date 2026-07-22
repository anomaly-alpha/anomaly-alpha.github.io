const { moderatedChatCompletion } = require('../../ai/client');

var ANALYSIS_PROMPT = `You are a message analyzer for Skarn, a Discord AI persona.
Analyze the following Discord message and return valid JSON only.

{
  "intent": "question|banter|vent|greeting|command|story_request|advice|memory_recall|sharing|topic_shift|other",
  "sub_intent": "clarification|opinion|fact_check|recommendation|null",
  "emotion": "neutral|curious|frustrated|happy|sad|anxious|playful|angry",
  "tone_to_match": "casual|supportive|informative|playful|serious",
  "topics": ["string"],
  "entities": [{"type": "interest|project|person|concept|event", "value": "string"}],
  "requires_kb_search": false,
  "kb_search_terms": ["string"],
  "requires_memory_recall": false,
  "memory_reference": "string or null",
  "is_reply_to_bot": false,
  "safety_flags": ["hostile|self_harm|spam|nsfw"],
  "suggested_tier": "light|full",
  "context_prune": ["newsLine|cultureLine|stateLine|moodLine|relationshipLine|knowledgeLine|emotionalLine"],
  "complexity_score": 0.5
}

Message: `;

// userId, guildId, channelId, roleNature reserved for future scope-tracking/analytics
async function analyzeMessage(userId, guildId, channelId, messageText, roleNature) {
  if (!messageText || messageText.length < 10) return null;

  try {
    var result = await moderatedChatCompletion({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'user', content: ANALYSIS_PROMPT + messageText }
      ],
      max_tokens: 300,
      temperature: 0.1,
      userId: userId,
    });
    if (!result.success) return null;
    var text = result.completion.choices[0].message.content;
    var parsed = JSON.parse(text);

    // Validate required fields with defaults
    return {
      intent: parsed.intent || 'other',
      subIntent: parsed.sub_intent || null,
      emotion: parsed.emotion || 'neutral',
      toneToMatch: parsed.tone_to_match || 'casual',
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      requiresKbSearch: !!parsed.requires_kb_search,
      kbSearchTerms: Array.isArray(parsed.kb_search_terms) ? parsed.kb_search_terms : [],
      requiresMemoryRecall: !!parsed.requires_memory_recall,
      memoryReference: parsed.memory_reference || null,
      isReplyToBot: !!parsed.is_reply_to_bot,
      safetyFlags: Array.isArray(parsed.safety_flags) ? parsed.safety_flags : [],
      suggestedTier: parsed.suggested_tier === 'full' ? 'full' : 'light',
      contextPrune: Array.isArray(parsed.context_prune) ? parsed.context_prune : [],
      complexityScore: typeof parsed.complexity_score === 'number' ? parsed.complexity_score : 0.5,
      raw: messageText, // original user message for the assembler
    };
  } catch (e) {
    console.error('[Analyzer] Error:', e.message);
    return null;
  }
}

module.exports = { analyzeMessage };
