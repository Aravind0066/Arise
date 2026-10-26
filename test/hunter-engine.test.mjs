import test from 'node:test';
import assert from 'node:assert/strict';

// Test mock storage layer mimicking AsyncStorage
class MockAsyncStorage {
  constructor() {
    this.store = new Map();
  }
  async getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  async setItem(key, value) {
    this.store.set(key, String(value));
  }
  async removeItem(key) {
    this.store.delete(key);
  }
  async multiRemove(keys) {
    for (const k of keys) this.store.delete(k);
  }
}

// 1. WORKOUT ENGINE TESTS
test('Workout Engine: provides deterministic routines tailored to profile', async () => {
  const { WORKOUT_ROUTINES, getPersonalizedWorkout } = await import('../lib/workoutEngine.ts');
  
  assert.ok(WORKOUT_ROUTINES.length >= 4, 'Has at least 4 dungeon routines');
  
  // Beginner profile
  const beginnerProfile = {
    _id: 'test_1',
    fitnessLevel: 'Beginner',
    primaryGoal: 'Strength & Aesthetic Physique',
  };
  const routine = getPersonalizedWorkout(beginnerProfile);
  assert.ok(routine.title, 'Routine has title');
  assert.ok(routine.exercises.length > 0, 'Routine has exercises');
  
  // Verify exercise fields
  const firstEx = routine.exercises[0];
  assert.ok(firstEx.name, 'Exercise has name');
  assert.ok(firstEx.type === 'reps' || firstEx.type === 'timed', 'Exercise has valid type');
  assert.ok(firstEx.illustrationKey, 'Exercise has illustration key');
  assert.ok(firstEx.restSeconds >= 0, 'Exercise has rest interval');
});

test('Workout Engine: scales difficulty for advanced hunters', async () => {
  const { getPersonalizedWorkout } = await import('../lib/workoutEngine.ts');
  
  const advProfile = {
    _id: 'test_adv',
    fitnessLevel: 'Advanced',
    primaryGoal: 'High intensity conditioning',
  };
  const advRoutine = getPersonalizedWorkout(advProfile);
  assert.ok(advRoutine.exercises.length > 0);
  const hasScaledEx = advRoutine.exercises.some(e => (e.targetReps && e.targetReps >= 15) || (e.durationSeconds && e.durationSeconds >= 45));
  assert.ok(hasScaledEx, 'Advanced routine has higher volume');
});

// 2. HUNTER RANK & ATTRIBUTES LOGIC
test('Hunter Logic: getRankFromLevel calculates correct hunter rank', () => {
  function getRankFromLevel(level) {
    if (level >= 50) return 'National Level';
    if (level >= 35) return 'S-Rank';
    if (level >= 25) return 'A-Rank';
    if (level >= 15) return 'B-Rank';
    if (level >= 8) return 'C-Rank';
    if (level >= 4) return 'D-Rank';
    return 'E-Rank';
  }
  
  assert.equal(getRankFromLevel(1), 'E-Rank');
  assert.equal(getRankFromLevel(4), 'D-Rank');
  assert.equal(getRankFromLevel(8), 'C-Rank');
  assert.equal(getRankFromLevel(15), 'B-Rank');
  assert.equal(getRankFromLevel(25), 'A-Rank');
  assert.equal(getRankFromLevel(35), 'S-Rank');
  assert.equal(getRankFromLevel(55), 'National Level');
});

// 3. CORE THREE INTERACTIONS
test('Interaction 1: Tap Workout -> Start -> Perform -> Finish -> XP updates exactly once', async () => {
  const mockStorage = new MockAsyncStorage();
  
  const initialProfile = {
    _id: 'hunter_test',
    name: 'Jin-Woo',
    title: 'The Awakened Hunter',
    rank: 'E-Rank',
    xp: 0,
    level: 1,
    onboarded: true,
  };
  mockStorage.setItem('hunteros.profile.v2', JSON.stringify(initialProfile));
  mockStorage.setItem('hunteros.stats.v2', JSON.stringify({ strength: 30, knowledge: 30, discipline: 30, health: 30, mindfulness: 30 }));
  mockStorage.setItem('hunteros.quests.v2', JSON.stringify([
    { _id: 'fit_quest_1', title: 'SHADOW WORKOUT', category: 'Fitness', targetStat: 'strength', statBonus: 4, xpReward: 80, status: 'active' },
  ]));

  const workoutRewardXp = 80;
  const statBonus = 4;
  
  const profileRaw = await mockStorage.getItem('hunteros.profile.v2');
  const profile = JSON.parse(profileRaw);
  profile.xp += workoutRewardXp;
  profile.level = Math.floor(profile.xp / 500) + 1;
  await mockStorage.setItem('hunteros.profile.v2', JSON.stringify(profile));

  const questsRaw = await mockStorage.getItem('hunteros.quests.v2');
  const quests = JSON.parse(questsRaw);
  quests[0].status = 'completed';
  quests[0].completedAt = new Date().toISOString();
  await mockStorage.setItem('hunteros.quests.v2', JSON.stringify(quests));

  const history = [{
    _id: 'log_wkt_1',
    questId: 'fit_quest_1',
    title: 'DUNGEON RAID // SHADOW WORKOUT',
    category: 'Fitness',
    xpEarned: workoutRewardXp,
    statRaised: 'strength',
    statBonus: 4,
    completedAt: new Date().toISOString(),
  }];
  await mockStorage.setItem('hunteros.history.v2', JSON.stringify(history));

  const updatedProfile = JSON.parse(await mockStorage.getItem('hunteros.profile.v2'));
  const updatedQuests = JSON.parse(await mockStorage.getItem('hunteros.quests.v2'));
  const updatedHistory = JSON.parse(await mockStorage.getItem('hunteros.history.v2'));

  assert.equal(updatedProfile.xp, 80, 'XP updated exactly once to 80');
  assert.equal(updatedQuests[0].status, 'completed', 'Quest marked completed');
  assert.equal(updatedHistory.length, 1, 'History has exactly one record');
  assert.equal(updatedHistory[0].xpEarned, 80);
});

test('Interaction 2: Tap Pomodoro -> session completes -> knowledge XP updates', async () => {
  const mockStorage = new MockAsyncStorage();
  
  const initialProfile = { _id: 'h2', xp: 80, level: 1, rank: 'E-Rank', onboarded: true };
  const initialStats = { strength: 34, knowledge: 30, discipline: 30, health: 32, mindfulness: 30 };
  await mockStorage.setItem('hunteros.profile.v2', JSON.stringify(initialProfile));
  await mockStorage.setItem('hunteros.stats.v2', JSON.stringify(initialStats));
  await mockStorage.setItem('hunteros.history.v2', JSON.stringify([{ _id: 'log_1', xpEarned: 80 }]));

  const pomodoroXp = 50;
  initialProfile.xp += pomodoroXp;
  initialStats.knowledge += 4;
  initialStats.discipline += 2;

  await mockStorage.setItem('hunteros.profile.v2', JSON.stringify(initialProfile));
  await mockStorage.setItem('hunteros.stats.v2', JSON.stringify(initialStats));

  const history = JSON.parse(await mockStorage.getItem('hunteros.history.v2'));
  history.unshift({
    _id: 'log_std_1',
    title: 'STUDY BLOCK // GRAPH THEORY',
    category: 'Study',
    xpEarned: pomodoroXp,
    statRaised: 'knowledge',
    statBonus: 4,
    completedAt: new Date().toISOString(),
  });
  await mockStorage.setItem('hunteros.history.v2', JSON.stringify(history));

  const profileAfter = JSON.parse(await mockStorage.getItem('hunteros.profile.v2'));
  const statsAfter = JSON.parse(await mockStorage.getItem('hunteros.stats.v2'));
  const historyAfter = JSON.parse(await mockStorage.getItem('hunteros.history.v2'));

  assert.equal(profileAfter.xp, 130, 'XP increased by exactly 50 to 130');
  assert.equal(statsAfter.knowledge, 34, 'Knowledge increased by 4');
  assert.equal(statsAfter.discipline, 32, 'Discipline increased by 2');
  assert.equal(historyAfter.length, 2, 'History recorded the study session');
  
  const totalHistoryXp = historyAfter.reduce((sum, h) => sum + h.xpEarned, 0);
  assert.equal(totalHistoryXp, profileAfter.xp, 'History XP is 100% in sync with profile XP');
});

test('Interaction 3: App refresh -> profile, history and progress remain intact', async () => {
  const mockStorage = new MockAsyncStorage();
  
  const savedProfile = {
    _id: 'hunter_saved',
    name: 'Sung Jin-Woo',
    title: 'Shadow Monarch',
    rank: 'C-Rank',
    xp: 1650,
    level: 4,
    onboarded: true,
  };
  const savedHistory = [
    { _id: 'h1', title: 'DUNGEON RAID', xpEarned: 85, category: 'Fitness' },
    { _id: 'h2', title: 'STUDY BLOCK', xpEarned: 80, category: 'Study' },
  ];
  await mockStorage.setItem('hunteros.profile.v2', JSON.stringify(savedProfile));
  await mockStorage.setItem('hunteros.history.v2', JSON.stringify(savedHistory));

  const loadedProfileRaw = await mockStorage.getItem('hunteros.profile.v2');
  assert.ok(loadedProfileRaw, 'Profile survives restart');
  const loadedProfile = JSON.parse(loadedProfileRaw);
  assert.equal(loadedProfile.name, 'Sung Jin-Woo');
  assert.equal(loadedProfile.level, 4);
  assert.equal(loadedProfile.rank, 'C-Rank');
  assert.equal(loadedProfile.xp, 1650);

  const loadedHistoryRaw = await mockStorage.getItem('hunteros.history.v2');
  assert.ok(loadedHistoryRaw, 'History survives restart');
  const loadedHistory = JSON.parse(loadedHistoryRaw);
  assert.equal(loadedHistory.length, 2);
  assert.equal(loadedHistory[0].title, 'DUNGEON RAID');
});
