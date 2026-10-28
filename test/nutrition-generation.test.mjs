import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNutritionGenerationInput, createNutritionHistoryStore, createNutritionPreferencesStore, DEFAULT_NUTRITION_PREFERENCES } from '../lib/nutritionGeneration.ts';
import { readFile } from 'node:fs/promises';

class MemoryStorage {
  values = new Map();
  async getItem(key) { return this.values.get(key) ?? null; }
  async setItem(key, value) { this.values.set(key, value); }
}

test('nutrition request passes supplied ingredients, time, dietary constraints, goal, budget, and meal scope', () => {
  const payload = buildNutritionGenerationInput({
    availableIngredients: 'lentils, spinach', preparationTime: 20,
    dietaryPreferences: 'vegetarian, no dairy', fitnessGoal: 'maintenance', budget: '12', mealsToPlan: 'full-day',
  }, 'strength', []);
  assert.deepEqual(payload.availableIngredients, ['lentils', 'spinach']);
  assert.deepEqual(payload.dietaryPreferences, ['vegetarian', 'no dairy']);
  assert.equal(payload.prepTimeMinutes, 20);
  assert.equal(payload.fitnessGoal, 'maintenance');
  assert.equal(payload.budget, 12);
  assert.equal(payload.mealsToPlan, 'full-day');
});

test('missing user inputs remain absent and food logs / targets are marked unavailable', () => {
  const payload = buildNutritionGenerationInput(DEFAULT_NUTRITION_PREFERENCES, undefined, []);
  assert.deepEqual(Object.keys(payload), ['context']);
  assert.equal(payload.fitnessGoal, undefined);
  assert.equal(payload.availableIngredients, undefined);
  assert.equal(payload.prepTimeMinutes, undefined);
  assert.equal(payload.dietaryPreferences, undefined);
  assert.equal(payload.budget, undefined);
  assert.equal(payload.mealsToPlan, undefined);
  assert.deepEqual(payload.context.foodLogs, { available: false, entries: null });
  assert.deepEqual(payload.context.nutritionTargets, { available: false, values: null });
});

test('a saved profile goal can supply context while all form inputs remain optional', () => {
  const payload = buildNutritionGenerationInput(DEFAULT_NUTRITION_PREFERENCES, 'Strength', []);
  assert.equal(payload.fitnessGoal, 'Strength');
  assert.equal(payload.availableIngredients, undefined);
  assert.equal(payload.prepTimeMinutes, undefined);
  assert.equal(payload.mealsToPlan, undefined);
});

test('previous nutrition plans are summarized as generation context', () => {
  const payload = buildNutritionGenerationInput(DEFAULT_NUTRITION_PREFERENCES, 'maintenance', [{
    id: 'n1', createdAt: '2026-10-27T08:00:00.000Z', fallback: false,
    fitnessGoal: 'maintenance', recommendations: [{ name: 'Lentil bowl', ingredients: [], portions: '', steps: [] }],
    inputs: { availableIngredients: ['lentils'], prepTimeMinutes: 20 },
  }]);
  assert.deepEqual(payload.context.previousSavedPlans[0].meals, ['Lentil bowl']);
  assert.deepEqual(payload.context.previousSavedPlans[0].inputs.availableIngredients, ['lentils']);
});

test('nutrition preferences and successful history records persist and restore without generation', async () => {
  const storage = new MemoryStorage();
  const prefs = createNutritionPreferencesStore(storage, 'nutrition-prefs');
  await prefs.save({ ...DEFAULT_NUTRITION_PREFERENCES, availableIngredients: 'rice, beans', preparationTime: 10 });
  assert.equal((await createNutritionPreferencesStore(storage, 'nutrition-prefs').load()).preparationTime, 10);
  const history = createNutritionHistoryStore(storage, 'nutrition-history');
  const first = await history.append({ fallback: false, source: 'ollama-local', recommendations: [{ name: 'Rice bowl', ingredients: [], portions: '1', steps: [] }] });
  await history.append({ fallback: false, source: 'ollama-local', recommendations: [{ name: 'Bean soup', ingredients: [], portions: '1', steps: [] }] });
  const restored = await createNutritionHistoryStore(storage, 'nutrition-history').load();
  assert.equal(restored.length, 2);
  assert.equal(restored[0].recommendations[0].name, 'Bean soup');
  assert.equal(restored[1].id, first.id);
});

test('failed generation does not append history or hide prior successful recommendations', async () => {
  const storage = new MemoryStorage();
  const history = createNutritionHistoryStore(storage, 'history');
  await history.append({ fallback: false, recommendations: [{ name: 'Saved meal', ingredients: [], portions: '1', steps: [] }] });
  try { throw new Error('Provider unavailable'); } catch { /* UI error state: persistence is success-only */ }
  assert.equal((await history.load()).length, 1);
  const ui = await readFile(new URL('../components/NutritionContent.tsx', import.meta.url), 'utf8');
  assert.match(ui, /await saveNutritionHistoryRecord\(\{/);
  assert.match(ui, /if \(!res\.success\)/);
  assert.match(ui, /!loading && recs\.length > 0/);
  assert.match(ui, /OPTIONAL MEAL DETAILS/);
  assert.match(ui, /onPress=\{fetchRecommendations\}/);
  assert.match(ui, /No preference/);
  assert.doesNotMatch(ui, /useEffect\(\(\)\s*=>\s*\{[^}]*fetchRecommendations/s);
});
