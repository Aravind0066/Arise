import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure the controllers see OLLAMA_BASE_URL so they exercise the provider path
process.env.OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

const require = createRequire(import.meta.url);
const { generateNutritionRecommendations } = require('../controllers/nutritionController');
const aiProvider = require('../services/aiProvider');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

const VALID_AI_REC = [
  {
    name: 'Grilled Chicken Bowl',
    ingredients: ['chicken', 'rice', 'broccoli'],
    portions: '1 bowl',
    steps: ['Cook chicken.', 'Steam rice.', 'Combine.'],
    nutrition: { calories: '500 kcal', protein: '45g' },
  },
];

// 1. Empty optional inputs still produce a general plan.
test('Nutrition: generation proceeds with every optional input empty', async () => {
  const original = aiProvider.generateResponse;
  let prompt = '';
  let format;
  aiProvider.generateResponse = async (value, options) => { prompt = value; format = options.format; return { success: true, data: VALID_AI_REC }; };
  const req = { body: {} };
  const res = mockRes();
  await generateNutritionRecommendations(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.match(prompt, /general balanced meal-planning defaults/);
  assert.match(prompt, /No meal scope was selected/);
  assert.doesNotMatch(prompt, /Fitness goal:|Dietary preferences:|Maximum preparation time|Budget per meal/);
  assert.equal(Array.isArray(format), false);
  assert.equal(format.type, 'array');
  aiProvider.generateResponse = original;
});

// 2. Ollama returns valid array → success=true, fallback=false, recommendations present
test('Nutrition: Ollama valid array → success with live recs', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: true, data: VALID_AI_REC });

  const req = { body: { fitnessGoal: 'Muscle Gain', prepTimeMinutes: 30 } };
  const res = mockRes();
  await generateNutritionRecommendations(req, res);

  assert.equal(res.body.success, true);
  assert.equal(res.body.fallback, false);
  assert.deepEqual(Object.keys(res.body).sort(), ['data', 'fallback', 'recommendations', 'source', 'success']);
  assert.equal(res.body.source, 'ollama-local');
  assert.ok(Array.isArray(res.body.recommendations));
  assert.ok(res.body.recommendations.length > 0);
  // The current wire contract exposes recommendations at top level and mirrors them in data.
  assert.ok(Array.isArray(res.body.data));
  assert.deepEqual(res.body.data, res.body.recommendations);
  assert.deepEqual(res.body.recommendations[0].nutrition, {
    calories: '500 kcal',
    protein: '45g',
  });

  aiProvider.generateResponse = original;
});

// 3. Ollama returns wrapped object { recommendations: [...] } → normalizer handles it
test('Nutrition: Ollama wrapped recommendations object → success with live recs', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({
    success: true,
    data: { recommendations: VALID_AI_REC },
  });

  const req = { body: { fitnessGoal: 'Endurance' } };
  const res = mockRes();
  await generateNutritionRecommendations(req, res);

  assert.equal(res.body.success, true);
  assert.equal(res.body.fallback, false);
  assert.ok(Array.isArray(res.body.recommendations));

  aiProvider.generateResponse = original;
});

// 4. Ollama fails → deterministic fallback, still success=true
test('Nutrition: Ollama failure returns an error without invented meal suggestions', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: false, error: 'quota exceeded' });

  const req = { body: { fitnessGoal: 'Weight Loss' } };
  const res = mockRes();
  await generateNutritionRecommendations(req, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.success, false);
  assert.equal(res.body.errorType, 'OLLAMA_PROVIDER_ERROR');
  assert.equal(res.body.recommendations, undefined);

  aiProvider.generateResponse = original;
});

// 5. Ollama returns malformed data → fallback
test('Nutrition: Ollama malformed data returns an error', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: true, data: 'not an array' });

  const req = { body: { fitnessGoal: 'Maintenance', prepTimeMinutes: 20 } };
  const res = mockRes();
  await generateNutritionRecommendations(req, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.success, false);
  assert.equal(res.body.errorType, 'OUTPUT_SCHEMA_VALIDATION_FAILED');
  assert.match(res.body.error, /name, ingredients, portions or servings, and steps or instructions/);

  aiProvider.generateResponse = original;
});

test('Nutrition: normalizes safe field variations and does not require optional nutrition estimates', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: true, data: [{
    title: 'Lentil bowl',
    items: [{ name: 'lentils', amount: '1 cup' }, { ingredient: 'spinach' }],
    servings: 2,
    instructions: ['Simmer lentils.', 'Fold in spinach.'],
    prepTimeMinutes: 25,
  }] });
  const res = mockRes();
  await generateNutritionRecommendations({ body: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.recommendations[0].name, 'Lentil bowl');
  assert.deepEqual(res.body.recommendations[0].ingredients, ['1 cup lentils', 'spinach']);
  assert.equal(res.body.recommendations[0].portions, '2');
  assert.equal(res.body.recommendations[0].preparationTimeMinutes, 25);
  assert.equal(res.body.recommendations[0].nutrition, undefined);
  aiProvider.generateResponse = original;
});

test('Nutrition: missing required meal fields fails without inventing values', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: true, data: [{ name: 'Incomplete bowl', ingredients: ['rice'] }] });
  const res = mockRes();
  await generateNutritionRecommendations({ body: {} }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.errorType, 'OUTPUT_SCHEMA_VALIDATION_FAILED');
  assert.equal(res.body.recommendations, undefined);
  aiProvider.generateResponse = original;
});

test('Nutrition: ingredient, time, meal count, and saved context constraints reach the provider prompt', async () => {
  const original = aiProvider.generateResponse;
  let prompt = '';
  aiProvider.generateResponse = async (value) => { prompt = value; return { success: true, data: VALID_AI_REC }; };
  const req = { body: {
    availableIngredients: ['lentils', 'spinach'], prepTimeMinutes: 20, mealsToPlan: 'full-day',
    context: { previousSavedPlans: [{ meals: ['Tofu bowl'] }], foodLogs: { available: false, entries: null } },
  } };
  const res = mockRes();
  await generateNutritionRecommendations(req, res);
  assert.equal(res.statusCode, 200);
  assert.match(prompt, /lentils, spinach/);
  assert.match(prompt, /Maximum preparation time \(minutes\): 20/);
  assert.match(prompt, /full day plan/);
  assert.match(prompt, /Tofu bowl/);
  assert.match(prompt, /Do not infer food intake/);
  assert.doesNotMatch(prompt, /Fitness goal:|Dietary preferences:|Budget per meal/);
  aiProvider.generateResponse = original;
});
