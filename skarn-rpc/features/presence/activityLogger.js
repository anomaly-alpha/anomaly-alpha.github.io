const fs = require('fs');
const path = require('path');

const MAX_LOG_TOTAL_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_LOG_FILE_BYTES = Math.floor(MAX_LOG_TOTAL_BYTES / 2);
const SENSITIVE_FIELD = /pass(word)?|token|secret|api[-_]?key|authorization|cookie|credential|private.?key|env(ironment)?/i;
const BODY_FIELD = /body|article|content|html|raw|response/i;

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

function redactString(value) {
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '[REDACTED]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9_]+)\b/g, '[REDACTED]')
    .slice(0, 512);
}

function redactValue(value, fieldName, depth) {
  const key = fieldName || '';
  if (SENSITIVE_FIELD.test(key)) return '[REDACTED]';
  if (BODY_FIELD.test(key)) return '[REDACTED]';
  if (depth > 4) return '[TRUNCATED]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return redactString(value);
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : '[INVALID_DATE]';
  if (value instanceof Error) {
    return {
      name: redactString(value.name || 'Error'),
      code: redactString(value.code || 'ERROR'),
    };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(item => redactValue(item, '', depth + 1));
  if (typeof value === 'object') {
    const result = {};
    Object.keys(value).slice(0, 40).forEach(childKey => {
      result[childKey] = redactValue(value[childKey], childKey, depth + 1);
    });
    return result;
  }
  return String(value);
}

function normalizeEventName(eventName) {
  const value = String(eventName || 'event').replace(/[^a-zA-Z0-9_.-]/g, '_');
  return value.slice(0, 80) || 'event';
}

function getSize(filePath) {
  try { return fs.statSync(filePath).size; } catch (error) { return 0; }
}

function chmodOwnerOnly(filePath) {
  try { fs.chmodSync(filePath, 0o600); } catch (error) {}
}

function trimFile(filePath, maxBytes) {
  if (!fs.existsSync(filePath)) return;
  const size = getSize(filePath);
  if (size <= maxBytes) {
    chmodOwnerOnly(filePath);
    return;
  }
  const content = fs.readFileSync(filePath);
  fs.writeFileSync(filePath, content.subarray(content.length - maxBytes));
  chmodOwnerOnly(filePath);
}

function createActivityLogger(options) {
  const config = options || {};
  const logFile = config.logFile || path.join(__dirname, '../../data/rpc.log');
  const backupFile = config.backupFile || logFile + '.1';
  const requestedTotalBytes = Number.isSafeInteger(config.maxTotalBytes) && config.maxTotalBytes > 0
    ? config.maxTotalBytes
    : MAX_LOG_TOTAL_BYTES;
  const maxTotalBytes = Math.min(requestedTotalBytes, MAX_LOG_TOTAL_BYTES);
  const maxFileBytes = Math.min(
    Number.isSafeInteger(config.maxFileBytes) && config.maxFileBytes > 0 ? config.maxFileBytes : DEFAULT_MAX_LOG_FILE_BYTES,
    Math.floor(maxTotalBytes / 2),
  );
  const writeConsole = config.writeConsole !== false;

  function prepareFiles() {
    const directory = path.dirname(logFile);
    try {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      try { fs.chmodSync(directory, 0o700); } catch (error) {}
      trimFile(logFile, maxFileBytes);
      trimFile(backupFile, maxFileBytes);
    } catch (error) {}
  }

  function rotateIfNeeded(lineBytes) {
    if (getSize(logFile) + lineBytes <= maxFileBytes) return;
    try {
      if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
      if (fs.existsSync(logFile)) fs.renameSync(logFile, backupFile);
      chmodOwnerOnly(backupFile);
    } catch (error) {}
  }

  function writeRecord(record) {
    const serialized = JSON.stringify(record) + '\n';
    const line = byteLength(serialized) <= maxFileBytes
      ? serialized
      : JSON.stringify({ timestamp: record.timestamp, event: 'log_line_truncated', fields: { originalEvent: record.event } }) + '\n';
    try {
      prepareFiles();
      rotateIfNeeded(byteLength(line));
      fs.appendFileSync(logFile, line, 'utf8');
      chmodOwnerOnly(logFile);
    } catch (error) {}
    if (writeConsole) console.log(line.trim());
    return record;
  }

  function log(eventName, fields) {
    const record = {
      timestamp: new Date().toISOString(),
      event: normalizeEventName(eventName),
      fields: redactValue(fields || {}, 'fields', 0),
    };
    return writeRecord(record);
  }

  prepareFiles();
  return { log, logFile, backupFile, maxFileBytes, maxTotalBytes };
}

module.exports = {
  DEFAULT_MAX_LOG_FILE_BYTES,
  MAX_LOG_TOTAL_BYTES,
  createActivityLogger,
  redactValue,
};
