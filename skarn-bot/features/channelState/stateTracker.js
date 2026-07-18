const Sentiment = require('sentiment');
const { getChannelState, updateChannelState } = require('../../db/database');
const { pushMessage, getMessages } = require('./sentimentBuffer');

const sentiment = new Sentiment();

// Thresholds (tune after observing real data)
const CHARGED_THRESHOLD = 8;      // messages in window
const CHARGED_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const WEATHERING_THRESHOLD = -0.3; // comparative score average

const STATE_LINES = {
  Dormant: 'Current state: Dormant — the channel has been quiet a while. Be more observational, ask fewer questions, keep it terse. You are at rest.',
  Attentive: 'Current state: Attentive — normal conversational energy.',
  Charged: 'Current state: Charged — the room is heated or moving fast. Be sharper and shorter, more opinionated. The old reflexes stir.',
  Weathering: 'Current state: Weathering — someone nearby has been venting or having a hard stretch. Be steadier, less witty, more grounded and direct. You\'ve seen worse.',
};

function getStateLine(state) {
  return STATE_LINES[state] || '';
}

function computeSentimentAverage(channelId) {
  const msgs = getMessages(channelId);
  if (msgs.length === 0) return 0;
  const scores = msgs.map(m => sentiment.analyze(m).comparative);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function onMessageReceived(message) {
  if (message.author.bot) return;
  if (!message.guild) return;

  const channelId = message.channel.id;
  const guildId = message.guild.id;
  const now = Date.now();

  // Push to sentiment buffer
  pushMessage(channelId, message.content);

  // Get or create channel state
  const state = getChannelState(channelId, guildId);

  // Compute the window/count exactly once, before any branching,
  // so there is a single source of truth written exactly once at the end.
  const windowExpired = now - (state.count_window_started_at || now) > CHARGED_WINDOW_MS;
  const windowStartedAt = windowExpired ? now : (state.count_window_started_at || now);
  const messageCount = windowExpired ? 1 : state.recent_message_count + 1;

  // Determine new state (priority order). Dormant is intentionally
  // NOT evaluated here — arriving traffic can never itself be "Dormant".
  // Dormant is only ever set by runDecayPass() during genuine idle periods.
  let newState = 'Attentive';

  if (messageCount >= CHARGED_THRESHOLD) {
    newState = 'Charged';
  } else {
    const avgSentiment = computeSentimentAverage(channelId);
    if (avgSentiment < WEATHERING_THRESHOLD) {
      newState = 'Weathering';
    }
  }

  // Single write per call.
  const patch = {
    last_message_at: now,
    recent_message_count: messageCount,
    count_window_started_at: windowStartedAt,
  };

  if (newState !== state.current_state) {
    patch.current_state = newState;
    patch.last_transition_at = now;
  }

  updateChannelState(channelId, patch);
}

module.exports = { onMessageReceived, getStateLine };
