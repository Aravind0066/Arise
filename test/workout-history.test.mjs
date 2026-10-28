import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { upsertWorkoutPlanHistory } from '../lib/workoutPlanHistory.ts';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('workout plan history keeps separate generations and updates a saved plan in place', () => {
  const first = { createdAt: '2026-10-28T10:00:00.000Z', routine: { id: 'daily-ai-2026-10-28' }, title: 'First' };
  const adjusted = { createdAt: '2026-10-28T10:10:00.000Z', routine: { id: 'daily-ai-2026-10-28' }, title: 'Adjusted' };
  const history = upsertWorkoutPlanHistory([], first);
  const twoPlans = upsertWorkoutPlanHistory(history, adjusted);
  assert.equal(twoPlans.length, 2);
  assert.deepEqual(twoPlans.map((entry) => entry.plan.title), ['Adjusted', 'First']);
  const completed = upsertWorkoutPlanHistory(twoPlans, { ...adjusted, completedAt: '2026-10-28T10:45:00.000Z' });
  assert.equal(completed.length, 2);
  assert.equal(completed[0].plan.completedAt, '2026-10-28T10:45:00.000Z');
});

test('Workout exposes the existing history route from its visible states', async () => {
  const workout = await source('../components/WorkoutScreen.tsx');
  assert.match(workout, /router\.push\('\/workout-history'/);
  assert.match(workout, /accessibilityLabel="Open workout history"/);
  assert.match(workout, /VIEW WORKOUT HISTORY/);
});

test('Workout History reads saved plans, sorts them newest first, and expands saved contents locally', async () => {
  const history = await source('../app/workout-history.tsx');
  assert.match(history, /getWorkoutPlanHistory\(\)/);
  assert.match(history, /Date\.parse\(b\.createdAt\) - Date\.parse\(a\.createdAt\)/);
  assert.match(history, /setExpandedPlanId/);
  assert.match(history, /VIEW PLAN DETAILS/);
  assert.match(history, /Mode not recorded/);
  assert.match(history, /No workout history yet/);
  assert.doesNotMatch(history, /generateAI|chatWithAI/);
});
