import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure the controllers see GEMINI_API_KEY so they enter the Gemini branch
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key-for-unit-tests';

const require = createRequire(import.meta.url);
const { generateWeaknessRecommendations } = require('../controllers/weaknessRecommendationController');
const geminiService = require('../services/geminiService');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

const VALID_GOALS = ['Ascension & Conditioning'];
const VALID_STATS = { strength: 35, knowledge: 40, discipline: 30, health: 45, mindfulness: 35 };
const FUTURE_DEADLINE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const VALID_GEMINI_REC = [
  {
    title: 'Morning Strength Protocol',
    description: 'Perform 3 sets of bodyweight exercises.',
    category: 'Fitness',
    estimatedDuration: 30,
    difficulty: 'Beginner',
    deadline: FUTURE_DEADLINE,
    suggestedReward: 80,
  },
];

// 1. Minimal valid payload → success
test('Weakness: minimal payload (goals+stats only) succeeds with fallback', async () => {
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({ success: false, error: 'no key' });

  const req = { body: { goals: VALID_GOALS, stats: VALID_STATS } };
  const res = mockRes();
  await generateWeaknessRecommendations(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.recommendations));
  assert.ok(res.body.recommendations.length >= 3);
  assert.equal(res.body.fallback, true);
  // data key also present
  assert.ok(Array.isArray(res.body.data));

  geminiService.generateResponse = original;
});

// 2. goals must be a non-empty array when provided
test('Weakness: empty goals array returns 400', async () => {
  const req = { body: { goals: [], stats: VALID_STATS } };
  const res = mockRes();
  await generateWeaknessRecommendations(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

// 3. Gemini returns valid array → live recs, fallback=false
test('Weakness: Gemini valid array → live recommendations returned', async () => {
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({ success: true, data: VALID_GEMINI_REC });

  const req = { body: { goals: VALID_GOALS, stats: VALID_STATS, availableMinutes: 45, preferredCategories: ['Fitness'] } };
  const res = mockRes();
  await generateWeaknessRecommendations(req, res);

  assert.equal(res.body.success, true);
  assert.equal(res.body.fallback, false);
  assert.ok(Array.isArray(res.body.recommendations));
  assert.equal(res.body.recommendations.length, 1);
  assert.equal(res.body.recommendations[0].title, 'Morning Strength Protocol');

  geminiService.generateResponse = original;
});

// 4. Gemini returns wrapped object { recommendations: [...] } → normalizer handles it
test('Weakness: Gemini wrapped object → live recommendations extracted', async () => {
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({
    success: true,
    data: { recommendations: VALID_GEMINI_REC },
  });

  const req = { body: { goals: VALID_GOALS, stats: VALID_STATS } };
  const res = mockRes();
  await generateWeaknessRecommendations(req, res);

  assert.equal(res.body.success, true);
  assert.equal(res.body.fallback, false);

  geminiService.generateResponse = original;
});

// 5. Gemini returns recs with past deadline → deadline auto-fixed
test('Weakness: past deadline in Gemini response is corrected automatically', async () => {
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({
    success: true,
    data: [{ ...VALID_GEMINI_REC[0], deadline: '2023-01-01T00:00:00.000Z' }],
  });

  const req = { body: { goals: VALID_GOALS, stats: VALID_STATS } };
  const res = mockRes();
  await generateWeaknessRecommendations(req, res);

  assert.equal(res.body.success, true);
  assert.equal(res.body.fallback, false);
  const dl = new Date(res.body.recommendations[0].deadline).getTime();
  assert.ok(dl > Date.now(), 'Deadline must be in the future after correction');

  geminiService.generateResponse = original;
});

// 6. Invalid availableMinutes → 400
test('Weakness: invalid availableMinutes (out of range) returns 400', async () => {
  const req = { body: { goals: VALID_GOALS, stats: VALID_STATS, availableMinutes: 2000 } };
  const res = mockRes();
  await generateWeaknessRecommendations(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

// 7. Accepting recommendation → no XP awarded by this endpoint (XP only via quest completion)
test('Weakness: response contains suggestedReward, not actual XP award', async () => {
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({ success: true, data: VALID_GEMINI_REC });

  const req = { body: { goals: VALID_GOALS, stats: VALID_STATS } };
  const res = mockRes();
  await generateWeaknessRecommendations(req, res);

  // The endpoint only returns recommendations, never awards XP
  assert.equal(res.body.xpAwarded, undefined, 'endpoint must not award XP directly');
  assert.ok(typeof res.body.recommendations[0].suggestedReward === 'number');

  geminiService.generateResponse = original;
});
