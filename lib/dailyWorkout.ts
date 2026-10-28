import { generateAI } from './api';
import type { HunterProfile, HunterStats } from './hunterTypes';
import {
  getSavedDailyWorkoutPlan,
  saveDailyWorkoutPlan,
  type SavedDailyWorkoutPlan,
} from './hunterStorage';
import { getPersonalizedWorkout } from './workoutEngine';
import { getWorkoutLogs, getWorkoutPlanHistory, getWorkoutPreferences } from './hunterStorage';
import { buildWorkoutContext, compactWorkoutGenerationContext, equipmentLabelForWorkoutMode, workoutPreferencesMatch } from './workoutGenerationContext';
import { buildWorkoutPrompt, getLocalWorkoutDate, isProfileRestDay, normalizeGeneratedWorkout, type WorkoutPlanAdjustment } from './workoutPlanUtils';

function logWorkoutValidationShape(raw: unknown) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const candidate = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  const exercises = candidate?.exercises ?? candidate?.workoutExercises ?? candidate?.movements;
  const shape = {
    type: Array.isArray(raw) ? 'array' : typeof raw,
    keys: candidate ? Object.keys(candidate).slice(0, 24) : [],
    exerciseCount: Array.isArray(exercises) ? exercises.length : null,
    firstExerciseKeys: Array.isArray(exercises) && exercises[0] && typeof exercises[0] === 'object'
      ? Object.keys(exercises[0] as Record<string, unknown>).slice(0, 20)
      : [],
  };
  console.warn(`[HunterOS validation] feature=workout result=failed shape=${JSON.stringify(shape)}`);
}

function createBoundedWorkoutPrompt(base: string, instruction: string, context: ReturnType<typeof buildWorkoutContext>) {
  const prefix = `${base}\n${instruction}\nContext: `;
  const budget = Math.max(2, 3950 - prefix.length);
  const compact = compactWorkoutGenerationContext(context, budget);
  const prompt = `${prefix}${JSON.stringify(compact)}`;
  if (prompt.length > 4000) throw new Error('Workout prompt is too large. Shorten the equipment list or profile details and try again.');
  return prompt;
}

export async function generateAdjustedWorkoutPlan(
  profile: HunterProfile | null,
  stats: HunterStats,
  adjustment: WorkoutPlanAdjustment,
  now = new Date(),
  signal?: AbortSignal
) {
  if (isProfileRestDay(profile?.restDay, now)) {
    throw new Error('Today is your configured rest day. Adjustments are unavailable.');
  }
  const localDate = getLocalWorkoutDate(now);
  const baseRoutine = getPersonalizedWorkout(profile);
  const [logs, plans, preferences] = await Promise.all([getWorkoutLogs(), getWorkoutPlanHistory(), getWorkoutPreferences()]);
  const context = buildWorkoutContext({
    profile: profile ? { primaryGoal: profile.primaryGoal, fitnessLevel: profile.fitnessLevel, restDay: profile.restDay, weakness: profile.weakness } : null,
    stats,
    preferences,
    logs: logs as unknown as Array<Record<string, unknown>>,
    plans,
  });
  const prompt = createBoundedWorkoutPrompt(buildWorkoutPrompt(profile, stats, adjustment, preferences), 'Use recorded progress and the following JSON context only. Do not treat generated plans as completed sessions. Avoid repeating recent exercises/muscle groups when practical and progress gradually without unsupported gain claims.', context);
  const result = await generateAI({ prompt, responseFormat: 'workout' }, { signal });
  const routine = result.success
    ? normalizeGeneratedWorkout(result.data, baseRoutine, localDate, profile?.fitnessLevel, adjustment)
    : null;
  if (!routine) {
    if (result.success) logWorkoutValidationShape(result.data);
    throw new Error(result.success ? 'Workout output did not match the required 3–8 supported exercises with reps or duration, rest, target muscles, and tips. Retry generation.' : result.error || 'Workout adjustment is unavailable.');
  }
  return { routine, contextSnapshot: context, preferences };
}

export async function getOrCreateDailyWorkoutPlan(
  profile: HunterProfile | null,
  stats: HunterStats,
  now = new Date(),
  signal?: AbortSignal,
  forceRefresh = false,
  selectedPreferences?: { mode: 'home' | 'gym'; equipment: string[] },
): Promise<SavedDailyWorkoutPlan> {
  const localDate = getLocalWorkoutDate(now);
  const restDay = profile?.restDay?.trim() ?? '';
  const [saved, storedPreferences] = await Promise.all([
    getSavedDailyWorkoutPlan(),
    selectedPreferences ? Promise.resolve(null) : getWorkoutPreferences(),
  ]);
  const chosen = selectedPreferences ?? storedPreferences!;
  if (
    saved?.localDate === localDate &&
    saved.restDay.trim().toLocaleLowerCase() === restDay.toLocaleLowerCase() &&
    workoutPreferencesMatch(saved, chosen) &&
    !forceRefresh
  ) {
    return saved;
  }

  if (isProfileRestDay(restDay, now)) {
    const restPlan: SavedDailyWorkoutPlan = {
      localDate,
      restDay,
      isRestDay: true,
      routine: null,
      source: 'rest',
      message: 'Today matches your configured weekly rest day. No workout is scheduled.',
    };
    await saveDailyWorkoutPlan(restPlan);
    return restPlan;
  }

  const baseRoutine = getPersonalizedWorkout(profile);
  const [logs, plans] = await Promise.all([getWorkoutLogs(), getWorkoutPlanHistory()]);
  const context = buildWorkoutContext({ profile: profile ? { primaryGoal: profile.primaryGoal, fitnessLevel: profile.fitnessLevel, restDay: profile.restDay, weakness: profile.weakness } : null, stats, preferences: chosen, logs: logs as unknown as Array<Record<string, unknown>>, plans });
  const prompt = createBoundedWorkoutPrompt(buildWorkoutPrompt(profile, stats, undefined, chosen), 'Use this JSON context as recorded evidence only; plans are not completions unless a completion record exists. Respect the selected mode/equipment and configured rest day. Avoid repeating exercises/muscles from recent plans when practical. Progress gradually and do not infer gains.', context);
  const result = await generateAI({ prompt, responseFormat: 'workout' }, { signal });
  let routine = result.success
    ? normalizeGeneratedWorkout(result.data, baseRoutine, localDate, profile?.fitnessLevel)
    : null;
  if (!routine) {
    if (result.success) logWorkoutValidationShape(result.data);
    throw new Error(result.success ? 'Workout output did not match the required 3–8 supported exercises with reps or duration, rest, target muscles, and tips. Retry generation.' : result.error || 'Hunter AI could not generate a workout plan.');
  }
  routine = { ...routine, equipment: equipmentLabelForWorkoutMode(chosen) };
  if (forceRefresh) routine = { ...routine, id: `${routine.id}-${Date.now()}` };

  const aiPlan: SavedDailyWorkoutPlan = {
    localDate,
    restDay,
    isRestDay: false,
    routine,
    source: 'ollama',
    mode: chosen.mode,
    equipment: chosen.equipment,
    contextSnapshot: context,
  };
  await saveDailyWorkoutPlan(aiPlan);
  return aiPlan;
}
