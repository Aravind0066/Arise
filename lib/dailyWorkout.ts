import { generateAI } from './api';
import type { HunterProfile, HunterStats } from './hunterTypes';
import {
  getSavedDailyWorkoutPlan,
  saveDailyWorkoutPlan,
  type SavedDailyWorkoutPlan,
} from './hunterStorage';
import { getPersonalizedWorkout } from './workoutEngine';
import { buildWorkoutPrompt, getLocalWorkoutDate, isProfileRestDay, normalizeGeneratedWorkout, type WorkoutPlanAdjustment } from './workoutPlanUtils';

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
  const result = await generateAI({ prompt: buildWorkoutPrompt(profile, stats, adjustment) }, { signal });
  const routine = result.success
    ? normalizeGeneratedWorkout(result.data, baseRoutine, localDate, profile?.fitnessLevel, adjustment)
    : null;
  if (!routine) throw new Error(result.success ? 'The generated adjustment was not a valid workout plan.' : result.error || 'Workout adjustment is unavailable.');
  return routine;
}

export async function getOrCreateDailyWorkoutPlan(
  profile: HunterProfile | null,
  stats: HunterStats,
  now = new Date(),
  signal?: AbortSignal,
  forceRefresh = false
): Promise<SavedDailyWorkoutPlan> {
  const localDate = getLocalWorkoutDate(now);
  const restDay = profile?.restDay?.trim() ?? '';
  const saved = await getSavedDailyWorkoutPlan();
  if (
    saved?.localDate === localDate &&
    saved.restDay.trim().toLocaleLowerCase() === restDay.toLocaleLowerCase() &&
    !(forceRefresh && saved.source === 'fallback')
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
  let generationError = '';
  try {
    const result = await generateAI({ prompt: buildWorkoutPrompt(profile, stats) }, { signal });
    const routine = result.success
      ? normalizeGeneratedWorkout(result.data, baseRoutine, localDate, profile?.fitnessLevel)
      : null;
    if (routine) {
      const aiPlan: SavedDailyWorkoutPlan = {
        localDate,
        restDay,
        isRestDay: false,
        routine,
        source: 'ai',
      };
      await saveDailyWorkoutPlan(aiPlan);
      return aiPlan;
    }
    if (!result.success) generationError = result.error ?? 'The AI provider returned an error.';
    else generationError = 'The AI provider returned a plan that did not pass validation.';
  } catch (error) {
    if (signal?.aborted) throw error;
    generationError = error instanceof Error ? error.message : 'AI generation failed.';
    // Continue with the deterministic profile-based routine below.
  }

  const fallbackPlan: SavedDailyWorkoutPlan = {
    localDate,
    restDay,
    isRestDay: false,
    routine: {
      ...baseRoutine,
      id: `daily-fallback-${localDate}`,
      codeName: 'DAILY LOCAL PLAN',
    },
    source: 'fallback',
    message: `AI workout generation unavailable${generationError ? `: ${generationError}` : ''}. Showing the local profile-based routine.`,
  };
  await saveDailyWorkoutPlan(fallbackPlan);
  return fallbackPlan;
}
