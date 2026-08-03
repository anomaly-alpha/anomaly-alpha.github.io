// ===== Message Adapter =====
// Builds a message-like facade so command handleActivation handlers can run from
// inside the AI tool loop. Mention path wraps the real Discord message (prototype
// preserved); consult path synthesizes one from the interaction. reply() sends the
// payload AND records its text so run_command can return the real output to the model
// (grill Q2). No JSDoc; section headers only.

function parseMentions(text) {
  const users = [];
  const channels = [];
  const roles = [];
  let m;
  const userRe = /<@!?(\d+)>/g;
  const chanRe = /<#(\d+)>/g;
  const roleRe = /<@&(\d+)>/g;
  while ((m = userRe.exec(text || ''))) users.push({ id: m[1] });
  while ((m = chanRe.exec(text || ''))) channels.push({ id: m[1] });
  while ((m = roleRe.exec(text || ''))) roles.push({ id: m[1] });
  return {
    users: { first: function() { return users[0] || null; } },
    channels: { first: function() { return channels[0] || null; } },
    roles: { first: function() { return roles[0] || null; } },
  };
}

function payloadToText(payload) {
  if (!payload) return '';
  if (payload.content) return String(payload.content);
  if (payload.embeds && payload.embeds[0]) {
    const e = payload.embeds[0];
    const data = e.data || e;
    const fields = (data.fields || []).map(function(f) { return f.name + ': ' + f.value; }).join('\n');
    return [data.title, data.description, fields].filter(Boolean).join('\n');
  }
  return '';
}

function buildFacade(source, opts) {
  const phrase = opts.phrase;
  const args = opts.args || '';
  const content = [phrase, args].filter(Boolean).join(' ');
  const captured = { text: '' };

  // Mention path: inherit everything from the real message; shadow content + reply.
  if (source && source.author) {
    const facade = Object.create(source);
    facade.content = content;
    facade.mentions = parseMentions(content);
    const origReply = source.reply.bind(source);
    facade.reply = async function(payload) {
      captured.text = payloadToText(payload);
      return origReply(payload);
    };
    facade.capture = function() { return captured.text; };
    return facade;
  }

  // Consult path: synthesize from the interaction.
  const interaction = source;
  return {
    content: content,
    author: interaction.user,
    user: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    channel: interaction.channel,
    mentions: parseMentions(content),
    // followUp requires the interaction to be deferred first (callers must defer).
    reply: async function(payload) {
      captured.text = payloadToText(payload);
      return interaction.followUp(payload);
    },
    capture: function() { return captured.text; },
  };
}

module.exports = { buildFacade };
