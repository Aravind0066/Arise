import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure the controllers see GEMINI_API_KEY so they enter the Gemini branch
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key-for-unit-tests';

const require = createRequire(import.meta.url);
const { generateNutritionRecommendations } = require('../controllers/nutritionController');
const geminiService = require('../services/geminiService');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

const VALID_GEMINI_REC = [
  {
    name: 'Grilled Chicken Bowl',
    ingredients: ['chicken', 'rice', 'broccoli'],
    portions: '1 bowl',
    steps: ['Cook chicken.', 'Steam rice.', 'Combine.'],
    nutrition: { calories: '500 kcal', protein: '45g' },
  },
];

// 1. No input at all → 400
test('Nutrition: no input fields returns 400', async () => {
  const req = { body: {} };
  const res = mockRes();
  await generateNutritionRecommendations(req, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: 'At least one nutrition input field must be provided.',
  });
});

// 2. Gemini returns valid array → success=true, fallback=false, recommendations present
test('Nutrition: Gemini valid array → success with live recs', async () => {
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({ success: true, data: VALID_GEMINI_REC });

  const req = { body: { fitnessGoal: 'Muscle Gain', prepTimeMinutes: 30 } };
  const res = mockRes();
  await generateNutritionRecommendations(req, res);

  assert.equal(res.body.success, true);
  assert.equal(res.body.fallback, false);
  assert.deepEqual(Object.keys(res.body).sort(), ['data', 'fallback', 'recommendations', 'success']);
  assert.ok(Array.isArray(res.body.recommendations));
  assert.ok(res.body.recommendations.length > 0);
  // The current wire contract exposes recommendations at top level and mirrors them in data.
  assert.ok(Array.isArray(res.body.data));
  assert.deepEqual(res.body.data, res.body.recommendations);
  assert.deepEqual(res.body.recommendations[0].nutrition, {
    calories: '500 kcal',
    protein: '45g',
  });

  geminiService.generateResponse = original;
});

// 3. Gemini returns wrapped object { recommendations: [...] } → normalizer handles it
test('Nutrition: Gemini wrapped recommendations object → success with live recs', async () => {
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({
    success: true,
    data: { recommendations: VALID_GEMINI_REC },
  });

  const req = { body: { fitnessGoal: 'Endurance' } };
  const res = mockRes();
  await generateNutritionRecommendations(req, res);

  assert.equal(res.body.success, true);
  assert.equal(res.body.fallback, false);
  assert.ok(Array.isArray(res.body.recommendations));

  geminiService.generateResponse = original;
});

// 4. Gemini fails → deterministic fallback, still success=true
test('Nutrition: Gemini failure → deterministic fallback', async () => {
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({ success: false, error: 'quota exceeded' });

  const req = { body: { fitnessGoal: 'Weight Loss' } };
  const res = mockRes();
  await generateNutritionRecommendations(req, res);

  assert.equal(res.body.success, true);
  assert.equal(res.body.fallback, true);
  assert.ok(Array.isArray(res.body.recommendations));
  assert.ok(res.body.recommendations.length > 0);
  assert.equal(typeof res.body.recommendations[0].nutrition.approximateCalories, 'string');
  assert.equal(typeof res.body.recommendations[0].nutrition.approximateProtein, 'string');

  geminiService.generateResponse = original;
});

// 5. Gemini returns malformed data → fallback
test('Nutrition: Gemini malformed data → fallback', async () => {
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({ success: true, data: 'not an array' });

  const req = { body: { fitnessGoal: 'Maintenance', prepTimeMinutes: 20 } };
  const res = mockRes();
  await generateNutritionRecommendations(req, res);

  assert.equal(res.body.success, true);
  assert.equal(res.body.fallback, true);

  geminiService.generateResponse = original;
});
