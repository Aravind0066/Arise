import type { HunterProfile, HunterStats, WorkoutRoutine } from './hunterTypes.ts';

const VALID_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const;
const HOME_MOVEMENTS = ['Push-ups', 'Squats', 'Plank', 'Jumping Jacks', 'Lunges', 'Mountain Climbers', 'Burpees', 'Crunches'] as const;
const GYM_MOVEMENTS = [
  { name: 'Bench Press', equipment: ['bench press', 'bench', 'barbell'] },
  { name: 'Dumbbell Bench Press', equipment: ['dumbbell', 'dumbbells'] },
  { name: 'Leg Press', equipment: ['leg press', 'machine'] },
  { name: 'Cable Crossover', equipment: ['cable crossover', 'cable', 'cables'] },
  { name: 'Lat Pulldown', equipment: ['lat pulldown', 'cable', 'cables', 'machine'] },
  { name: 'Seated Cable Row', equipment: ['cable row', 'cable', 'cables', 'machine'] },
  { name: 'Dumbbell Shoulder Press', equipment: ['dumbbell', 'dumbbells'] },
  { name: 'Biceps Curl', equipment: ['dumbbell', 'dumbbells', 'barbell', 'cable'] },
  { name: 'Triceps Pushdown', equipment: ['cable', 'cables', 'machine'] },
  { name: 'Barbell Squat', equipment: ['barbell', 'squat rack'] },
  { name: 'Goblet Squat', equipment: ['dumbbell', 'dumbbells', 'kettlebell'] },
  { name: 'Leg Extension', equipment: ['leg extension', 'machine'] },
  { name: 'Hamstring Curl', equipment: ['hamstring curl', 'machine'] },
  { name: 'Dumbbell Romanian Deadlift', equipment: ['dumbbell', 'dumbbells'] },
] as const;

export function getWorkoutMovementChoices(environment?: { mode: string; equipment: string[] }): string[] {
  if (!environment || environment.mode === 'home') return [...HOME_MOVEMENTS];
  const supplied = environment.equipment.map((item) => item.trim().toLowerCase()).filter(Boolean);
  const equipmentMovements = supplied.length
    ? GYM_MOVEMENTS.filter((movement) => movement.equipment.some((alias) => supplied.some((item) => item.includes(alias))))
    : GYM_MOVEMENTS;
  return [...HOME_MOVEMENTS, ...equipmentMovements.map(({ name }) => name)];
}

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

function safeInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isInteger(parsed) ? parsed : null;
}

function movementKey(name: string): WorkoutRoutine['exercises'][number]['illustrationKey'] | null {
  const value = name.toLocaleLowerCase().replace(/[-_]/g, ' ');
  if (/bench press|leg press|cable crossover|lat pulldown|cable row|shoulder press|biceps? curl|triceps? pushdown|barbell squat|goblet squat|leg extension|hamstring curl|romanian deadlift/.test(value)) return 'gym_equipment';
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

  const title = safeText(candidate.title ?? candidate.name ?? candidate.workout_name, 90);
  const goal = safeText(candidate.goal ?? candidate.objective, 180);
  const durationMinutes = safeInteger(candidate.durationMinutes ?? candidate.duration_minutes ?? candidate.workoutDurationMinutes ?? candidate.duration);
  const rawExercises = candidate.exercises ?? candidate.workoutExercises ?? candidate.workout_exercises ?? candidate.movements;
  if (!title || !goal || durationMinutes === null || durationMinutes < 8 || durationMinutes > 75) return null;
  if (!Array.isArray(rawExercises) || rawExercises.length < 3 || rawExercises.length > 8) return null;

  const exercises: WorkoutRoutine['exercises'] = [];
  for (const [index, item] of rawExercises.entries()) {
    if (!item || typeof item !== 'object') return null;
    const name = safeText(item.name ?? item.exercise ?? item.exercise_name, 64);
    const tips = safeText(item.tips ?? item.formTips ?? item.form_tips ?? item.instructions, 220);
    const repsValue = safeInteger(item.targetReps ?? item.target_reps ?? item.reps);
    const durationValue = safeInteger(item.durationSeconds ?? item.duration_seconds ?? item.seconds ?? (typeof item.duration === 'number' || typeof item.duration === 'string' ? item.duration : undefined));
    const requestedType = typeof item.type === 'string' ? item.type.toLowerCase() : '';
    const quantityInferredType = repsValue !== null && durationValue === null
      ? 'reps'
      : durationValue !== null && repsValue === null
        ? 'timed'
        : '';
    const type = quantityInferredType || (['rep', 'reps', 'repetition', 'repetitions'].includes(requestedType)
      ? 'reps'
      : ['timed', 'time', 'duration', 'hold'].includes(requestedType)
        ? 'timed'
        : '');
    const restSeconds = safeInteger(item.restSeconds ?? item.rest_seconds ?? item.restPeriodSeconds ?? item.rest);
    const key = name ? movementKey(name) : null;
    if (!name || !tips || !key || restSeconds === null || restSeconds < 0 || restSeconds > 90) return null;
    const rawMuscles = item.targetMuscles ?? item.target_muscles ?? item.muscleGroups ?? item.muscle_groups ?? item.muscles;
    const muscleList = typeof rawMuscles === 'string' ? rawMuscles.split(',').map((muscle: string) => muscle.trim()) : rawMuscles;
    if (!Array.isArray(muscleList) || muscleList.length < 1 || muscleList.length > 4) return null;
    const targetMuscles = muscleList.map((muscle: unknown) => safeText(muscle, 32));
    if (targetMuscles.some((muscle: string | null) => !muscle)) return null;

    if (type === 'reps') {
      if (repsValue === null || repsValue < 1 || repsValue > 40) return null;
      exercises.push({
        id: `daily-${localDate}-${index + 1}`,
        name,
        type,
        targetReps: repsValue,
        restSeconds,
        targetMuscles: targetMuscles as string[],
        illustrationKey: key,
        tips,
      });
    } else if (type === 'timed') {
      if (durationValue === null || durationValue < 15 || durationValue > 120) return null;
      exercises.push({
        id: `daily-${localDate}-${index + 1}`,
        name,
        type,
        durationSeconds: durationValue,
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

export function buildWorkoutPrompt(
  profile: HunterProfile | null,
  stats: HunterStats,
  adjustment?: WorkoutPlanAdjustment,
  environment?: { mode: string; equipment: string[] },
): string {
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
  if (environment) {
    profileDetails.push(`Selected workout mode: ${environment.mode}`);
    profileDetails.push(`Available equipment supplied for this request: ${environment.equipment.length ? environment.equipment.join(', ') : environment.mode === 'gym' ? 'not specified; common gym equipment may be used' : 'none; home workout is bodyweight-only'}`);
  }

  const movementChoices = getWorkoutMovementChoices(environment);
  const gymMovementChoices = movementChoices.filter((name) => !(HOME_MOVEMENTS as readonly string[]).includes(name));
  const modeInstruction = !environment
    ? 'Available equipment was not recorded; use bodyweight movements only.'
    : environment.mode === 'gym'
    ? gymMovementChoices.length
      ? `This is Gym mode. Build an equipment-based workout: use at least 3 movements from this equipment-matched list in a 5–8 exercise plan: ${gymMovementChoices.join(', ')}. Bodyweight exercises can fill the remaining slots. Use only supplied equipment${environment.equipment.length ? ` (${environment.equipment.join(', ')})` : ' or common gym equipment'}.`
      : `This is Gym mode, but no supplied equipment matched a supported gym exercise (${environment.equipment.join(', ')}). Use bodyweight movements and do not invent equipment.`
    : 'This is Home mode: use bodyweight movements only and no equipment.';

  return [
    `Create one safe, practical workout for today using the profile details below only when provided${adjustment ? `, targeting ${adjustment.targetFocus}` : ''}.`,
    'Treat BMI as optional context, never as the sole factor for exercise selection. Scale for the stated fitness level and include sensible rests.',
    'Do not prescribe medical treatment or extreme exertion. Use the selected equipment only when it is available, and keep movements within the supported exercise list.',
    'Return only a JSON object with title, goal, durationMinutes, and exercises.',
    `Each exercise name must be selected from this mode- and equipment-matched list: ${movementChoices.join(', ')}.`,
    'Each exercise must contain type (reps or timed), targetReps and durationSeconds (put a JSON null in the unused quantity; reps requires an integer targetReps from 1 to 40 and null durationSeconds, while timed requires null targetReps and an integer durationSeconds from 15 to 120), restSeconds from 0 to 90, targetMuscles (1-4 short strings), and concise tips.',
    'Use 3-8 exercises and workout duration 8-75 minutes. Do not include XP, rewards, stats, quests, or profile mutations.',
    'Available profile context:',
    profileDetails.length ? profileDetails.join('\n') : environment?.mode === 'gym'
      ? 'No saved onboarding details are available; make a conservative beginner gym plan using common equipment and bodyweight.'
      : 'No saved onboarding details are available; make a conservative beginner bodyweight plan.',
    `Current Hunter stats: strength ${stats.strength}, health ${stats.health}, discipline ${stats.discipline}`,
    modeInstruction,
    adjustment ? `Match requested duration (${adjustment.durationMinutes} minutes), difficulty (${adjustment.difficulty}), and target focus (${adjustment.targetFocus}).` : '',
  ].join('\n');
}
