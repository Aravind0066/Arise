import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getQuestStatusAt, hasMeaningfulVerification } from '../lib/questRules.ts';
import { canAccreditPomodoro } from '../lib/pomodoroRules.ts';
import { buildCustomWorkoutLog } from '../lib/workoutLogUtils.ts';
import { createRewardClaimer } from '../lib/rewardClaims.ts';

class MemoryStorage {
  values = new Map();
  async getItem(key) { return this.values.get(key) ?? null; }
  async setItem(key, value) { this.values.set(key, value); }
}

test('quest status expires at its deadline and completed status is retained', () => {
  const quest = { status: 'active', deadline: '2026-10-28T10:00:00Z' };
  assert.equal(getQuestStatusAt(quest, Date.parse('2026-10-28T10:00:00Z')), 'expired');
  assert.equal(getQuestStatusAt({ ...quest, status: 'completed' }, Date.parse('2026-10-29T10:00:00Z')), 'completed');
  assert.equal(getQuestStatusAt({ ...quest, deadline: 'bad-date' }), 'expired');
});

test('quest verification requires meaningful non-whitespace input', () => {
  assert.equal(hasMeaningfulVerification('  '), false);
  assert.equal(hasMeaningfulVerification('done'), false);
  assert.equal(hasMeaningfulVerification('Completed the full study block'), true);
});

test('a reward claim can only be acquired once, including concurrent attempts', async () => {
  const storage = new MemoryStorage();
  const claim = createRewardClaimer(storage, 'claims');
  const result = await Promise.all([claim('quest:q1'), claim('quest:q1'), claim('quest:q1')]);
  assert.equal(result.filter(Boolean).length, 1);
  assert.equal(await claim('quest:q1'), false);
});

test('Pomodoro reward is unavailable until complete and cannot be repeated', () => {
  assert.equal(canAccreditPomodoro(false, false), false);
  assert.equal(canAccreditPomodoro(true, false), true);
  assert.equal(canAccreditPomodoro(true, true), false);
});

test('custom workout payload preserves sets, reps, and weight', () => {
  assert.deepEqual(buildCustomWorkoutLog({
    workoutName: ' Bench Press ', sets: '5', reps: '8', weightKg: '42.5', difficulty: 'Intermediate',
  }), {
    workoutName: 'Bench Press', exercisesCompleted: 1, totalExercises: 1, durationSeconds: 1200,
    difficulty: 'Intermediate', sets: 5, reps: 8, weightKg: 42.5,
  });
  assert.throws(() => buildCustomWorkoutLog({
    workoutName: 'Bench Press', sets: '0', reps: '8', weightKg: 'bad', difficulty: 'Intermediate',
  }), /positive whole-number sets and reps/);
});

test('Ascend contains Journal and Discipline sections without a top-level Discipline tab', () => {
  const source = readFileSync(new URL('../app/tools.tsx', import.meta.url), 'utf8');
  assert.match(source, /\{ id: 'ascend', label: 'Ascend'/);
  assert.doesNotMatch(source, /\{ id: 'discipline', label: 'Discipline', icon:/);
  assert.match(source, /activeTool === 'ascend' && ascendSection === 'journal'/);
  assert.match(source, /activeTool === 'ascend' && ascendSection === 'discipline'/);
  assert.match(source, /params\.tab === 'discipline'/);
});
