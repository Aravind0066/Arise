import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkoutPrompt,
  getWorkoutMovementChoices,
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

test('normalizes clear workout field variations while retaining all required exercise data', () => {
  const varied = {
    name: 'Daily Foundation',
    objective: 'Build full-body strength',
    duration: '20',
    movements: [
      { exercise: 'Push-ups', type: 'repetitions', reps: '8', restPeriodSeconds: '30', muscleGroups: 'Chest, Arms', formTips: 'Keep alignment.' },
      { exercise: 'Squats', reps: 10, restSeconds: 30, muscles: ['Legs'], tips: 'Move with control.' },
      { exercise: 'Plank', type: 'hold', seconds: '25', restSeconds: 30, muscles: ['Core'], instructions: 'Breathe steadily.' },
    ],
  };
  const routine = normalizeGeneratedWorkout(varied, baseRoutine, '2026-10-27');
  assert.ok(routine);
  assert.equal(routine.durationMinutes, 20);
  assert.equal(routine.exercises[0].targetReps, 8);
  assert.equal(routine.exercises[2].durationSeconds, 25);
});

test('repairs a contradictory exercise type when exactly one quantity is present', () => {
  const contradictory = {
    ...validPlan,
    exercises: validPlan.exercises.map((exercise) => ({ ...exercise })),
  };
  contradictory.exercises[2] = {
    ...contradictory.exercises[2],
    type: 'reps',
    targetReps: null,
    durationSeconds: 25,
  };
  const routine = normalizeGeneratedWorkout(contradictory, baseRoutine, '2026-10-27');
  assert.ok(routine);
  assert.equal(routine.exercises[2].type, 'timed');
  assert.equal(routine.exercises[2].durationSeconds, 25);
  assert.equal(routine.exercises[2].targetReps, undefined);
});

test('accepts low but valid rep counts supported by the workout controls', () => {
  const lowRepPlan = {
    ...validPlan,
    exercises: validPlan.exercises.map((exercise) => ({ ...exercise })),
  };
  lowRepPlan.exercises[2] = { ...lowRepPlan.exercises[2], targetReps: 3 };
  assert.ok(normalizeGeneratedWorkout(lowRepPlan, baseRoutine, '2026-10-27'));
});

test('workout prompt does not invent missing profile details or equipment', () => {
  const prompt = buildWorkoutPrompt(null, { strength: 35, health: 45, discipline: 30, knowledge: 40, mindfulness: 35 });
  assert.match(prompt, /No saved onboarding details are available/);
  assert.match(prompt, /Available equipment was not recorded/);
  assert.doesNotMatch(prompt, /Height:|Weight:|Age:/);
});

test('home and gym workout modes produce the requested equipment constraints', () => {
  const stats = { strength: 35, health: 45, discipline: 30, knowledge: 40, mindfulness: 35 };
  const homePrompt = buildWorkoutPrompt(null, stats, undefined, { mode: 'home', equipment: [] });
  const gymPrompt = buildWorkoutPrompt(null, stats, undefined, { mode: 'gym', equipment: ['barbell', 'bench'] });
  const generalGymPrompt = buildWorkoutPrompt(null, stats, undefined, { mode: 'gym', equipment: [] });
  assert.match(homePrompt, /This is Home mode: use bodyweight movements only and no equipment/);
  assert.match(gymPrompt, /Gym mode\. Build an equipment-based workout/);
  assert.match(gymPrompt, /Bench Press/);
  assert.match(gymPrompt, /Barbell Squat/);
  assert.match(generalGymPrompt, /Bench Press/);
  assert.doesNotMatch(homePrompt, /Bench Press|Leg Press|Cable Crossover/);
  assert.deepEqual(getWorkoutMovementChoices({ mode: 'gym', equipment: ['bench press', 'leg press', 'cable crossover'] }).filter((name) => ['Bench Press', 'Leg Press', 'Cable Crossover'].includes(name)), ['Bench Press', 'Leg Press', 'Cable Crossover']);
});

test('normalizes supported gym movements for the guided workout UI', () => {
  const gymPlan = {
    ...validPlan,
    exercises: [
      { name: 'Bench Press', type: 'reps', targetReps: 8, durationSeconds: null, restSeconds: 60, targetMuscles: ['Chest', 'Triceps'], tips: 'Keep your shoulders steady.' },
      { name: 'Leg Press', type: 'reps', targetReps: 10, durationSeconds: null, restSeconds: 60, targetMuscles: ['Quadriceps'], tips: 'Keep your knees aligned.' },
      { name: 'Cable Crossover', type: 'reps', targetReps: 12, durationSeconds: null, restSeconds: 45, targetMuscles: ['Chest'], tips: 'Control the cable return.' },
    ],
  };
  const routine = normalizeGeneratedWorkout(gymPlan, baseRoutine, '2026-10-27');
  assert.ok(routine);
  assert.deepEqual(routine.exercises.map((exercise) => exercise.name), ['Bench Press', 'Leg Press', 'Cable Crossover']);
  assert.ok(routine.exercises.every((exercise) => exercise.illustrationKey === 'gym_equipment'));
});
