import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkoutPrompt,
  getLocalWorkoutDate,
  isProfileRestDay,
  normalizeGeneratedWorkout,
} from '../lib/workoutPlanUtils.ts';

const baseRoutine = {
  id: 'base',
  title: 'Local Routine',
  codeName: 'LOCAL',
  rankRequirement: 'E-Rank',
  goal: 'Foundational fitness',
  durationMinutes: 14,
  difficulty: 'Beginner',
  equipment: 'None (Bodyweight)',
  targetStat: 'strength',
  statBonus: 4,
  xpReward: 70,
  exercises: [],
};

const validPlan = {
  title: 'Daily Foundation',
  goal: 'Build balanced full-body strength',
  durationMinutes: 20,
  xpReward: 9999,
  exercises: [
    { name: 'Push-ups', type: 'reps', targetReps: 8, restSeconds: 30, targetMuscles: ['Chest'], tips: 'Keep your torso aligned.' },
    { name: 'Squats', type: 'reps', targetReps: 10, restSeconds: 30, targetMuscles: ['Legs'], tips: 'Move with control.' },
    { name: 'Plank', type: 'timed', durationSeconds: 25, restSeconds: 30, targetMuscles: ['Core'], tips: 'Breathe steadily.' },
  ],
};

test('daily workout date key uses the device local calendar date', () => {
  assert.equal(getLocalWorkoutDate(new Date(2026, 9, 27, 23, 59)), '2026-10-27');
});

test('rest day comparison honors the local weekday and ignores empty preferences', () => {
  const monday = new Date(2026, 9, 26, 12);
  assert.equal(isProfileRestDay('Monday', monday), true);
  assert.equal(isProfileRestDay('Sunday', monday), false);
  assert.equal(isProfileRestDay('', monday), false);
});

test('normalizes valid AI output while keeping XP and stat rewards from the app routine', () => {
  const routine = normalizeGeneratedWorkout(validPlan, baseRoutine, '2026-10-27', 'Beginner');
  assert.ok(routine);
  assert.equal(routine.id, 'daily-ai-2026-10-27');
  assert.equal(routine.xpReward, 70);
  assert.equal(routine.statBonus, 4);
  assert.equal(routine.exercises[0].illustrationKey, 'pushup');
  assert.equal(routine.exercises[2].illustrationKey, 'plank');
  assert.equal(
    normalizeGeneratedWorkout({ reply: JSON.stringify(validPlan) }, baseRoutine, '2026-10-27')?.title,
    'Daily Foundation'
  );
});

test('rejects unsupported movements and invalid prescription ranges', () => {
  const unsupported = { ...validPlan, exercises: [...validPlan.exercises] };
  unsupported.exercises[0] = { ...unsupported.exercises[0], name: 'Backflip' };
  assert.equal(normalizeGeneratedWorkout(unsupported, baseRoutine, '2026-10-27'), null);

  const invalidReps = { ...validPlan, exercises: [...validPlan.exercises] };
  invalidReps.exercises[0] = { ...invalidReps.exercises[0], targetReps: 100 };
  assert.equal(normalizeGeneratedWorkout(invalidReps, baseRoutine, '2026-10-27'), null);
});

test('workout prompt does not invent missing profile details or equipment', () => {
  const prompt = buildWorkoutPrompt(null, { strength: 35, health: 45, discipline: 30, knowledge: 40, mindfulness: 35 });
  assert.match(prompt, /No saved onboarding details are available/);
  assert.match(prompt, /Available equipment was not recorded/);
  assert.doesNotMatch(prompt, /Height:|Weight:|Age:/);
});
