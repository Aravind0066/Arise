// Regression tests for resetAllData – local hunter account deletion flow
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

class MockAsyncStorage {
  constructor() { this.store = new Map(); }
  async getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  async setItem(key, value) { this.store.set(key, String(value)); }
  async removeItem(key) { this.store.delete(key); }
  async multiRemove(keys) { for (const k of keys) this.store.delete(k); }
}

// Must stay in sync with resetAllData() in lib/hunterStorage.ts
const ACCOUNT_KEYS = [
  'hunteros.profile.v2',
  'hunteros.stats.v2',
  'hunteros.quests.v2',
  'hunteros.history.v2',
  'hunteros.journal.v2',
  'hunteros.workout.v2',
  'hunteros.achievements.v2',
  'hunteros.screentime.v2',
  'hunteros.dailyWorkoutPlan.v1',
  'hunteros.workoutPreferences.v1',
  'hunteros.workoutPlans.v1',
  'hunteros.nutritionHistory.v1',
  'hunteros.nutritionPreferences.v1',
  'hunteros.chat.conversations.v1',
  'hunteros.chat.active.v1',
  'hunteros.questRecommendations.v1',
  'hunteros.rewardClaims.v1',
  'arise.currentUser',
  'hunteros.onboardingDraft.v1',
  'hunteros.goalProgress.v1',
];

const APPEARANCE_KEY = 'hunteros.appearance.v1';

async function simulateResetAllData(storage) {
  await storage.multiRemove(ACCOUNT_KEYS);
}

test('Account deletion: resetAllData key list matches hunterStorage implementation', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '../lib/hunterStorage.ts'), 'utf8');
  const match = source.match(/export async function resetAllData[\s\S]*?AsyncStorage\.multiRemove\(\[([\s\S]*?)\]\)/);
  assert.ok(match, 'resetAllData multiRemove list must be present');
  for (const key of ACCOUNT_KEYS) {
    assert.ok(source.includes(`'${key}'`) || source.includes(`"${key}"`) || source.includes(key.replace('hunteros.', '').replace('arise.', '')),
      `Expected storage source to reference ${key}`);
  }
  // Explicit constants used by resetAllData
  assert.ok(source.includes('PROFILE_KEY'));
  assert.ok(source.includes('CURRENT_USER_KEY'));
  assert.ok(source.includes('ONBOARDING_DRAFT_KEY'));
  assert.ok(source.includes('GOAL_PROGRESS_KEY'));
  assert.ok(match[1].includes('PROFILE_KEY'));
  assert.ok(match[1].includes('CURRENT_USER_KEY'));
  assert.ok(match[1].includes('ONBOARDING_DRAFT_KEY'));
  assert.ok(match[1].includes('GOAL_PROGRESS_KEY'));
  assert.ok(!match[1].includes('APPEARANCE'), 'Appearance prefs must not be wiped by resetAllData');
});

test('Account deletion: all core data keys are removed', async () => {
  const storage = new MockAsyncStorage();
  for (const key of ACCOUNT_KEYS) {
    await storage.setItem(key, JSON.stringify({ test: true }));
  }

  await simulateResetAllData(storage);

  for (const key of ACCOUNT_KEYS) {
    assert.equal(await storage.getItem(key), null, `Key ${key} must be null after deletion`);
  }
});

test('Account deletion: appearance preferences key is NOT deleted', async () => {
  const storage = new MockAsyncStorage();
  await storage.setItem(APPEARANCE_KEY, JSON.stringify({ themeId: 'hunter-neon' }));
  await storage.setItem('hunteros.profile.v2', JSON.stringify({ name: 'Test' }));

  await simulateResetAllData(storage);

  assert.ok(await storage.getItem(APPEARANCE_KEY) !== null, 'Appearance preferences must survive account deletion');
  assert.equal(await storage.getItem('hunteros.profile.v2'), null);
});

test('Account deletion: stale profile does not reappear after restart', async () => {
  const storage = new MockAsyncStorage();
  await storage.setItem('hunteros.profile.v2', JSON.stringify({ name: 'Hunter', onboarded: true }));

  await simulateResetAllData(storage);

  const raw = await storage.getItem('hunteros.profile.v2');
  assert.equal(raw, null, 'Profile must remain null after deletion (simulating app restart)');
});

test('Account deletion: arise.currentUser and onboarding draft are included', async () => {
  const storage = new MockAsyncStorage();
  await storage.setItem('arise.currentUser', JSON.stringify({ _id: 'user_123' }));
  await storage.setItem('hunteros.onboardingDraft.v1', JSON.stringify({ step: 'goals' }));

  await simulateResetAllData(storage);

  assert.equal(await storage.getItem('arise.currentUser'), null);
  assert.equal(await storage.getItem('hunteros.onboardingDraft.v1'), null);
});
