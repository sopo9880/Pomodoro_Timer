import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, remainingSeconds, elapsedSessionSeconds, creditFocusInterval, creditCompletedSession, recoverCheckpoint, localDayKey, nextMode } from '../core/focus-core.mjs';

test('legacy v2 settings persist seconds even below 90', () => {
  assert.deepEqual(normalizeSettings({ focus: 60, shortBreak: 45, longBreak: 75, cycleLength: 6 }), { focus: 60, shortBreak: 45, longBreak: 75, cycleLength: 6 });
  assert.equal(normalizeSettings({ focus: 1500 }).focus, 1500);
});

test('exact wall-clock deadline, not tick count, determines remaining time', () => {
  assert.equal(remainingSeconds(90_000, 45_300), 45);
  assert.equal(remainingSeconds(90_000, 100_000), 0);
});

test('credited focus progress is idempotent', () => {
  assert.equal(elapsedSessionSeconds(1500, 1200, 0), 300);
  assert.equal(elapsedSessionSeconds(1500, 1200, 300), 0);
  assert.equal(elapsedSessionSeconds(1500, 900, 300), 300);
});

test('daily stats split across local midnight', () => {
  const start = new Date(2026, 9, 28, 23, 59, 55).getTime();
  const end = start + 10_000;
  const totals = creditFocusInterval({}, start, end);
  assert.equal(totals[localDayKey(start)].focusSeconds, 5);
  assert.equal(totals[localDayKey(end)].focusSeconds, 5);
  const completed = creditCompletedSession(totals, end);
  assert.equal(completed[localDayKey(end)].completedSessions, 1);
});

test('recovery stops after one completed session instead of generating unlimited rewards', () => {
  const oldDeadline = new Date(2026, 9, 1).getTime();
  assert.deepEqual(recoverCheckpoint({ isRunning: true, endTime: oldDeadline, remaining: 120, duration: 1500 }, oldDeadline + 5 * 24 * 3600 * 1000), { kind: 'completed-once', completedAt: oldDeadline, remainingSeconds: 0, duration: 1500 });
  assert.equal(recoverCheckpoint({ isRunning: true, endTime: 80_000 }, 10_000).remainingSeconds, 70);
});

test('cycle transitions distinguish completed sessions and manual skips', () => {
  assert.equal(nextMode('focus', 3, 4, true), 'longBreak');
  assert.equal(nextMode('focus', 3, 4, false), 'shortBreak');
  assert.equal(nextMode('longBreak', 4, 4, true), 'focus');
});
