import type { Exercise, HunterProfile, WorkoutRoutine } from './hunterTypes';

export const WORKOUT_ROUTINES: WorkoutRoutine[] = [
  {
    id: 'shadow-awakening',
    title: 'SHADOW AWAKENING PROTOCOL',
    codeName: 'E-RANK GATE CLEAR',
    rankRequirement: 'E-Rank',
    goal: 'Full-body foundational calisthenics & conditioning',
    durationMinutes: 14,
    difficulty: 'Beginner',
    equipment: 'None (Bodyweight)',
    targetStat: 'strength',
    statBonus: 4,
    xpReward: 70,
    exercises: [
      {
        id: 'sa-1',
        name: 'Shadow Jumping Jacks',
        type: 'timed',
        durationSeconds: 40,
        restSeconds: 20,
        targetMuscles: ['Cardio', 'Calves', 'Shoulders'],
        illustrationKey: 'jumping_jack',
        tips: 'Keep light on your feet, breathing rhythmically to activate nervous system.',
      },
      {
        id: 'sa-2',
        name: 'Form-Locked Push-Ups',
        type: 'reps',
        targetReps: 12,
        restSeconds: 30,
        targetMuscles: ['Chest', 'Triceps', 'Anterior Delts'],
        illustrationKey: 'pushup',
        tips: 'Keep core tight, elbows tucked at 45 degrees, full lockout at top.',
      },
      {
        id: 'sa-3',
        name: 'Dungeon Bodyweight Squats',
        type: 'reps',
        targetReps: 15,
        restSeconds: 30,
        targetMuscles: ['Quadriceps', 'Glutes', 'Hamstrings'],
        illustrationKey: 'squat',
        tips: 'Drive through mid-foot, hips below parallel, chest elevated.',
      },
      {
        id: 'sa-4',
        name: 'Hunter Mountain Climbers',
        type: 'timed',
        durationSeconds: 35,
        restSeconds: 25,
        targetMuscles: ['Core', 'Hip Flexors', 'Shoulders'],
        illustrationKey: 'mountain_climber',
        tips: 'Drive knees forcefully toward chest without arching lower back.',
      },
      {
        id: 'sa-5',
        name: 'Alternating Forward Lunges',
        type: 'reps',
        targetReps: 14,
        restSeconds: 25,
        targetMuscles: ['Quadriceps', 'Glutes', 'Balance'],
        illustrationKey: 'lunge',
        tips: 'Step decisively, back knee hovering 1 inch off floor.',
      },
      {
        id: 'sa-6',
        name: 'Monarch Iron Plank Hold',
        type: 'timed',
        durationSeconds: 45,
        restSeconds: 30,
        targetMuscles: ['Rectus Abdominis', 'Transverse Abdominis', 'Glutes'],
        illustrationKey: 'plank',
        tips: 'Contract glutes and squeeze abdomen as if anticipating a blow.',
      },
    ],
  },
  {
    id: 'gate-raid-strength',
    title: 'DUNGEON RAID: STRENGTH MATRIX',
    codeName: 'C-RANK UPPER POWER',
    rankRequirement: 'C-Rank',
    goal: 'Upper body hypertrophic power & explosive push strength',
    durationMinutes: 18,
    difficulty: 'Intermediate',
    equipment: 'None (Bodyweight)',
    targetStat: 'strength',
    statBonus: 5,
    xpReward: 85,
    exercises: [
      {
        id: 'gr-1',
        name: 'Dynamic Push-Ups',
        type: 'reps',
        targetReps: 15,
        restSeconds: 30,
        targetMuscles: ['Pectorals', 'Triceps', 'Shoulders'],
        illustrationKey: 'pushup',
        tips: 'Explode upward on the concentric phase with maximum velocity.',
      },
      {
        id: 'gr-2',
        name: 'Isometric Plank Hold',
        type: 'timed',
        durationSeconds: 50,
        restSeconds: 25,
        targetMuscles: ['Core', 'Obliques', 'Serratus'],
        illustrationKey: 'plank',
        tips: 'Maintain completely horizontal lumbar spine, actively breathing.',
      },
      {
        id: 'gr-3',
        name: 'Diamond Triceps Press',
        type: 'reps',
        targetReps: 12,
        restSeconds: 35,
        targetMuscles: ['Triceps Brachii', 'Inner Chest'],
        illustrationKey: 'pushup',
        tips: 'Hands touch index-to-thumb in diamond position under sternum.',
      },
      {
        id: 'gr-4',
        name: 'Shadow Burpee Thrusters',
        type: 'reps',
        targetReps: 10,
        restSeconds: 35,
        targetMuscles: ['Full Body', 'Cardio', 'Power'],
        illustrationKey: 'burpee',
        tips: 'Smooth flow from chest-to-ground into an explosive vertical jump.',
      },
      {
        id: 'gr-5',
        name: 'High-Tempo Mountain Climbers',
        type: 'timed',
        durationSeconds: 40,
        restSeconds: 30,
        targetMuscles: ['Core', 'Heart Rate', 'Shoulders'],
        illustrationKey: 'mountain_climber',
        tips: 'Sustain maximum turnover rate without compromising shoulder position.',
      },
      {
        id: 'gr-6',
        name: 'Final Stand Plank Seal',
        type: 'timed',
        durationSeconds: 60,
        restSeconds: 0,
        targetMuscles: ['Full Core', 'Mental Fortitude'],
        illustrationKey: 'plank',
        tips: 'Do not drop your knees. Lock out until the system timer terminates.',
      },
    ],
  },
  {
    id: 'monarch-agility',
    title: "MONARCH'S GAUNTLET // AGILITY & ENDURANCE",
    codeName: 'B-RANK HIGH TEMPO',
    rankRequirement: 'B-Rank',
    goal: 'High-intensity conditioning, lung capacity & anaerobic threshold',
    durationMinutes: 16,
    difficulty: 'Advanced',
    equipment: 'None (Bodyweight)',
    targetStat: 'health',
    statBonus: 5,
    xpReward: 90,
    exercises: [
      {
        id: 'mg-1',
        name: 'High-Velocity Jumping Jacks',
        type: 'timed',
        durationSeconds: 45,
        restSeconds: 15,
        targetMuscles: ['Cardiovascular Matrix', 'Calves'],
        illustrationKey: 'jumping_jack',
        tips: 'Rapid cadence, full arm sweep over head.',
      },
      {
        id: 'mg-2',
        name: 'Rapid Squats',
        type: 'reps',
        targetReps: 20,
        restSeconds: 25,
        targetMuscles: ['Quadriceps', 'Glutes'],
        illustrationKey: 'squat',
        tips: 'Rhythmic pumping without locking out knees at the top.',
      },
      {
        id: 'mg-3',
        name: 'Burst Mountain Climbers',
        type: 'timed',
        durationSeconds: 45,
        restSeconds: 20,
        targetMuscles: ['Core', 'Hip Flexors'],
        illustrationKey: 'mountain_climber',
        tips: 'Maximum knee drive velocity.',
      },
      {
        id: 'mg-4',
        name: 'Walking Lunge Strides',
        type: 'reps',
        targetReps: 16,
        restSeconds: 25,
        targetMuscles: ['Glutes', 'Hamstrings', 'Quads'],
        illustrationKey: 'lunge',
        tips: 'Long stride for glute activation, stay tall.',
      },
      {
        id: 'mg-5',
        name: 'Full Dungeon Burpees',
        type: 'reps',
        targetReps: 12,
        restSeconds: 30,
        targetMuscles: ['Full Body Anaerobic Engine'],
        illustrationKey: 'burpee',
        tips: 'Hit chest to ground, jump with arms reaching for ceiling.',
      },
      {
        id: 'mg-6',
        name: 'Iron Plank Lockdown',
        type: 'timed',
        durationSeconds: 50,
        restSeconds: 0,
        targetMuscles: ['Core', 'Stabilizers'],
        illustrationKey: 'plank',
        tips: 'Steady, deep breathing while maintaining rigidity.',
      },
    ],
  },
  {
    id: 'iron-core-bastion',
    title: 'IRON CORE // SPINAL & TRUNK FORTRESS',
    codeName: 'D-RANK RESILIENCE',
    rankRequirement: 'D-Rank',
    goal: 'Core stiffness, anti-rotational stability & posture realignment',
    durationMinutes: 12,
    difficulty: 'Beginner',
    equipment: 'None (Bodyweight)',
    targetStat: 'discipline',
    statBonus: 4,
    xpReward: 65,
    exercises: [
      {
        id: 'ic-1',
        name: 'Standard Elbow Plank',
        type: 'timed',
        durationSeconds: 45,
        restSeconds: 20,
        targetMuscles: ['Deep Core', 'Transverse Abdominis'],
        illustrationKey: 'plank',
        tips: 'Neutral cervical spine, eyes looking between hands.',
      },
      {
        id: 'ic-2',
        name: 'Cross-Body Mountain Climbers',
        type: 'reps',
        targetReps: 16,
        restSeconds: 25,
        targetMuscles: ['Obliques', 'Serratus Anterior'],
        illustrationKey: 'mountain_climber',
        tips: 'Right knee drives toward left elbow, left knee to right elbow.',
      },
      {
        id: 'ic-3',
        name: 'Rhythmic Abdominal Crunches',
        type: 'reps',
        targetReps: 18,
        restSeconds: 25,
        targetMuscles: ['Upper Abdominals'],
        illustrationKey: 'crunch',
        tips: 'Peel shoulder blades off floor, do not pull on neck.',
      },
      {
        id: 'ic-4',
        name: 'Static Core Plank Hold',
        type: 'timed',
        durationSeconds: 40,
        restSeconds: 20,
        targetMuscles: ['Full Midsection'],
        illustrationKey: 'plank',
        tips: 'Maintain absolute tension from heels to crown.',
      },
    ],
  },
];

/**
 * Returns a workout routine tailored to the hunter's profile attributes.
 */
export function getPersonalizedWorkout(
  profile?: HunterProfile | null,
  requestedRoutineId?: string
): WorkoutRoutine {
  if (requestedRoutineId) {
    const found = WORKOUT_ROUTINES.find((r) => r.id === requestedRoutineId);
    if (found) return adaptRoutineToProfile(found, profile);
  }

  // Personalization logic based on profile
  const goal = (profile?.primaryGoal || '').toLowerCase();
  const fitnessLevel = profile?.fitnessLevel || 'Beginner';

  let selected: WorkoutRoutine = WORKOUT_ROUTINES[0];

  if (goal.includes('strength') || goal.includes('muscle') || goal.includes('power')) {
    selected = WORKOUT_ROUTINES[1]; // Upper Strength
  } else if (goal.includes('fat') || goal.includes('endurance') || goal.includes('cardio') || goal.includes('physique')) {
    selected = WORKOUT_ROUTINES[2]; // Agility / HIIT
  } else if (goal.includes('discipline') || goal.includes('core') || goal.includes('posture')) {
    selected = WORKOUT_ROUTINES[3]; // Iron Core
  } else if (fitnessLevel === 'Advanced') {
    selected = WORKOUT_ROUTINES[2];
  } else if (fitnessLevel === 'Intermediate') {
    selected = WORKOUT_ROUTINES[1];
  } else {
    selected = WORKOUT_ROUTINES[0];
  }

  return adaptRoutineToProfile(selected, profile);
}

/**
 * Scales rep counts and durations based on profile fitness level
 */
function adaptRoutineToProfile(routine: WorkoutRoutine, profile?: HunterProfile | null): WorkoutRoutine {
  const level = profile?.fitnessLevel || 'Intermediate';

  const adaptedExercises: Exercise[] = routine.exercises.map((ex) => {
    let reps = ex.targetReps;
    let dur = ex.durationSeconds;

    if (level === 'Beginner') {
      if (reps) reps = Math.max(8, Math.round(reps * 0.75));
      if (dur) dur = Math.max(25, Math.round(dur * 0.8));
    } else if (level === 'Advanced') {
      if (reps) reps = Math.round(reps * 1.3);
      if (dur) dur = Math.min(75, Math.round(dur * 1.25));
    }

    return {
      ...ex,
      targetReps: reps,
      durationSeconds: dur,
    };
  });

  return {
    ...routine,
    exercises: adaptedExercises,
  };
}

export function getAllRoutines(): WorkoutRoutine[] {
  return WORKOUT_ROUTINES;
}
