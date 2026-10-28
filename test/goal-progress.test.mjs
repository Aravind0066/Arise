import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addGoalProgressEntry,
  createGoalProgress,
  createGoalProgressStore,
  getLatestGoalEntry,
  isGoalProgressEmpty,
  updateGoalConfiguration,
  validateTargetDate,
} from '../lib/goalProgress.ts';

class MemoryStorage {
  values = new Map();
  async getItem(key) { return this.values.get(key) ?? null; }
  async setItem(key, value) { this.values.set(key, value); }
}

test('goal title, target, unit, and target date can be created and edited', () => {
  const goal = createGoalProgress('Strength');
  const saved = updateGoalConfiguration(goal, {
    title: 'Run 5K', target: '5', unit: 'km', targetDate: '2099-12-31',
  });
  assert.equal(saved.title, 'Run 5K');
  assert.equal(saved.targetValue, 5);
  assert.equal(saved.unit, 'km');
  assert.equal(saved.targetDate, '2099-12-31');
  assert.throws(() => updateGoalConfiguration(saved, { title: 'Run 5K', target: '-1', unit: 'km', targetDate: '' }), /non-negative/);
  assert.throws(() => validateTargetDate('2026-02-30'), /calendar date/);
});

test('progress history persists locally and latest progress is derived from recorded values', async () => {
  const storage = new MemoryStorage();
  const store = createGoalProgressStore(storage, 'goal-key');
  const initial = await store.load('Strength & Aesthetic Physique');
  const target = updateGoalConfiguration(initial, { title: initial.title, target: '70', unit: 'kg', targetDate: '' });
  const first = addGoalProgressEntry(target, '75', '2026-09-01T10:00:00.000Z');
  const second = addGoalProgressEntry(first, '73.5', '2026-09-08T10:00:00.000Z');
  await store.save(second);

  const reloaded = await store.load('Strength & Aesthetic Physique');
  assert.equal(reloaded.entries.length, 2);
  assert.equal(getLatestGoalEntry(reloaded.entries)?.value, 73.5);
  assert.equal(reloaded.targetValue, 70);
  assert.equal(isGoalProgressEmpty(reloaded.entries), false);
});

test('profile and onboarding primary goal stays the canonical Home goal title', async () => {
  const storage = new MemoryStorage();
  const store = createGoalProgressStore(storage, 'goal-key');
  const original = await store.load('Build balanced strength');
  const configured = updateGoalConfiguration(original, { title: 'My edited title', target: '10', unit: 'reps', targetDate: '' });
  await store.save(configured);

  const reloadedFromProfile = await store.load('Build balanced strength');
  assert.equal(reloadedFromProfile.title, 'Build balanced strength');
  assert.equal(reloadedFromProfile.targetValue, 10);
  assert.equal(reloadedFromProfile.unit, 'reps');
});

test('empty goal history explicitly remains empty for graph rendering', () => {
  assert.equal(isGoalProgressEmpty([]), true);
  assert.equal(getLatestGoalEntry([]), null);
  const graphSource = readFileSync(new URL('../components/GoalProgressGraph.tsx', import.meta.url), 'utf8');
  assert.ok(graphSource.includes('NO MEASUREMENTS YET'));
  assert.ok(graphSource.includes('No progress is estimated.'));
});
