import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkoutPreferencesStore, buildWorkoutContext, compactWorkoutGenerationContext, equipmentLabelForWorkoutMode, workoutPreferencesMatch } from '../lib/workoutGenerationContext.ts';
import { readFile } from 'node:fs/promises';

class MemoryStorage {
  values = new Map();
  async getItem(key) { return this.values.get(key) ?? null; }
  async setItem(key, value) { this.values.set(key, value); }
}

test('workout mode and equipment persist across store instances', async () => {
  const storage = new MemoryStorage();
  const first = createWorkoutPreferencesStore(storage, 'prefs');
  await first.save({ mode: 'gym', equipment: ['kettlebell', 'bench'] });
  const restored = await createWorkoutPreferencesStore(storage, 'prefs').load();
  assert.deepEqual(restored, { mode: 'gym', equipment: ['kettlebell', 'bench'] });
});

test('legacy bodyweight and custom preferences migrate to Home and Gym', async () => {
  const storage = new MemoryStorage();
  const store = createWorkoutPreferencesStore(storage, 'prefs');
  await storage.setItem('prefs', JSON.stringify({ mode: 'bodyweight', equipment: ['old gear'] }));
  assert.deepEqual(await store.load(), { mode: 'home', equipment: [] });
  await storage.setItem('prefs', JSON.stringify({ mode: 'custom', equipment: ['bench'] }));
  assert.deepEqual(await store.load(), { mode: 'gym', equipment: ['bench'] });
});

test('planner reuses a saved plan only when its mode and gym equipment match', () => {
  assert.equal(workoutPreferencesMatch({ mode: 'home', equipment: [] }, { mode: 'home', equipment: [] }), true);
  assert.equal(workoutPreferencesMatch({ mode: 'bodyweight', equipment: [] }, { mode: 'home', equipment: [] }), true);
  assert.equal(workoutPreferencesMatch({ mode: 'home', equipment: [] }, { mode: 'gym', equipment: [] }), false);
  assert.equal(workoutPreferencesMatch({ mode: 'custom', equipment: ['Bench', 'Kettlebell'] }, { mode: 'gym', equipment: ['kettlebell', 'bench'] }), true);
  assert.equal(workoutPreferencesMatch({ mode: 'gym', equipment: ['bench'] }, { mode: 'gym', equipment: [] }), false);
  assert.equal(equipmentLabelForWorkoutMode({ mode: 'home', equipment: [] }), 'None (Bodyweight)');
  assert.equal(equipmentLabelForWorkoutMode({ mode: 'gym', equipment: [] }), 'Full Gym');
  assert.equal(equipmentLabelForWorkoutMode({ mode: 'gym', equipment: ['cable crossover', 'leg press'] }), 'Full Gym');
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

test('workout generation compacts long history below the backend prompt limit while retaining the full snapshot', () => {
  const context = buildWorkoutContext({
    profile: { primaryGoal: 'Strength', fitnessLevel: 'Intermediate', restDay: 'Sunday', weakness: 'Shoulder mobility' },
    stats: {}, preferences: { mode: 'gym', equipment: ['bench press', 'leg press', 'cable crossover'] },
    logs: Array.from({ length: 10 }, (_, index) => ({ workoutName: `Recorded Session ${index} ${'history '.repeat(20)}`, exercisesCompleted: 5, totalExercises: 5, durationSeconds: 1800, sets: 4, reps: 10, weightKg: 45, createdAt: `2026-10-${String(index + 1).padStart(2, '0')}`, status: 'completed' })),
    plans: Array.from({ length: 5 }, (_, index) => ({
      createdAt: `2026-10-${String(index + 1).padStart(2, '0')}`,
      plan: {
        localDate: '2026-10-28', restDay: '', isRestDay: false, source: 'ollama',
        routine: {
          title: `Saved plan ${index} ${'detail '.repeat(30)}`,
          exercises: Array.from({ length: 8 }, (_, exercise) => ({
            id: `e${exercise}`, name: `Movement ${exercise} ${'detail '.repeat(10)}`, targetMuscles: ['chest', 'triceps'],
          })),
        },
      },
    })),
  });
  const compact = compactWorkoutGenerationContext(context, 1800);
  const serialized = JSON.stringify(compact);
  assert.ok(serialized.length <= 1800);
  assert.equal(context.recentPlans.length, 5, 'full context remains available for the saved snapshot');
  assert.equal(compact.trainingHistory.recordsAvailable, true, 'completion record availability remains explicit when detail must be trimmed');
  assert.ok(compact.recentPlans.length > 0, 'recent generated-plan history is retained');
  assert.equal(compact.mode, 'gym');
  assert.deepEqual(compact.equipment, ['bench press', 'leg press', 'cable crossover']);
});

test('both workout generation paths send compact context instead of serializing full history', async () => {
  const daily = await readFile(new URL('../lib/dailyWorkout.ts', import.meta.url), 'utf8');
  assert.equal((daily.match(/compactWorkoutGenerationContext\(context,/g) ?? []).length, 1, 'context compaction is centralized');
  assert.equal((daily.match(/createBoundedWorkoutPrompt\(/g) ?? []).length, 3, 'helper and both generation paths use bounded prompts');
  assert.doesNotMatch(daily, /Context: \$\{JSON\.stringify\(context\)\}/);
  assert.match(daily, /prompt\.length > 4000/);
});

test('workout screen restores a saved plan on mount and only generates on explicit action', async () => {
  const workout = await readFile(new URL('../components/WorkoutScreen.tsx', import.meta.url), 'utf8');
  assert.match(workout, /const savedPlan = await getSavedDailyWorkoutPlan\(\)/);
  assert.match(workout, /savedPlan\?\.localDate === getLocalWorkoutDate\(\)/);
  assert.match(workout, /onPress=\{\(\) => prepareTodayWorkout\(\)\}/);
  assert.match(workout, /GENERATE REPLACEMENT PLAN/);
  assert.match(workout, /completedExerciseIds/);
  assert.match(workout, /Home · Bodyweight/);
  assert.match(workout, /Gym · Equipment \+ Bodyweight/);
  assert.doesNotMatch(workout, /Bodyweight Only|Custom Equipment/);
});

test('Prepare action regenerates rather than reusing a saved plan with different preferences', async () => {
  const daily = await readFile(new URL('../lib/dailyWorkout.ts', import.meta.url), 'utf8');
  const workout = await readFile(new URL('../components/WorkoutScreen.tsx', import.meta.url), 'utf8');
  assert.match(daily, /workoutPreferencesMatch\(saved, chosen\)/);
  assert.match(daily, /const chosen = selectedPreferences \?\? storedPreferences/);
  assert.match(workout, /onPress=\{\(\) => prepareTodayWorkout\(\)\}/);
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
