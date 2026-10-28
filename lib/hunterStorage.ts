import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Achievement,
  CompletedLog,
  HunterProfile,
  HunterQuest,
  HunterRank,
  HunterStats,
  JournalEntry,
  ScreenTimeRecord,
  StatType,
  WorkoutRoutine,
  WorkoutLog,
  NutritionHistoryRecord,
  HunterChatConversation,
  WeaknessRecommendation,
  WorkoutPreferences,
} from './hunterTypes';
import { getQuestStatusAt, hasMeaningfulVerification } from './questRules';
import { createRewardClaimer } from './rewardClaims';
import { createGoalProgress, createGoalProgressStore, type GoalProgress } from './goalProgress';
import { upsertWorkoutPlanHistory } from './workoutPlanHistory';
import { createWorkoutPreferencesStore } from './workoutGenerationContext';
import { createNutritionHistoryStore, createNutritionPreferencesStore, type NutritionPreferences } from './nutritionGeneration';

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'awakening', title: 'The Awakening', description: 'Complete the Hunter baseline assessment', category: 'System', icon: '⚡', unlocked: false },
  { id: 'first_blood', title: 'First Dungeon Raid', description: 'Complete a guided workout raid', category: 'Fitness', icon: '⚔️', unlocked: false },
  { id: 'scholar', title: "Scholar's Path", description: 'Complete a focused Pomodoro study block', category: 'Study', icon: '📜', unlocked: false },
  { id: 'iron_mind', title: 'Iron Mind', description: 'Complete morning system protocol', category: 'Discipline', icon: '🛡️', unlocked: false },
  { id: 'hydrated', title: 'Hydrated Hunter', description: 'Execute daily 3L hydration matrix', category: 'Health', icon: '💧', unlocked: false },
  { id: 'inner_system', title: 'Inner System', description: 'Log daily 3-prompt introspection journal', category: 'Mindfulness', icon: '🧘', unlocked: false },
  { id: 'digital_detox', title: 'Digital Sovereign', description: 'Defeat doom scroll with under 15m reels', category: 'Discipline', icon: '📱', unlocked: false },
  { id: 'elite', title: 'System Elite', description: 'Reach Hunter Level 10', category: 'System', icon: '👑', unlocked: false },
];

export const INITIAL_QUESTS: HunterQuest[] = [
  {
    _id: 'default_strength',
    title: 'DUNGEON RAID // SHADOW WORKOUT PROTOCOL',
    description: 'Enter the workout chamber and complete a full guided movement sequence.',
    category: 'Fitness',
    targetStat: 'strength',
    statBonus: 4,
    xpReward: 80,
    deadline: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    generatedBy: 'system',
    status: 'active',
  },
  {
    _id: 'default_deepwork',
    title: 'KNOWLEDGE ACQUISITION // POMODORO STUDY',
    description: 'Immerse in deep learning or coding block with zero distraction.',
    category: 'Study',
    targetStat: 'knowledge',
    statBonus: 4,
    xpReward: 75,
    deadline: new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString(),
    generatedBy: 'system',
    status: 'active',
  },
  {
    _id: 'default_sunlight',
    title: 'SUNLIGHT PROTOCOL // 10 MIN MORNING SUN',
    description: 'Expose eyes and skin to natural morning sunlight. Calibrates circadian rhythm & dopamine.',
    category: 'Health',
    targetStat: 'health',
    statBonus: 3,
    xpReward: 30,
    deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    generatedBy: 'system',
    status: 'active',
  },
  {
    _id: 'default_hydration',
    title: 'HYDRATION MATRIX // 3L WATER PROTOCOL',
    description: 'Complete 3000ml pure water intake today. Drink first 1L before noon.',
    category: 'Health',
    targetStat: 'health',
    statBonus: 3,
    xpReward: 35,
    deadline: new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString(),
    generatedBy: 'system',
    status: 'active',
  },
  {
    _id: 'default_discipline',
    title: 'SOVEREIGN DISCIPLINE // REELS DETOX',
    description: 'Keep short-form video consumption under 15 minutes today. Defeat algorithmic capture.',
    category: 'Discipline',
    targetStat: 'discipline',
    statBonus: 3,
    xpReward: 45,
    deadline: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
    generatedBy: 'system',
    status: 'active',
  },
  {
    _id: 'default_journal',
    title: '3-Prompt Journal',
    description: 'Reflect on wins, friction points, and tomorrow’s mission in the Journal module.',
    category: 'Mindfulness',
    targetStat: 'mindfulness',
    statBonus: 3,
    xpReward: 35,
    deadline: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
    generatedBy: 'system',
    status: 'active',
  },
];

const PROFILE_KEY = 'hunteros.profile.v2';
const STATS_KEY = 'hunteros.stats.v2';
const QUESTS_KEY = 'hunteros.quests.v2';
const HISTORY_KEY = 'hunteros.history.v2';
const JOURNAL_KEY = 'hunteros.journal.v2';
const WORKOUT_KEY = 'hunteros.workout.v2';
const ACHIEVEMENTS_KEY = 'hunteros.achievements.v2';
const SCREENTIME_KEY = 'hunteros.screentime.v2';
const DAILY_WORKOUT_PLAN_KEY = 'hunteros.dailyWorkoutPlan.v1';
const WORKOUT_PLANS_KEY = 'hunteros.workoutPlans.v1';
const NUTRITION_HISTORY_KEY = 'hunteros.nutritionHistory.v1';
const NUTRITION_PREFERENCES_KEY = 'hunteros.nutritionPreferences.v1';
const CHAT_CONVERSATIONS_KEY = 'hunteros.chat.conversations.v1';
const ACTIVE_CHAT_KEY = 'hunteros.chat.active.v1';
const QUEST_RECOMMENDATIONS_KEY = 'hunteros.questRecommendations.v1';
const REWARD_CLAIMS_KEY = 'hunteros.rewardClaims.v1';
const ONBOARDING_DRAFT_KEY = 'hunteros.onboardingDraft.v1';
export const GOAL_PROGRESS_KEY = 'hunteros.goalProgress.v1';

const goalProgressStore = createGoalProgressStore(AsyncStorage, GOAL_PROGRESS_KEY);

export async function getGoalProgress(profileGoal: string): Promise<GoalProgress> {
  try {
    return await goalProgressStore.load(profileGoal);
  } catch (error) {
    console.warn('Failed to load goal progress:', error);
    return createGoalProgress(profileGoal);
  }
}

export function saveGoalProgress(goal: GoalProgress): Promise<void> {
  return goalProgressStore.save(goal);
}

const claimRewardOnce = createRewardClaimer(AsyncStorage, REWARD_CLAIMS_KEY);

export interface SavedDailyWorkoutPlan {
  localDate: string;
  createdAt?: string;
  restDay: string;
  isRestDay: boolean;
  routine: WorkoutRoutine | null;
  source: 'ai' | 'ollama' | 'fallback' | 'rest';
  message?: string;
  completedAt?: string;
  mode?: WorkoutPreferences['mode'];
  equipment?: string[];
  contextSnapshot?: Record<string, unknown>;
  completedExerciseIds?: string[];
}

const WORKOUT_PREFERENCES_KEY = 'hunteros.workoutPreferences.v1';
const workoutPreferencesStore = createWorkoutPreferencesStore(AsyncStorage, WORKOUT_PREFERENCES_KEY);
export async function getWorkoutPreferences(): Promise<WorkoutPreferences> {
  return workoutPreferencesStore.load();
}
export async function saveWorkoutPreferences(value: WorkoutPreferences): Promise<void> {
  await workoutPreferencesStore.save(value);
}

export async function getSavedDailyWorkoutPlan(): Promise<SavedDailyWorkoutPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_WORKOUT_PLAN_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value.localDate !== 'string' || typeof value.restDay !== 'string' || !['ai', 'ollama', 'fallback', 'rest'].includes(value.source)) return null;
    if (!value.isRestDay && (!value.routine || !Array.isArray(value.routine.exercises))) return null;
    return value as SavedDailyWorkoutPlan;
  } catch (err) {
    console.warn('Failed to load daily workout plan:', err);
    return null;
  }
}

export async function saveDailyWorkoutPlan(plan: SavedDailyWorkoutPlan): Promise<void> {
  const persistedPlan = { ...plan, createdAt: plan.createdAt || new Date().toISOString() };
  await AsyncStorage.setItem(DAILY_WORKOUT_PLAN_KEY, JSON.stringify(persistedPlan));
  if (persistedPlan.routine) {
    const history = await getWorkoutPlanHistory();
    await AsyncStorage.setItem(WORKOUT_PLANS_KEY, JSON.stringify(upsertWorkoutPlanHistory(history, persistedPlan)));
  }
}

export async function getWorkoutPlanHistory(): Promise<Array<{ id: string; createdAt: string; plan: SavedDailyWorkoutPlan }>> {
  try {
    const raw = await AsyncStorage.getItem(WORKOUT_PLANS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const history: Array<{ id: string; createdAt: string; plan: SavedDailyWorkoutPlan }> = Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.id === 'string' && entry.plan && typeof entry.plan.localDate === 'string') : [];
    const current = await getSavedDailyWorkoutPlan();
    if (current?.routine) {
      const migrated = upsertWorkoutPlanHistory(history, current);
      if (migrated !== history) {
        await AsyncStorage.setItem(WORKOUT_PLANS_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
    return history;
  }
  catch (error) { console.warn('Failed to load workout plan history:', error); return []; }
}

export async function getNutritionHistory(): Promise<NutritionHistoryRecord[]> {
  return nutritionHistoryStore.load();
}

export async function saveNutritionHistoryRecord(record: Omit<NutritionHistoryRecord, 'id' | 'createdAt'> & Partial<Pick<NutritionHistoryRecord, 'id' | 'createdAt'>>): Promise<NutritionHistoryRecord> {
  return nutritionHistoryStore.append(record);
}

const nutritionPreferencesStore = createNutritionPreferencesStore(AsyncStorage, NUTRITION_PREFERENCES_KEY);
const nutritionHistoryStore = createNutritionHistoryStore(AsyncStorage, NUTRITION_HISTORY_KEY);
export function getNutritionPreferences(): Promise<NutritionPreferences> { return nutritionPreferencesStore.load(); }
export function saveNutritionPreferences(value: NutritionPreferences): Promise<void> { return nutritionPreferencesStore.save(value); }

export async function getChatConversations(): Promise<HunterChatConversation[]> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_CONVERSATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((conversation) => conversation && typeof conversation.id === 'string' && Array.isArray(conversation.messages)).map((conversation) => ({
      ...conversation,
      title: typeof conversation.title === 'string' ? conversation.title : 'New chat',
      createdAt: typeof conversation.createdAt === 'string' ? conversation.createdAt : new Date().toISOString(),
      updatedAt: typeof conversation.updatedAt === 'string' ? conversation.updatedAt : new Date().toISOString(),
      messages: conversation.messages.filter((message: unknown) => {
        const item = message as Record<string, unknown>;
        return item && typeof item.id === 'string' && ['user', 'assistant', 'error'].includes(String(item.role)) && typeof item.content === 'string';
      }),
    })) : [];
  }
  catch (error) { console.warn('Failed to load chat conversations:', error); return []; }
}

export async function getActiveChatId(): Promise<string | null> { return AsyncStorage.getItem(ACTIVE_CHAT_KEY); }
export async function setActiveChatId(id: string | null): Promise<void> {
  if (id) await AsyncStorage.setItem(ACTIVE_CHAT_KEY, id); else await AsyncStorage.removeItem(ACTIVE_CHAT_KEY);
}

export async function saveChatConversation(conversation: HunterChatConversation): Promise<void> {
  const conversations = await getChatConversations();
  const index = conversations.findIndex((item) => item.id === conversation.id);
  if (index < 0) conversations.unshift(conversation); else conversations[index] = conversation;
  conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  await AsyncStorage.setItem(CHAT_CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export async function appendChatMessage(conversationId: string, message: HunterChatConversation['messages'][number]): Promise<void> {
  const conversations = await getChatConversations();
  const index = conversations.findIndex((item) => item.id === conversationId);
  if (index < 0) return;
  const conversation = conversations[index];
  if (conversation.messages.some((item) => item.id === message.id)) return;
  const messages = [...conversation.messages, message];
  const title = conversation.title === 'New chat' && message.role === 'user'
    ? message.content.trim().slice(0, 52) || 'New chat'
    : conversation.title;
  conversations[index] = { ...conversation, title, messages, updatedAt: message.createdAt };
  conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  await AsyncStorage.setItem(CHAT_CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export async function deleteChatConversation(id: string): Promise<HunterChatConversation[]> {
  const conversations = (await getChatConversations()).filter((item) => item.id !== id);
  await AsyncStorage.setItem(CHAT_CONVERSATIONS_KEY, JSON.stringify(conversations));
  if (await getActiveChatId() === id) await setActiveChatId(conversations[0]?.id || null);
  return conversations;
}

export async function getSavedWeaknessRecommendations(): Promise<{ recommendations: WeaknessRecommendation[]; skipped: string[] }> {
  try {
    const raw = await AsyncStorage.getItem(QUEST_RECOMMENDATIONS_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return {
      recommendations: Array.isArray(saved.recommendations) ? saved.recommendations : [],
      skipped: Array.isArray(saved.skipped) ? saved.skipped.filter((title: unknown) => typeof title === 'string') : [],
    };
  } catch (error) { console.warn('Failed to load saved recommendations:', error); return { recommendations: [], skipped: [] }; }
}

export async function saveWeaknessRecommendations(value: { recommendations: WeaknessRecommendation[]; skipped: string[] }): Promise<void> {
  await AsyncStorage.setItem(QUEST_RECOMMENDATIONS_KEY, JSON.stringify(value));
}

export const XP_PER_LEVEL = 500;

export interface OnboardingDraft {
  step: 'welcome' | 'baseline' | 'goals' | 'analysis' | 'identity';
  name: string;
  height: string;
  weight: string;
  age: string;
  primaryGoal: string;
  fitnessLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  studyFocus: string;
  weakness: string;
  restDay: string;
  generatedResult?: { stats: HunterStats; title: string };
}

export async function getOnboardingDraft(): Promise<OnboardingDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Failed to parse onboarding draft:', err);
    return null;
  }
}

export async function saveOnboardingDraft(draft: OnboardingDraft): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
}

export async function clearOnboardingDraft(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
}

export function getRankFromLevel(level: number): HunterRank {
  if (level >= 50) return 'National Level';
  if (level >= 35) return 'S-Rank';
  if (level >= 25) return 'A-Rank';
  if (level >= 15) return 'B-Rank';
  if (level >= 8) return 'C-Rank';
  if (level >= 4) return 'D-Rank';
  return 'E-Rank';
}

export function calculateStartingAttributes(data: {
  height: number;
  weight: number;
  age: number;
  fitnessLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  primaryGoal: string;
  studyFocus: string;
  weakness: string;
}): { stats: HunterStats; title: string } {
  let strength = 30;
  let knowledge = 35;
  let discipline = 30;
  let health = 40;
  let mindfulness = 35;

  if (data.fitnessLevel === 'Advanced') strength += 25;
  else if (data.fitnessLevel === 'Intermediate') strength += 15;
  else strength += 5;

  const goalLower = data.primaryGoal.toLowerCase();
  if (goalLower.includes('muscle') || goalLower.includes('fat') || goalLower.includes('physique') || goalLower.includes('strength')) {
    strength += 15;
    health += 10;
  }
  if (goalLower.includes('code') || goalLower.includes('dsa') || goalLower.includes('exam') || goalLower.includes('study')) {
    knowledge += 20;
    discipline += 10;
  }
  if (goalLower.includes('discipline') || goalLower.includes('habits') || goalLower.includes('focus')) {
    discipline += 15;
    mindfulness += 10;
  }

  const weaknessLower = data.weakness.toLowerCase();
  if (weaknessLower.includes('reel') || weaknessLower.includes('scroll') || weaknessLower.includes('phone')) {
    discipline = Math.max(20, discipline - 8);
  }
  if (weaknessLower.includes('sleep') || weaknessLower.includes('energy')) {
    health = Math.max(20, health - 8);
  }
  if (weaknessLower.includes('procrastinat')) {
    mindfulness = Math.max(20, mindfulness - 5);
  }

  let title = 'The Awakened Hunter';
  if (strength >= 55) title = 'The Unforged Warrior';
  else if (knowledge >= 50) title = 'The Analytical Seeker';
  else if (discipline >= 50) title = 'The Iron-Willed';
  else if (health >= 50) title = 'The Resilient Vessel';
  else if (mindfulness >= 45) title = 'The Centered Mind';

  return {
    stats: {
      strength: Math.min(100, Math.max(15, strength)),
      knowledge: Math.min(100, Math.max(15, knowledge)),
      discipline: Math.min(100, Math.max(15, discipline)),
      health: Math.min(100, Math.max(15, health)),
      mindfulness: Math.min(100, Math.max(15, mindfulness)),
    },
    title,
  };
}

export function createDefaultProfile(): HunterProfile {
  return {
    _id: 'hunter_local',
    name: 'Jin-Woo',
    email: 'hunter@system.io',
    title: 'The Awakened Hunter',
    rank: 'E-Rank',
    height: 175,
    weight: 70,
    age: 21,
    primaryGoal: 'Ascension & Conditioning',
    fitnessLevel: 'Beginner',
    studyFocus: 'System Algorithms & DSA',
    weakness: 'Distraction & Fatigue',
    restDay: 'Sunday',
    xp: 0,
    level: 1,
    onboarded: true,
    theme: 'system-blue',
    streakDays: 1,
    lastActiveDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

export async function getHunterProfile(): Promise<HunterProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse hunter profile, resetting safely:', err);
    return null;
  }
}

export async function saveHunterProfile(profile: HunterProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save hunter profile:', err);
  }
}

export async function getHunterStats(): Promise<HunterStats> {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse stats:', err);
  }
  return { strength: 35, knowledge: 40, discipline: 30, health: 45, mindfulness: 35 };
}

export async function saveHunterStats(stats: HunterStats): Promise<void> {
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (err) {
    console.error('Failed to save stats:', err);
  }
}

export async function getHunterQuests(): Promise<HunterQuest[]> {
  try {
    const raw = await AsyncStorage.getItem(QUESTS_KEY);
    if (raw) {
      const quests: HunterQuest[] = JSON.parse(raw);
      const normalized = quests.map((quest) => ({ ...quest, status: getQuestStatusAt(quest) }));
      if (normalized.some((quest, index) => quest.status !== quests[index].status)) {
        await saveHunterQuests(normalized);
      }
      return normalized;
    }
  } catch (err) {
    console.warn('Failed to parse quests:', err);
  }

  const now = Date.now();
  const freshQuests: HunterQuest[] = INITIAL_QUESTS.map((q, i) => ({
    ...q,
    deadline: new Date(now + (10 + i * 2) * 60 * 60 * 1000).toISOString(),
  }));
  await saveHunterQuests(freshQuests);
  return freshQuests;
}

export async function saveHunterQuests(quests: HunterQuest[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUESTS_KEY, JSON.stringify(quests));
  } catch (err) {
    console.error('Failed to save quests:', err);
  }
}

export async function addHunterQuests(newQuests: HunterQuest[]): Promise<HunterQuest[]> {
  const current = await getHunterQuests();
  const combined = [...newQuests, ...current];
  await saveHunterQuests(combined);
  return combined;
}

export async function getHunterHistory(): Promise<CompletedLog[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to parse history:', err);
    return [];
  }
}

export async function saveHunterHistory(history: CompletedLog[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

/**
 * Completes a quest directive exactly once, preventing duplicate rewards.
 */
export async function completeHunterQuest(questId: string, verificationNote: string): Promise<{
  profile: HunterProfile;
  stats: HunterStats;
  quest: HunterQuest;
  unlockedAchievement?: Achievement;
}> {
  const quests = await getHunterQuests();
  const targetIndex = quests.findIndex((q) => q._id === questId);
  if (targetIndex === -1) {
    throw new Error('Quest directive not found');
  }

  const quest = quests[targetIndex];
  if (quest.status === 'completed') {
    throw new Error('Quest directive has already been completed.');
  }
  if (getQuestStatusAt(quest) === 'expired') {
    quest.status = 'expired';
    quests[targetIndex] = quest;
    await saveHunterQuests(quests);
    throw new Error('This quest has expired and cannot be completed.');
  }
  if (!hasMeaningfulVerification(verificationNote)) {
    throw new Error('Add a meaningful verification note (at least 8 characters).');
  }
  if (!(await claimRewardOnce(`quest:${questId}`))) {
    throw new Error('Quest directive has already been completed.');
  }

  quest.status = 'completed';
  quest.completedAt = new Date().toISOString();
  quests[targetIndex] = quest;
  await saveHunterQuests(quests);

  // Update Stats
  const stats = await getHunterStats();
  const targetStat: StatType = quest.targetStat || 'discipline';
  const bonus = quest.statBonus || 3;
  stats[targetStat] = Math.min(100, stats[targetStat] + bonus);
  await saveHunterStats(stats);

  // Update Profile XP & Level
  let profile = (await getHunterProfile()) || createDefaultProfile();
  profile.xp += quest.xpReward;
  const newLevel = Math.floor(profile.xp / XP_PER_LEVEL) + 1;
  profile.level = newLevel;
  profile.rank = getRankFromLevel(newLevel);
  profile.lastActiveDate = new Date().toISOString();
  await saveHunterProfile(profile);

  // Record in History exactly once
  const history = await getHunterHistory();
  const historyItem: CompletedLog = {
    _id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    questId: quest._id,
    title: quest.title,
    category: quest.category,
    xpEarned: quest.xpReward,
    statRaised: targetStat,
    statBonus: bonus,
    verificationNote: verificationNote.trim(),
    completedAt: quest.completedAt,
  };
  history.unshift(historyItem);
  await saveHunterHistory(history);

  const unlocked = await checkAndUnlockAchievements(profile, stats, history.length);
  return { profile, stats, quest, unlockedAchievement: unlocked };
}

/**
 * Records a completed workout raid exactly once.
 * Also marks the matching fitness quest complete if questId is provided.
 */
export async function recordWorkoutCompletion(data: {
  workoutName: string;
  routineId: string;
  questId?: string;
  exercisesCompleted: number;
  totalExercises: number;
  durationSeconds: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  xpReward: number;
  statBonus: number;
}): Promise<{
  workout: WorkoutLog;
  profile: HunterProfile;
  stats: HunterStats;
  quest?: HunterQuest;
  unlockedAchievement?: Achievement;
}> {
  if ((await getWorkoutLogs()).some((log) => log.routineId === data.routineId)) {
    throw new Error('This workout has already been completed.');
  }
  if (!(await claimRewardOnce(`workout:${data.routineId}`))) {
    throw new Error('This workout has already been completed.');
  }
  // 1. Save Workout Log
  const logs = await getWorkoutLogs();
  const newWorkout: WorkoutLog = {
    _id: `wkt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    routineId: data.routineId,
    workoutName: data.workoutName,
    exercisesCompleted: data.exercisesCompleted,
    totalExercises: data.totalExercises,
    durationSeconds: data.durationSeconds,
    difficulty: data.difficulty,
    xpEarned: data.xpReward,
    createdAt: new Date().toISOString(),
  };
  logs.unshift(newWorkout);
  await AsyncStorage.setItem(WORKOUT_KEY, JSON.stringify(logs));

  const dailyPlan = await getSavedDailyWorkoutPlan();
  if (dailyPlan?.routine?.id === data.routineId && !dailyPlan.completedAt) {
    await saveDailyWorkoutPlan({ ...dailyPlan, completedAt: newWorkout.createdAt });
  }

  // 2. Update Stats (Strength + bonus, Health + 2)
  const stats = await getHunterStats();
  stats.strength = Math.min(100, stats.strength + data.statBonus);
  stats.health = Math.min(100, stats.health + 2);
  await saveHunterStats(stats);

  // 3. Update Profile XP
  let profile = (await getHunterProfile()) || createDefaultProfile();
  profile.xp += data.xpReward;
  profile.level = Math.floor(profile.xp / XP_PER_LEVEL) + 1;
  profile.rank = getRankFromLevel(profile.level);
  profile.lastActiveDate = new Date().toISOString();
  await saveHunterProfile(profile);

  // 4. If linked to an active quest, mark that quest completed
  let completedQuest: HunterQuest | undefined;
  if (data.questId) {
    const quests = await getHunterQuests();
    const idx = quests.findIndex((q) => q._id === data.questId && q.status !== 'completed');
    if (idx !== -1) {
      quests[idx].status = 'completed';
      quests[idx].completedAt = new Date().toISOString();
      completedQuest = quests[idx];
      await saveHunterQuests(quests);
    }
  }

  // 5. Append exactly once to History log
  const history = await getHunterHistory();
  const historyItem: CompletedLog = {
    _id: `log_wkt_${Date.now()}`,
    questId: completedQuest?._id || data.questId,
    title: `DUNGEON RAID // ${data.workoutName.toUpperCase()}`,
    category: 'Fitness',
    xpEarned: data.xpReward,
    statRaised: 'strength',
    statBonus: data.statBonus,
    completedAt: new Date().toISOString(),
  };
  history.unshift(historyItem);
  await saveHunterHistory(history);

  // 6. Check and unlock achievements
  const unlocked = await checkAndUnlockAchievements(profile, stats, history.length);
  await unlockAchievement('first_blood');

  return {
    workout: newWorkout,
    profile,
    stats,
    quest: completedQuest,
    unlockedAchievement: unlocked,
  };
}

/**
 * Records a Pomodoro study session completion exactly once.
 */
export async function recordStudyCompletion(data: {
  topic: string;
  durationMinutes: number;
  questId?: string;
  completionId?: string;
  verificationNote?: string;
  xpReward?: number;
}): Promise<{
  profile: HunterProfile;
  stats: HunterStats;
  quest?: HunterQuest;
  unlockedAchievement?: Achievement;
}> {
  if (data.questId) {
    const quest = (await getHunterQuests()).find((item) => item._id === data.questId);
    if (!quest || getQuestStatusAt(quest) === 'expired') {
      throw new Error('This quest has expired and cannot be completed.');
    }
    if (!hasMeaningfulVerification(data.verificationNote || '')) {
      throw new Error('Add a meaningful verification note (at least 8 characters).');
    }
    if (quest.status === 'completed' || !(await claimRewardOnce(`quest:${data.questId}`))) {
      throw new Error('Quest directive has already been completed.');
    }
  } else if (!data.completionId || !(await claimRewardOnce(`study:${data.completionId}`))) {
    throw new Error('This study session has already been rewarded or is missing its session id.');
  }
  const earnedXp = data.xpReward || (data.durationMinutes >= 50 ? 80 : 50);

  // 1. Update stats (Knowledge + 4, Discipline + 2)
  const stats = await getHunterStats();
  stats.knowledge = Math.min(100, stats.knowledge + 4);
  stats.discipline = Math.min(100, stats.discipline + 2);
  await saveHunterStats(stats);

  // 2. Update Profile XP
  let profile = (await getHunterProfile()) || createDefaultProfile();
  profile.xp += earnedXp;
  profile.level = Math.floor(profile.xp / XP_PER_LEVEL) + 1;
  profile.rank = getRankFromLevel(profile.level);
  profile.lastActiveDate = new Date().toISOString();
  await saveHunterProfile(profile);

  // 3. Mark matching quest completed if applicable
  let completedQuest: HunterQuest | undefined;
  if (data.questId) {
    const quests = await getHunterQuests();
    const idx = quests.findIndex((q) => q._id === data.questId && q.status !== 'completed');
    if (idx !== -1) {
      quests[idx].status = 'completed';
      quests[idx].completedAt = new Date().toISOString();
      completedQuest = quests[idx];
      await saveHunterQuests(quests);
    }
  }

  // 4. Write to History
  const history = await getHunterHistory();
  const historyItem: CompletedLog = {
    _id: `log_std_${Date.now()}`,
    questId: completedQuest?._id || data.questId,
    title: `STUDY BLOCK // ${data.topic.toUpperCase() || 'DEEP FOCUS'}`,
    category: 'Study',
    xpEarned: earnedXp,
    statRaised: 'knowledge',
    statBonus: 4,
    verificationNote: data.verificationNote?.trim(),
    completedAt: new Date().toISOString(),
  };
  history.unshift(historyItem);
  await saveHunterHistory(history);

  const unlocked = await checkAndUnlockAchievements(profile, stats, history.length);
  await unlockAchievement('scholar');

  return {
    profile,
    stats,
    quest: completedQuest,
    unlockedAchievement: unlocked,
  };
}

export async function getAchievements(): Promise<Achievement[]> {
  try {
    const raw = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse achievements:', err);
  }
  await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(INITIAL_ACHIEVEMENTS));
  return INITIAL_ACHIEVEMENTS;
}

export async function unlockAchievement(achievementId: string): Promise<Achievement | undefined> {
  const achievements = await getAchievements();
  const item = achievements.find((a) => a.id === achievementId);
  if (item && !item.unlocked) {
    item.unlocked = true;
    item.unlockedAt = new Date().toISOString();
    await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
    return item;
  }
  return undefined;
}

export async function checkAndUnlockAchievements(
  profile: HunterProfile,
  stats: HunterStats,
  historyCount: number
): Promise<Achievement | undefined> {
  if (profile.onboarded) {
    const unl = await unlockAchievement('awakening');
    if (unl) return unl;
  }
  if (profile.level >= 10) {
    const unl = await unlockAchievement('elite');
    if (unl) return unl;
  }
  if (historyCount >= 1) {
    const unl = await unlockAchievement('first_blood');
    if (unl) return unl;
  }
  if (stats.knowledge >= 60) {
    const unl = await unlockAchievement('scholar');
    if (unl) return unl;
  }
  if (stats.discipline >= 60) {
    const unl = await unlockAchievement('iron_mind');
    if (unl) return unl;
  }
  return undefined;
}

export async function getWorkoutLogs(): Promise<WorkoutLog[]> {
  try {
    const raw = await AsyncStorage.getItem(WORKOUT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to parse workout logs:', err);
    return [];
  }
}

export async function saveWorkoutLog(log: Omit<WorkoutLog, '_id' | 'createdAt'>): Promise<{
  workout: WorkoutLog;
  profile: HunterProfile;
  stats: HunterStats;
}> {
  if (log.routineId && !(await claimRewardOnce(`custom-workout:${log.routineId}`))) {
    throw new Error('This custom workout log has already been saved.');
  }
  const logs = await getWorkoutLogs();
  const newLog: WorkoutLog = {
    ...log,
    _id: `wkt_${Date.now()}`,
    xpEarned: 50,
    createdAt: new Date().toISOString(),
  };
  logs.unshift(newLog);
  await AsyncStorage.setItem(WORKOUT_KEY, JSON.stringify(logs));

  const stats = await getHunterStats();
  stats.strength = Math.min(100, stats.strength + 3);
  await saveHunterStats(stats);

  const profile = (await getHunterProfile()) || createDefaultProfile();
  profile.xp += 50;
  profile.level = Math.floor(profile.xp / XP_PER_LEVEL) + 1;
  profile.rank = getRankFromLevel(profile.level);
  await saveHunterProfile(profile);

  // Write to history
  const history = await getHunterHistory();
  history.unshift({
    _id: `log_wkt_${Date.now()}`,
    title: `CUSTOM TRAINING // ${log.workoutName.toUpperCase()}`,
    category: 'Fitness',
    xpEarned: 50,
    statRaised: 'strength',
    statBonus: 3,
    completedAt: newLog.createdAt,
  });
  await saveHunterHistory(history);

  await unlockAchievement('first_blood');
  return { workout: newLog, profile, stats };
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(JOURNAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to parse journal entries:', err);
    return [];
  }
}

export async function saveJournalEntry(entry: Omit<JournalEntry, '_id' | 'createdAt'>): Promise<{
  journal: JournalEntry;
  profile: HunterProfile;
  stats: HunterStats;
}> {
  const entries = await getJournalEntries();
  const newEntry: JournalEntry = {
    ...entry,
    _id: `jrn_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  entries.unshift(newEntry);
  await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));

  const stats = await getHunterStats();
  stats.mindfulness = Math.min(100, stats.mindfulness + 4);
  await saveHunterStats(stats);

  const profile = (await getHunterProfile()) || createDefaultProfile();
  profile.xp += 35;
  profile.level = Math.floor(profile.xp / XP_PER_LEVEL) + 1;
  profile.rank = getRankFromLevel(profile.level);
  await saveHunterProfile(profile);

  // Write to history
  const history = await getHunterHistory();
  history.unshift({
    _id: `log_jrn_${Date.now()}`,
    title: 'Daily Introspection',
    category: 'Mindfulness',
    xpEarned: 35,
    statRaised: 'mindfulness',
    statBonus: 4,
    completedAt: newEntry.createdAt,
  });
  await saveHunterHistory(history);

  await unlockAchievement('inner_system');
  return { journal: newEntry, profile, stats };
}

export async function getScreenTime(): Promise<ScreenTimeRecord> {
  try {
    const raw = await AsyncStorage.getItem(SCREENTIME_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse screen time:', err);
  }
  const def: ScreenTimeRecord = {
    unlocks: 14,
    reelsMinutes: 18,
    productiveMinutes: 95,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(SCREENTIME_KEY, JSON.stringify(def));
  return def;
}

export async function saveScreenTime(data: ScreenTimeRecord): Promise<void> {
  await AsyncStorage.setItem(SCREENTIME_KEY, JSON.stringify(data));
}

export async function saveScreenTimeVictory(screenData: ScreenTimeRecord): Promise<{
  screenData: ScreenTimeRecord;
  profile: HunterProfile;
  stats: HunterStats;
}> {
  await saveScreenTime(screenData);

  const stats = await getHunterStats();
  stats.discipline = Math.min(100, stats.discipline + 3);
  await saveHunterStats(stats);

  const profile = (await getHunterProfile()) || createDefaultProfile();
  profile.xp += 40;
  profile.level = Math.floor(profile.xp / XP_PER_LEVEL) + 1;
  profile.rank = getRankFromLevel(profile.level);
  await saveHunterProfile(profile);

  const history = await getHunterHistory();
  history.unshift({
    _id: `log_scr_${Date.now()}`,
    title: 'DISCIPLINE DEFENSE // DIGITAL DETOX',
    category: 'Discipline',
    xpEarned: 40,
    statRaised: 'discipline',
    statBonus: 3,
    completedAt: new Date().toISOString(),
  });
  await saveHunterHistory(history);

  await unlockAchievement('digital_detox');
  return { screenData, profile, stats };
}

const CURRENT_USER_KEY = 'arise.currentUser';

export async function resetAllData(): Promise<void> {
  await AsyncStorage.multiRemove([
    PROFILE_KEY,
    STATS_KEY,
    QUESTS_KEY,
    HISTORY_KEY,
    JOURNAL_KEY,
    WORKOUT_KEY,
    ACHIEVEMENTS_KEY,
    SCREENTIME_KEY,
    DAILY_WORKOUT_PLAN_KEY,
    WORKOUT_PLANS_KEY,
    NUTRITION_HISTORY_KEY,
    NUTRITION_PREFERENCES_KEY,
    CHAT_CONVERSATIONS_KEY,
    ACTIVE_CHAT_KEY,
    QUEST_RECOMMENDATIONS_KEY,
    REWARD_CLAIMS_KEY,
    CURRENT_USER_KEY,
    ONBOARDING_DRAFT_KEY,
    GOAL_PROGRESS_KEY,
  ]);
}
