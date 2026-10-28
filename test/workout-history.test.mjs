import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertWorkoutPlanHistory } from '../lib/workoutPlanHistory.ts';

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
