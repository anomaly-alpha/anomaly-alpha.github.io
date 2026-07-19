function getSocraticQuestion(userMessage) {
  if (!userMessage) return '';
  var lower = userMessage.toLowerCase();
  var triggers = [
    'should i', 'what should', 'how do i', 'need advice',
    'what do you think', 'would you', 'is it a good idea',
    'help me decide', 'what would you do', 'idk what to do',
    'can\'t decide', 'stuck between',
  ];
  for (var i = 0; i < triggers.length; i++) {
    if (lower.indexOf(triggers[i]) !== -1) {
      return 'They are asking for advice. Use Socratic questioning: ask clarifying questions '
        + 'before giving answers. Help them think it through rather than telling them what to do. '
        + '\"What have you considered?\", \"What matters most to you here?\", '
        + '\"What does your gut say?\"';
    }
  }
  return '';
}

module.exports = { getSocraticQuestion };
