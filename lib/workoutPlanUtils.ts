import type { HunterProfile, HunterStats, WorkoutRoutine } from './hunterTypes.ts';

const VALID_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const;
export type WorkoutPlanAdjustment = {
  durationMinutes: number;
  difficulty: (typeof VALID_DIFFICULTIES)[number];
  targetFocus: 'Full Body' | 'Upper Body' | 'Lower Body' | 'Core' | 'Conditioning';
  equipment: WorkoutRoutine['equipment'];
};

export function getLocalWorkoutDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isProfileRestDay(restDay: string | undefined, date = new Date()): boolean {
  if (!restDay?.trim()) return false;
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
  return weekday.toLocaleLowerCase() === restDay.trim().toLocaleLowerCase();
}

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return cleaned.length > 0 && cleaned.length <= maxLength ? cleaned : null;
}

function movementKey(name: string): WorkoutRoutine['exercises'][number]['illustrationKey'] | null {
  const value = name.toLocaleLowerCase().replace(/[-_]/g, ' ');
  if (/push.?ups?/.test(value)) return 'pushup';
  if (/squats?/.test(value)) return 'squat';
  if (/planks?/.test(value)) return 'plank';
  if (/jumping jacks?/.test(value)) return 'jumping_jack';
  if (/lunges?/.test(value)) return 'lunge';
  if (/mountain climbers?/.test(value)) return 'mountain_climber';
  if (/burpees?/.test(value)) return 'burpee';
  if (/crunches?/.test(value)) return 'crunch';
  return null;
}

export function normalizeGeneratedWorkout(
  raw: unknown,
  baseRoutine: WorkoutRoutine,
  localDate: string,
  fitnessLevel?: HunterProfile['fitnessLevel'],
  adjustment?: WorkoutPlanAdjustment
): WorkoutRoutine | null {
  let candidate: any = raw;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof candidate === 'string') {
      try {
        candidate = JSON.parse(candidate.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
      } catch {
        return null;
      }
    }
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
    const nested = candidate.reply ?? candidate.workout ?? candidate.plan ?? candidate.routine;
    if (nested === undefined) break;
    candidate = nested;
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;

  const title = safeText(candidate.title, 90);
  const goal = safeText(candidate.goal, 180);
  const durationMinutes = candidate.durationMinutes;
  if (!title || !goal || !Number.isInteger(durationMinutes) || durationMinutes < 8 || durationMinutes > 75) return null;
  if (!Array.isArray(candidate.exercises) || candidate.exercises.length < 3 || candidate.exercises.length > 8) return null;

  const exercises: WorkoutRoutine['exercises'] = [];
  for (const [index, item] of candidate.exercises.entries()) {
    if (!item || typeof item !== 'object') return null;
    const name = safeText(item.name, 64);
    const tips = safeText(item.tips, 220);
    const type = item.type;
    const restSeconds = item.restSeconds;
    const key = name ? movementKey(name) : null;
    if (!name || !tips || !key || !Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > 90) return null;
    if (!Array.isArray(item.targetMuscles) || item.targetMuscles.length < 1 || item.targetMuscles.length > 4) return null;
    const targetMuscles = item.targetMuscles.map((muscle: unknown) => safeText(muscle, 32));
    if (targetMuscles.some((muscle: string | null) => !muscle)) return null;

    if (type === 'reps') {
      if (!Number.isInteger(item.targetReps) || item.targetReps < 4 || item.targetReps > 40) return null;
      exercises.push({
        id: `daily-${localDate}-${index + 1}`,
        name,
        type,
        targetReps: item.targetReps,
        restSeconds,
        targetMuscles: targetMuscles as string[],
        illustrationKey: key,
        tips,
      });
    } else if (type === 'timed') {
      if (!Number.isInteger(item.durationSeconds) || item.durationSeconds < 15 || item.durationSeconds > 120) return null;
      exercises.push({
        id: `daily-${localDate}-${index + 1}`,
        name,
        type,
        durationSeconds: item.durationSeconds,
        restSeconds,
        targetMuscles: targetMuscles as string[],
        illustrationKey: key,
        tips,
      });
    } else {
      return null;
    }
  }

  return {
    ...baseRoutine,
    id: `daily-ai-${localDate}`,
    title,
    codeName: 'DAILY AI PLAN',
    goal,
    durationMinutes: adjustment?.durationMinutes ?? durationMinutes,
    difficulty: adjustment?.difficulty ?? (fitnessLevel && VALID_DIFFICULTIES.includes(fitnessLevel) ? fitnessLevel : baseRoutine.difficulty),
    equipment: adjustment?.equipment ?? 'None (Bodyweight)',
    exercises,
  };
}

export function buildWorkoutPrompt(profile: HunterProfile | null, stats: HunterStats, adjustment?: WorkoutPlanAdjustment): string {
  const data = profile as Partial<HunterProfile> | null;
  const profileDetails: string[] = [];
  if (typeof data?.fitnessLevel === 'string' && VALID_DIFFICULTIES.includes(data.fitnessLevel)) {
    profileDetails.push(`Fitness level: ${data.fitnessLevel}`);
  }
  if (typeof data?.primaryGoal === 'string' && data.primaryGoal.trim()) {
    profileDetails.push(`Primary goal: ${data.primaryGoal.trim().slice(0, 120)}`);
  }
  const height = Number(data?.height);
  const weight = Number(data?.weight);
  if (Number.isFinite(height) && height >= 100 && height <= 250) profileDetails.push(`Height: ${height} cm`);
  if (Number.isFinite(weight) && weight >= 30 && weight <= 300) profileDetails.push(`Weight: ${weight} kg`);
  if (Number.isFinite(height) && height >= 100 && height <= 250 && Number.isFinite(weight) && weight >= 30 && weight <= 300) {
    const bmi = weight / ((height / 100) ** 2);
    profileDetails.push(`BMI context (not a standalone prescription factor): ${bmi.toFixed(1)}`);
  }
  const age = Number(data?.age);
  if (Number.isInteger(age) && age >= 13 && age <= 100) profileDetails.push(`Age: ${age}`);
  if (typeof data?.weakness === 'string' && data.weakness.trim()) profileDetails.push(`Training considerations shared at onboarding: ${data.weakness.trim().slice(0, 120)}`);
  if (typeof data?.restDay === 'string' && data.restDay.trim()) profileDetails.push(`Configured weekly rest day: ${data.restDay.trim()}`);
  if (adjustment) {
    profileDetails.push(`Requested duration: ${adjustment.durationMinutes} minutes`);
    profileDetails.push(`Requested difficulty: ${adjustment.difficulty}`);
    profileDetails.push(`Requested target focus: ${adjustment.targetFocus}`);
    profileDetails.push(`Available equipment: ${adjustment.equipment}`);
  }

  return [
    `Create one safe, practical workout for today using the profile details below only when provided${adjustment ? `, targeting ${adjustment.targetFocus}` : ''}.`,
    'Treat BMI as optional context, never as the sole factor for exercise selection. Scale for the stated fitness level and include sensible rests.',
    'Do not prescribe medical treatment or extreme exertion. Use the selected equipment only when it is available, and keep movements within the supported exercise list.',
    'Return only a JSON object with title, goal, durationMinutes, and exercises.',
    'Each exercise must contain name (choose only push-ups, squats, plank, jumping jacks, lunges, mountain climbers, burpees, or crunches), type (reps or timed), targetReps for reps OR durationSeconds for timed, restSeconds, targetMuscles (1-4 short strings), and tips.',
    'Use 3-8 exercises, workout duration 8-75 minutes, reps 4-40, timed duration 15-120 seconds, rest 0-90 seconds. Do not include XP, rewards, stats, quests, or profile mutations.',
    'Available profile context:',
    profileDetails.length ? profileDetails.join('\n') : 'No saved onboarding details are available; make a conservative beginner bodyweight plan.',
    `Current Hunter stats: strength ${stats.strength}, health ${stats.health}, discipline ${stats.discipline}`,
    adjustment ? `Use ${adjustment.equipment} as the available equipment. Match the requested duration and difficulty.` : 'Available equipment was not recorded; use bodyweight exercises only.',
  ].join('\n');
}
