// ===== GUILD ALLOWLIST + MEMBERSHIP LOG =====
// Discord gives a bot no way to decline an invite — the join completes before
// any of our code runs, so "approval" has to be enforced after the fact. Two
// paths do that: a guildCreate listener that leaves anything unapproved, and a
// startup sweep that catches guilds added while the allowlist was unset (they
// never fire guildCreate again).
//
// An empty or missing SKARN_APPROVED_GUILDS disables enforcement rather than
// denying everything. A typo in that variable would otherwise make the bot
// leave every server it is in, including the operator's own.
//
// Every join and leave is written to guild_membership_log regardless of whether
// enforcement is on, so the record stays complete if the allowlist is ever
// switched off.

const ENV_KEY = 'SKARN_APPROVED_GUILDS';
const ID_PATTERN = /^\d{17,20}$/;

function parseApprovedList(raw) {
  return String(raw == null ? '' : raw)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => ID_PATTERN.test(entry));
}

function isApproved(approved, guildId) {
  return approved.indexOf(String(guildId)) !== -1;
}

function registerGuildAllowlist(client, options) {
  const config = options || {};
  const raw = config.rawList !== undefined ? config.rawList : process.env[ENV_KEY];
  const log = config.log || ((message) => console.log('[GuildAllowlist] ' + message));
  const record = config.record || ((entry) => require('../../db/guildMembership').logGuildEvent(entry));
  const approved = parseApprovedList(raw);
  const enabled = approved.length > 0;
  const selfLeft = new Set();

  function write(guild, event, reason) {
    try {
      record({
        guildId: guild.id,
        guildName: guild.name || null,
        event,
        reason,
        memberCount: guild.memberCount,
      });
    } catch (error) {
      log('log write failed for ' + guild.id + ': ' + error.message);
    }
  }

  async function leaveGuild(guild, reason) {
    const label = guild.id + ' (' + (guild.name || 'unknown') + ')';
    selfLeft.add(guild.id);
    try {
      await guild.leave();
      write(guild, 'left', reason);
      log('left unapproved guild ' + label);
      return true;
    } catch (error) {
      selfLeft.delete(guild.id);
      write(guild, 'left', 'leave_failed');
      log('failed to leave ' + label + ': ' + error.message);
      return false;
    }
  }

  client.on('guildCreate', async (guild) => {
    if (!guild || !guild.id) return;
    if (!enabled) {
      write(guild, 'joined', 'allowlist_disabled');
      log('joined ' + guild.id + ' (' + (guild.name || 'unknown') + ') — enforcement disabled, kept');
      return;
    }
    if (isApproved(approved, guild.id)) {
      write(guild, 'joined', 'allowlisted');
      log('joined ' + guild.id + ' (' + (guild.name || 'unknown') + ') — allowlisted');
      return;
    }
    write(guild, 'joined', 'unapproved');
    await leaveGuild(guild, 'unapproved');
  });

  client.on('guildDelete', (guild) => {
    if (!guild || !guild.id) return;
    // Discord sets unavailable during an outage; the bot is still a member.
    if (guild.unavailable) return;
    // Already recorded by leaveGuild().
    if (selfLeft.has(guild.id)) {
      selfLeft.delete(guild.id);
      return;
    }
    write(guild, 'left', 'external');
    log('removed from ' + guild.id + ' (' + (guild.name || 'unknown') + ') by an external actor');
  });

  async function enforce() {
    if (!enabled) {
      log('disabled — ' + ENV_KEY + ' is empty, every invite is accepted');
      return { left: 0, kept: 0 };
    }
    log('enforcing — ' + approved.length + ' approved guild(s)');
    const guilds = [...client.guilds.cache.values()];
    let left = 0;
    let kept = 0;
    for (const guild of guilds) {
      if (isApproved(approved, guild.id)) {
        kept++;
        continue;
      }
      if (await leaveGuild(guild, 'unapproved')) left++;
    }
    log('sweep complete — kept ' + kept + ', left ' + left);
    return { left, kept };
  }

  return { enabled, approved, enforce };
}

module.exports = { ENV_KEY, parseApprovedList, isApproved, registerGuildAllowlist };
