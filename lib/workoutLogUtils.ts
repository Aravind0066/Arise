export function buildCustomWorkoutLog(input: {
  workoutName: string;
  sets: string;
  reps: string;
  weightKg: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}) {
  const setCount = Number(input.sets);
  const repCount = Number(input.reps);
  const weightKg = Number(input.weightKg);
  if (!Number.isInteger(setCount) || setCount < 1 || !Number.isInteger(repCount) || repCount < 1 || !Number.isFinite(weightKg) || weightKg < 0) {
    throw new Error('Enter positive whole-number sets and reps, and a valid weight of 0 kg or more.');
  }
  return {
    workoutName: input.workoutName.trim(),
    exercisesCompleted: 1,
    totalExercises: 1,
    durationSeconds: 20 * 60,
    difficulty: input.difficulty,
    sets: setCount,
    reps: repCount,
    weightKg,
  };
}
