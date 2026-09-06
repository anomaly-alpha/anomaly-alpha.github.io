const DEFAULT_TIMEOUT_MS = 5000;
const FIRST_SUPPRESSION_MS = 30000;
const PRESSURE_SUPPRESSION_MS = 120000;
const HEALTHY_RECOVERY_MS = 15 * 60 * 1000;
function createPresenceUpdateGate(options) {
  const c = options || {}, now = c.clock || (() => Date.now()), schedule = c.setTimeout || setTimeout, cancel = c.clearTimeout || clearTimeout, log = c.log || (() => {}), timeoutMs = c.timeoutMs || DEFAULT_TIMEOUT_MS;
  let inFlight = false, suppressedUntil = 0, suppressionLevel = 0, rejectionCount = 0, healthySince = 0, lastResult = 'never', timeoutHandle = null;
  function status(at) { const t = at === undefined ? now() : at; return { inFlight, suppressed: t < suppressedUntil, suppressedUntil, suppressionLevel, rejectionCount, lastResult }; }
  function reject(reason, at) { rejectionCount++; suppressionLevel = suppressionLevel >= 1 ? 2 : 1; suppressedUntil = at + (suppressionLevel === 1 ? FIRST_SUPPRESSION_MS : PRESSURE_SUPPRESSION_MS); healthySince = 0; lastResult = 'rejected'; log('presence update rejected: ' + (reason && reason.message ? reason.message : String(reason))); }
  function attempt(writer, at) {
    const t = at === undefined ? now() : at;
    if (inFlight) return Promise.resolve({ ok: false, reason: 'in-flight', ...status(t) });
    if (t < suppressedUntil) return Promise.resolve({ ok: false, reason: 'suppressed', ...status(t) });
    inFlight = true; let result;
    try { result = writer(); } catch (error) { inFlight = false; reject(error, t); return Promise.resolve({ ok: false, reason: 'rejected', error, ...status(t) }); }
    let timedOut = false;
    const timeout = new Promise((resolve, rejectTimeout) => { timeoutHandle = schedule(() => { timedOut = true; const e = new Error('presence update timed out'); e.code = 'PRESENCE_UPDATE_TIMEOUT'; rejectTimeout(e); }, timeoutMs); });
    const writerPromise = Promise.resolve(result);
    writerPromise.catch(() => {});
    return Promise.race([writerPromise, timeout]).then(() => { if (timeoutHandle) cancel(timeoutHandle); timeoutHandle = null; inFlight = false; lastResult = 'ok'; if (!healthySince) healthySince = t; if (suppressionLevel && t - healthySince >= HEALTHY_RECOVERY_MS) { suppressionLevel--; healthySince = t; if (!suppressionLevel) suppressedUntil = 0; } return { ok: true, ...status(t) }; }).catch(error => { if (timeoutHandle) cancel(timeoutHandle); timeoutHandle = null; inFlight = false; reject(error, t); return { ok: false, reason: timedOut ? 'timeout' : 'rejected', error, ...status(t) }; });
  }
  function notifyDisconnect(at) { const t = at === undefined ? now() : at; suppressionLevel = 2; suppressedUntil = t + PRESSURE_SUPPRESSION_MS; healthySince = 0; lastResult = 'disconnected'; log('presence update suppressed after disconnect'); }
  return { attempt, canAttempt: at => !inFlight && (at === undefined ? now() : at) >= suppressedUntil, notifyDisconnect, getStatus: status, reset: () => { inFlight = false; suppressedUntil = 0; suppressionLevel = 0; rejectionCount = 0; } };
}
module.exports = { createPresenceUpdateGate, DEFAULT_TIMEOUT_MS, FIRST_SUPPRESSION_MS, PRESSURE_SUPPRESSION_MS, HEALTHY_RECOVERY_MS };
