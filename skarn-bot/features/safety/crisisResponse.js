function getCrisisResponse() {
  return {
    content: [
      "Hey, I hear you. I'm not equipped to handle this alone, but there are",
      "people who are \u2014 and they actually want to help.",
      "",
      "\u2022 **988**: Call or text (US) \u2014 someone trained to listen, 24/7",
      "\u2022 **Crisis Text Line**: Text HOME to 741741 (US/Canada) or 85258 (UK)",
      "\u2022 **IASP directory**: https://www.iasp.info/resources/Crisis_Centres/",
      "",
      "Please reach out to one of them. They're better at this than I am.",
    ].join('\n'),
    flags: 64,
  };
}

module.exports = { getCrisisResponse };
