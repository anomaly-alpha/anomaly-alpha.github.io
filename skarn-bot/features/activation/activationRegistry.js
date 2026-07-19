const path = require('path');
const fs = require('fs');

// Map<lowercasePhrase, { command, type, handler, activation }>
const registry = new Map();
let sortedPhrases = [];

function register(cmdName, activation, executeFn, handleActivationFn) {
  const phrase = activation.phrase.toLowerCase();
  if (registry.has(phrase)) {
    console.warn('[activation] Duplicate phrase "' + phrase + '" (' + cmdName + ' vs ' + registry.get(phrase).command + ')');
    return;
  }
  registry.set(phrase, {
    command: cmdName,
    type: activation.type || 'command',
    handler: activation.type === 'ai' ? null : (handleActivationFn || executeFn),
    executeFn,
    handleActivationFn,
    activation,
  });
  sortedPhrases = [...registry.keys()].sort(function(a, b) { return b.length - a.length; });
}

function scanCommands() {
  const commandsDir = path.join(__dirname, '..', '..', 'commands');
  const files = fs.readdirSync(commandsDir).filter(function(f) { return f.endsWith('.js'); });
  for (const file of files) {
    const cmdPath = path.join(commandsDir, file);
    try {
      const mod = require(cmdPath);
      if (mod.activation) {
        const cmdName = path.basename(file, '.js');
        register(cmdName, mod.activation, mod.execute, mod.handleActivation);
      }
    } catch (err) {
      console.error('[activation] Failed to load ' + file + ':', err.message);
    }
  }
  console.log('[activation] Registered ' + registry.size + ' activation phrases');
}

function lookup(content) {
  if (!content || typeof content !== 'string') return null;
  const lower = content.toLowerCase().trim();

  // Try ! prefix: strip !, prepend "skarn ", look up
  if (lower.startsWith('!')) {
    const afterBang = lower.slice(1).trim();
    const skarnPhrase = 'skarn ' + afterBang;
    const entry = registry.get(skarnPhrase);
    if (entry) {
      return buildMatch(entry, '');
    }
    return null;
  }

  // Try each phrase (longest first)
  for (const phrase of sortedPhrases) {
    let checkFrom = lower;

    // Handle optional bot mention prefix: <@BOT_ID> or <@!BOT_ID>
    if (checkFrom.startsWith('<@')) {
      const closeBracket = checkFrom.indexOf('>');
      if (closeBracket > 0) {
        checkFrom = checkFrom.slice(closeBracket + 1).trim();
      }
    }

    if (checkFrom.startsWith(phrase)) {
      // Verify word boundary: after the phrase, next char must be space, punctuation, or end
      const afterPhrase = checkFrom.slice(phrase.length);
      if (afterPhrase.length > 0 && !/[\s,.!?]/.test(afterPhrase[0])) {
        continue; // word boundary fail
      }
      const remainder = afterPhrase.trim();
      return buildMatch(registry.get(phrase), remainder);
    }
  }
  return null;
}

function buildMatch(entry, remainder) {
  if (!entry) return null;

  if (entry.type === 'ai') {
    // Tier A: route to AI handler with directive
    const directive = '[The user requested "' + entry.activation.phrase + '". Respond accordingly, focusing on that intent.]';
    const aiContent = directive + ' ' + remainder;
    return { type: 'ai', handler: null, command: entry.command, aiContent: aiContent, activation: entry.activation };
  }

  // Tier B/C: run command handler
  if (!entry.handler) return null;

  // Parse args
  let args = {};
  if (entry.activation.parseArgs && typeof entry.activation.parseArgs === 'function') {
    try {
      args = entry.activation.parseArgs(entry.activation.phrase + ' ' + remainder);
    } catch (e) {
      args = {};
    }
  }

  return { type: 'command', handler: entry.handler, command: entry.command, args: args, activation: entry.activation };
}

function getAll() {
  return [...registry.values()].map(function(e) {
    return {
      phrase: e.activation.phrase,
      aliases: e.activation.aliases || [],
      description: e.activation.description || e.command,
      type: e.type,
      guildOnly: e.activation.guildOnly || false,
      requiredPermissions: e.activation.requiredPermissions || [],
    };
  });
}

module.exports = { register, scanCommands, lookup, getAll };
