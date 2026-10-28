import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkoutPreferencesStore, buildWorkoutContext } from '../lib/workoutGenerationContext.ts';
import { readFile } from 'node:fs/promises';

class MemoryStorage {
  values = new Map();
  async getItem(key) { return this.values.get(key) ?? null; }
  async setItem(key, value) { this.values.set(key, value); }
}

test('workout mode and equipment persist across store instances', async () => {
  const storage = new MemoryStorage();
  const first = createWorkoutPreferencesStore(storage, 'prefs');
  await first.save({ mode: 'custom', equipment: ['kettlebell', 'bench'] });
  const restored = await createWorkoutPreferencesStore(storage, 'prefs').load();
  assert.deepEqual(restored, { mode: 'custom', equipment: ['kettlebell', 'bench'] });
});

test('generation context distinguishes completed logs from generated plans and includes history/mode', () => {
  const context = buildWorkoutContext({
    profile: { primaryGoal: 'Strength', restDay: 'Sunday' }, stats: { strength: 42 },
    preferences: { mode: 'gym', equipment: ['barbell'] },
    logs: [{ workoutName: 'Session A', sets: 4, reps: 8, durationSeconds: 900, createdAt: '2026-10-27', status: 'completed' }],
    plans: [{ createdAt: '2026-10-28', plan: { localDate: '2026-10-28', restDay: '', isRestDay: false, source: 'ollama', routine: { title: 'Plan B', exercises: [{ id: 'e1', name: 'Squats', targetMuscles: ['legs'] }] } } }],
  });
  assert.equal(context.mode, 'gym');
  assert.deepEqual(context.equipment, ['barbell']);
  assert.equal(context.recentCompletedWorkouts[0].status, 'completed');
  assert.equal(context.recentPlans[0].workoutCompleted, false);
  assert.equal(context.recentPlans[0].exercises[0].completed, false);
  assert.match(context.recovery, /No explicit recovery/);
  assert.equal(context.trainingHistory.recordsAvailable, true);
});

test('workout screen restores a saved plan on mount and only generates on explicit action', async () => {
  const workout = await readFile(new URL('../components/WorkoutScreen.tsx', import.meta.url), 'utf8');
  assert.match(workout, /const savedPlan = await getSavedDailyWorkoutPlan\(\)/);
  assert.match(workout, /savedPlan\?\.localDate === getLocalWorkoutDate\(\)/);
  assert.match(workout, /onPress=\{\(\) => prepareTodayWorkout\(\)\}/);
  assert.match(workout, /GENERATE REPLACEMENT PLAN/);
  assert.match(workout, /completedExerciseIds/);
});

test('rest-day constraints are checked before any workout generation request', async () => {
  const daily = await readFile(new URL('../lib/dailyWorkout.ts', import.meta.url), 'utf8');
  const restCheck = daily.indexOf('if (isProfileRestDay(restDay, now))');
  const request = daily.indexOf("generateAI({ prompt, responseFormat: 'workout' }", restCheck);
  assert.ok(restCheck >= 0 && request > restCheck);
  assert.match(daily, /Respect the selected mode\/equipment and configured rest day/);
  assert.match(daily, /!forceRefresh/);
  assert.doesNotMatch(daily, /canRequestOnline/);
});
