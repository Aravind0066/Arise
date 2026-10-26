export type StatType = 'strength' | 'knowledge' | 'discipline' | 'health' | 'mindfulness';

export interface HunterStats {
  strength: number;     // 0 - 100
  knowledge: number;    // 0 - 100
  discipline: number;   // 0 - 100
  health: number;       // 0 - 100
  mindfulness: number;  // 0 - 100
}

export type HunterRank = 'E-Rank' | 'D-Rank' | 'C-Rank' | 'B-Rank' | 'A-Rank' | 'S-Rank' | 'National Level';

export interface HunterProfile {
  _id: string;
  name: string;
  email: string;
  title: string;
  rank: HunterRank;
  height: number;       // cm
  weight: number;       // kg
  age: number;
  primaryGoal: string;
  fitnessLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  studyFocus: string;
  weakness: string;
  restDay: string;      // e.g. "Sunday"
  xp: number;
  level: number;
  onboarded: boolean;
  theme: 'system-blue' | 'shadow-red' | 'minimal' | 'matrix';
  morningProtocolDoneToday?: boolean;
  streakDays: number;
  lastActiveDate: string;
  createdAt: string;
}

export interface HunterQuest {
  _id: string;
  title: string;
  description: string;
  category: 'Fitness' | 'Study' | 'Discipline' | 'Health' | 'Mindfulness' | 'General';
  targetStat: StatType;
  statBonus: number;
  xpReward: number;
  deadline: string;
  generatedBy: 'system' | 'user' | 'ai';
  status: 'active' | 'completed' | 'expired';
  completedAt?: string;
}

export interface CompletedLog {
  _id: string;
  questId?: string;
  title: string;
  category: string;
  xpEarned: number;
  statRaised: StatType;
  statBonus: number;
  completedAt: string;
}

export interface WorkoutLog {
  _id: string;
  routineId?: string;
  workoutName: string;
  exercisesCompleted: number;
  totalExercises: number;
  durationSeconds: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  notes?: string;
  createdAt: string;
}

export type ExerciseIllustrationType =
  | 'pushup'
  | 'squat'
  | 'plank'
  | 'jumping_jack'
  | 'lunge'
  | 'mountain_climber'
  | 'pullup'
  | 'burpee'
  | 'crunch'
  | 'rest';

export interface Exercise {
  id: string;
  name: string;
  type: 'reps' | 'timed';
  targetReps?: number;
  durationSeconds?: number;
  restSeconds: number;
  targetMuscles: string[];
  illustrationKey: ExerciseIllustrationType;
  tips: string;
}

export interface WorkoutRoutine {
  id: string;
  title: string;
  codeName: string;
  rankRequirement: HunterRank;
  goal: string;
  durationMinutes: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  equipment: 'None (Bodyweight)' | 'Dumbbells / Basic' | 'Full Gym';
  targetStat: StatType;
  statBonus: number;
  xpReward: number;
  exercises: Exercise[];
}

export interface JournalEntry {
  _id: string;
  wentWell: string;
  heldBack: string;
  improveTomorrow: string;
  moodRating: number;   // 1 - 10
  stressRating: number; // 1 - 10
  energyRating: number; // 1 - 10
  createdAt: string;
}

export interface ScreenTimeRecord {
  unlocks: number;
  reelsMinutes: number;
  productiveMinutes: number;
  lastWarningAt?: string;
  updatedAt: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'Fitness' | 'Study' | 'Discipline' | 'Health' | 'Mindfulness' | 'System';
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
}
