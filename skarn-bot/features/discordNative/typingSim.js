function getTypingDelay(responseLength) {
  if (responseLength < 100) return 500 + Math.random() * 1000;
  if (responseLength < 300) return 1000 + Math.random() * 2000;
  return 2000 + Math.random() * 2000;
}

// Discord's typing indicator expires ~10s after the last sendTyping. Keep it alive
// for the whole thinking duration: ping immediately, then refresh on a timer.
// Returns a stop() function; call it when the reply is sent or the pipeline exits.
function startTypingKeepalive(channel) {
  if (!channel || typeof channel.sendTyping !== 'function') return function() {};
  var stopped = false;
  var ping = function() {
    if (stopped) return;
    channel.sendTyping().catch(function() { /* permission issue — skip */ });
  };
  ping();
  var timer = setInterval(ping, 8000); // refresh before the 10s expiry
  return function stop() {
    stopped = true;
    clearInterval(timer);
  };
}

module.exports = { getTypingDelay, startTypingKeepalive };
