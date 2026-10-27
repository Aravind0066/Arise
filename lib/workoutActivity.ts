import type { WorkoutLog } from './hunterTypes';

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getWorkoutActivity(logs: WorkoutLog[], now = new Date()) {
  const completedDays = new Set(
    logs
      .map((log) => new Date(log.createdAt))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map(localDayKey)
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = localDayKey(today);
  const activity = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    return {
      key: localDayKey(day),
      label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day).slice(0, 1),
      isToday: index === 6,
      complete: completedDays.has(localDayKey(day)),
    };
  });
  const cursor = new Date(today);
  if (!completedDays.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (completedDays.has(localDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    activity,
    streak,
    hasHistory: completedDays.size > 0,
    completedDaysThisWeek: activity.filter((day) => day.complete).length,
  };
}
