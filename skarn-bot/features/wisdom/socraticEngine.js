function getSocraticQuestion(userMessage) {
  if (!userMessage) return '';
  var lower = userMessage.toLowerCase();
  var triggers = [
    'should i', 'what should', 'how do i', 'need advice',
    'what do you think', 'would you', 'is it a good idea',
    'help me decide', 'what would you do', 'idk what to do',
    'can\'t decide', 'stuck between', 'help me think', 'i can\'t decide',
    'i cant decide', 'what would you advise', 'talk me through it',
    'i dont know what to do',
  ];
  for (var i = 0; i < triggers.length; i++) {
    if (lower.indexOf(triggers[i]) !== -1) {
      return 'They are asking for advice. Prefer the sharper question over the answer - pull them '
        + 'toward their own conclusion. Offer the answer only when asked twice. '
        + '\"What have you considered?\", \"What matters most to you here?\", '
        + '\"What does your gut say?\"';
    }
  }
  return '';
}

module.exports = { getSocraticQuestion };
