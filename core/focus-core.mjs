// Framework-free, deterministic focus and persistence calculations shared by Web and future Android shells.
export const DEFAULT_DURATIONS = Object.freeze({
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
  cycleLength: 4,
});

function finiteInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(number)));
}

// Since bloomodoro-state-v2, durations are stored in SECONDS, including values below 90.
export function normalizeSettings(raw, defaults = DEFAULT_DURATIONS) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    focus: finiteInteger(data.focus, defaults.focus, 1, 90 * 60),
    shortBreak: finiteInteger(data.shortBreak, defaults.shortBreak, 1, 30 * 60),
    longBreak: finiteInteger(data.longBreak, defaults.longBreak, 5, 60 * 60),
    cycleLength: finiteInteger(data.cycleLength, defaults.cycleLength, 2, 8),
  };
}

export function localDayKey(at = Date.now()) {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function remainingSeconds(endTime, at = Date.now()) {
  return Math.max(0, Math.ceil((endTime - at) / 1000));
}

export function elapsedSessionSeconds(duration, remaining, alreadyCredited = 0) {
  const elapsed = Math.max(0, Math.min(duration, duration - remaining));
  return Math.max(0, elapsed - Math.max(0, alreadyCredited));
}

export function normalizeDailyStats(raw) {
  const result = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const [day, value] of Object.entries(raw).slice(-730)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !value || typeof value !== 'object') continue;
    result[day] = {
      focusSeconds: finiteInteger(value.focusSeconds, 0, 0, 1_000_000_000),
      completedSessions: finiteInteger(value.completedSessions, 0, 0, 1_000_000),
    };
  }
  return result;
}

// Credit an actual running interval, splitting exactly at each LOCAL midnight. Caller owns deduplication.
export function creditFocusInterval(rawStats, startedAt, endedAt) {
  const result = { ...rawStats };
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) return result;
  let cursor = startedAt;
  let guard = 0;
  while (cursor < endedAt && guard++ < 366) {
    const date = new Date(cursor);
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    const boundary = Math.min(endedAt, midnight);
    const day = localDayKey(cursor);
    const existing = result[day] || { focusSeconds: 0, completedSessions: 0 };
    result[day] = {
      ...existing,
      focusSeconds: existing.focusSeconds + (boundary - cursor) / 1000,
    };
    cursor = boundary;
  }
  return result;
}

export function creditCompletedSession(rawStats, completedAt) {
  const result = { ...rawStats };
  const day = localDayKey(completedAt);
  const previous = result[day] || { focusSeconds: 0, completedSessions: 0 };
  result[day] = { ...previous, completedSessions: previous.completedSessions + 1 };
  return result;
}

// Do not simulate an unlimited sequence of focus sessions while the app is terminated.
export function recoverCheckpoint({ isRunning, endTime, remaining, duration }, now = Date.now()) {
  if (!isRunning || !Number.isFinite(endTime) || endTime <= 0) {
    return { kind: 'paused', remainingSeconds: Math.max(0, remaining || 0) };
  }
  if (endTime > now) return { kind: 'running', remainingSeconds: remainingSeconds(endTime, now) };
  return { kind: 'completed-once', completedAt: endTime, remainingSeconds: 0, duration };
}

export function nextMode(mode, focusCount, cycleLength, markComplete = true) {
  if (mode !== 'focus') return 'focus';
  if (!markComplete) return 'shortBreak';
  return (focusCount + 1) % cycleLength === 0 ? 'longBreak' : 'shortBreak';
}
