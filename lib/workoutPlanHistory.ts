export type WorkoutPlanHistoryRecord<T extends { createdAt?: string; routine?: { id: string } | null }> = {
  id: string;
  createdAt: string;
  plan: T;
};

export function upsertWorkoutPlanHistory<T extends { createdAt?: string; routine?: { id: string } | null }>(
  history: WorkoutPlanHistoryRecord<T>[],
  plan: T,
): WorkoutPlanHistoryRecord<T>[] {
  if (!plan.routine) return history;
  const createdAt = plan.createdAt || new Date().toISOString();
  const id = `workout_${createdAt}_${plan.routine.id}`;
  const record = { id, createdAt, plan: { ...plan, createdAt } as T };
  const index = history.findIndex((entry) => entry.id === id);
  if (index < 0) return [record, ...history];
  const updated = [...history];
  updated[index] = record;
  return updated;
}
