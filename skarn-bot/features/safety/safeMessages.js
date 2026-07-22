var CATEGORY_MESSAGES = {
  hate: "I don't do hate. Try again with something worth saying.",
  'hate/threatening': "I don't do hate. Try again with something worth saying.",
  sexual: 'I can\'t process that request.',
  'sexual/minors': 'I can\'t process that request.',
};
var GENERIC_FALLBACK = 'I can\'t respond to that.';
var MOD_UNAVAILABLE = 'Something\'s off with my connection. Try again in a bit.';

function getSafeMessage(categories, moderationUnavailable) {
  if (moderationUnavailable) return MOD_UNAVAILABLE;
  if (!categories) return GENERIC_FALLBACK;
  for (var cat in CATEGORY_MESSAGES) {
    if (categories[cat]) return CATEGORY_MESSAGES[cat];
  }
  return GENERIC_FALLBACK;
}

module.exports = { getSafeMessage };
