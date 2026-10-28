import type { WorkoutPreferences } from './hunterTypes.ts';
import type { SavedDailyWorkoutPlan } from './hunterStorage.ts';

export function createWorkoutPreferencesStore(storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }, key: string) {
  return {
    async load(): Promise<WorkoutPreferences> {
      try {
        const raw = await storage.getItem(key);
        const value = raw ? JSON.parse(raw) : null;
        const mode = value?.mode === 'home' || value?.mode === 'bodyweight'
          ? 'home'
          : value?.mode === 'gym' || value?.mode === 'custom'
            ? 'gym'
            : null;
        if (mode && Array.isArray(value.equipment) && value.equipment.every((item: unknown) => typeof item === 'string')) {
          return { mode, equipment: mode === 'home' ? [] : value.equipment };
        }
      } catch { /* missing or malformed preferences use the honest default */ }
      return { mode: 'home', equipment: [] };
    },
    save(value: WorkoutPreferences) { return storage.setItem(key, JSON.stringify(value)); },
  };
}

export function workoutPreferencesMatch(
  saved: { mode?: string; equipment?: string[] } | null | undefined,
  selected: WorkoutPreferences,
): boolean {
  if (!saved) return false;
  const savedMode = saved.mode === 'home' || saved.mode === 'bodyweight'
    ? 'home'
    : saved.mode === 'gym' || saved.mode === 'custom'
      ? 'gym'
      : null;
  if (savedMode !== selected.mode) return false;
  if (selected.mode === 'home') return true;
  const normalizeEquipment = (items: string[] | undefined) => (items ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean).sort();
  return JSON.stringify(normalizeEquipment(saved.equipment)) === JSON.stringify(normalizeEquipment(selected.equipment));
}

export function equipmentLabelForWorkoutMode(preferences: WorkoutPreferences): 'None (Bodyweight)' | 'Dumbbells / Basic' | 'Full Gym' {
  if (preferences.mode === 'home') return 'None (Bodyweight)';
  return 'Full Gym';
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

/** Keep the full context for saved snapshots while sending only recent, useful evidence to Ollama. */
export function compactWorkoutGenerationContext(context: ReturnType<typeof buildWorkoutContext>, characterBudget = 1200) {
  const text = (value: unknown, limit = 80) => typeof value === 'string' ? value.slice(0, limit) : value;
  const compact: Record<string, any> = {
    profile: context.profile ? {
      primaryGoal: text(context.profile.primaryGoal, 80),
      fitnessLevel: text(context.profile.fitnessLevel, 40),
      restDay: text(context.profile.restDay, 24),
      weakness: text(context.profile.weakness, 80),
    } : null,
    mode: context.mode,
    equipment: context.equipment.slice(0, 8).map((item) => item.slice(0, 48)),
    trainingHistory: context.trainingHistory,
    recovery: context.recovery,
    recentCompletedWorkouts: context.recentCompletedWorkouts.slice(0, 4).map((record) => ({
      workoutName: text(record.workoutName, 48), createdAt: text(record.createdAt, 24),
      exercisesCompleted: record.exercisesCompleted, totalExercises: record.totalExercises,
      durationSeconds: record.durationSeconds, sets: record.sets, reps: record.reps, weightKg: record.weightKg,
    })),
    recentPlans: context.recentPlans.slice(0, 3).map((plan) => ({
      createdAt: text(plan.createdAt, 24), title: text(plan.title, 48),
      workoutCompleted: plan.workoutCompleted, completedAt: text(plan.completedAt, 24),
      exercises: (plan.exercises ?? []).slice(0, 4).map((exercise) => ({
        name: text(exercise.name, 48), targetMuscles: exercise.targetMuscles, completed: exercise.completed,
      })),
    })),
  };
  const serialized = () => JSON.stringify(compact);
  while (serialized().length > characterBudget) {
    if (compact.recentCompletedWorkouts.length) compact.recentCompletedWorkouts.pop();
    else {
      const lastPlan = compact.recentPlans.at(-1);
      if (lastPlan?.exercises.length) lastPlan.exercises.pop();
      else if (compact.recentPlans.length > 1) compact.recentPlans.pop();
      else if (lastPlan) compact.recentPlans.pop();
      else if (compact.equipment.length) compact.equipment.pop();
      else break;
    }
  }
  return serialized().length <= characterBudget ? compact : {};
}
