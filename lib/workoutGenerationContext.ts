import type { WorkoutPreferences } from './hunterTypes.ts';
import type { SavedDailyWorkoutPlan } from './hunterStorage.ts';

export function createWorkoutPreferencesStore(storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }, key: string) {
  return {
    async load(): Promise<WorkoutPreferences> {
      try {
        const raw = await storage.getItem(key);
        const value = raw ? JSON.parse(raw) : null;
        if (value && ['home', 'gym', 'bodyweight', 'custom'].includes(value.mode) && Array.isArray(value.equipment) && value.equipment.every((item: unknown) => typeof item === 'string')) return value;
      } catch { /* missing or malformed preferences use the honest default */ }
      return { mode: 'bodyweight', equipment: [] };
    },
    save(value: WorkoutPreferences) { return storage.setItem(key, JSON.stringify(value)); },
  };
}

export function buildWorkoutContext(input: {
  profile: { primaryGoal?: string; fitnessLevel?: string; restDay?: string; weakness?: string } | null;
  stats: unknown;
  preferences: WorkoutPreferences;
  logs: Array<Record<string, unknown>>;
  plans: Array<{ createdAt: string; plan: SavedDailyWorkoutPlan }>;
}) {
  const completedLogs = input.logs.slice(0, 10).map((log) => ({
    routineId: log.routineId,
    workoutName: log.workoutName,
    exercisesCompleted: log.exercisesCompleted,
    totalExercises: log.totalExercises,
    durationSeconds: log.durationSeconds,
    sets: log.sets,
    reps: log.reps,
    weightKg: log.weightKg,
    createdAt: log.createdAt,
    status: 'completed',
  }));
  const since = (days: number) => input.logs.filter((log) => {
    const timestamp = Date.parse(String(log.createdAt ?? ''));
    return Number.isFinite(timestamp) && timestamp >= Date.now() - days * 24 * 60 * 60 * 1000;
  }).length;
  return {
    profile: input.profile,
    stats: input.stats,
    mode: input.preferences.mode,
    equipment: input.preferences.equipment,
    recentCompletedWorkouts: completedLogs,
    trainingHistory: { recordsAvailable: input.logs.length > 0, completedSessionsLast7Days: since(7), completedSessionsLast30Days: since(30) },
    recentPlans: input.plans.slice(0, 5).map(({ createdAt, plan }) => ({
      createdAt, title: plan.routine?.title,
      exercises: plan.routine?.exercises.map(({ id, name, targetMuscles }) => ({ id, name, targetMuscles, completed: (plan.completedExerciseIds ?? []).includes(id) })),
      workoutCompleted: Boolean(plan.completedAt), completedAt: plan.completedAt ?? null,
    })),
    recovery: 'No explicit recovery or sleep records are stored.',
  };
}
