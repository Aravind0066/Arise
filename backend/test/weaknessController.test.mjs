import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure the controllers see OLLAMA_BASE_URL so they exercise the provider path
process.env.OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

const require = createRequire(import.meta.url);
const { generateWeaknessRecommendations } = require('../controllers/weaknessRecommendationController');
const aiProvider = require('../services/aiProvider');

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

const VALID_AI_REC = [
  {
    title: 'Morning Strength Protocol',
    description: 'Perform 3 sets of bodyweight exercises.',
    category: 'Fitness',
    estimatedDuration: 30,
    difficulty: 'Beginner',
    deadline: FUTURE_DEADLINE,
    suggestedReward: 80,
  },
  {
    title: 'Focused Learning Review',
    description: 'Review one challenging study topic using active recall.',
    category: 'Study',
    estimatedDuration: 25,
    difficulty: 'Beginner',
    deadline: FUTURE_DEADLINE,
    suggestedReward: 55,
  },
  {
    title: 'Daily Planning Reset',
    description: 'Plan the next day and remove one recurring distraction.',
    category: 'Discipline',
    estimatedDuration: 15,
    difficulty: 'Intermediate',
    deadline: FUTURE_DEADLINE,
    suggestedReward: 40,
  },
];

// 1. Minimal valid payload → success
test('Weakness: provider failure returns explicitly marked deterministic fallback', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: false, error: 'no key' });

  const req = { body: { goals: VALID_GOALS, stats: VALID_STATS } };
  const res = mockRes();
  await generateWeaknessRecommendations(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.recommendations));
  assert.ok(res.body.recommendations.length >= 3);
  assert.equal(res.body.fallback, true);
  assert.equal(res.body.source, 'hunteros-engine');
  // data key also present
  assert.ok(Array.isArray(res.body.data));

  aiProvider.generateResponse = original;
});

// 2. goals must be a non-empty array when provided
test('Weakness: empty goals array returns 400', async () => {
  const req = { body: { goals: [], stats: VALID_STATS } };
  const res = mockRes();
  await generateWeaknessRecommendations(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

// 3. Ollama returns valid array → live recs, fallback=false
test('Weakness: Ollama valid array → live recommendations returned', async () => {
  const original = aiProvider.generateResponse;
  let options;
  aiProvider.generateResponse = async (_prompt, received) => { options = received; return { success: true, data: VALID_AI_REC }; };

  const req = { body: { goals: VALID_GOALS, stats: VALID_STATS, availableMinutes: 45, preferredCategories: ['Fitness'] } };
  const res = mockRes();
  await generateWeaknessRecommendations(req, res);

  assert.equal(res.body.success, true);
  assert.equal(res.body.fallback, false);
  assert.equal(res.body.source, 'ollama-local');
  assert.equal(options.feature, 'weakness-scan');
  assert.equal(options.responseMode, 'json');
  assert.equal(options.format.type, 'object');
  assert.equal(options.format.properties.recommendations.minItems, 3);
  assert.ok(Array.isArray(res.body.recommendations));
  assert.equal(res.body.recommendations.length, 3);
  assert.equal(res.body.recommendations[0].title, 'Morning Strength Protocol');

  aiProvider.generateResponse = original;
});

// 4. Ollama returns wrapped object { recommendations: [...] } → normalizer handles it
test('Weakness: Ollama wrapped object → live recommendations extracted', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({
    success: true,
    data: { recommendations: VALID_AI_REC },
  });

  const req = { body: { goals: VALID_GOALS, stats: VALID_STATS } };
  const res = mockRes();
  await generateWeaknessRecommendations(req, res);

  assert.equal(res.body.success, true);
  assert.equal(res.body.fallback, false);

  aiProvider.generateResponse = original;
});

// 5. Ollama returns recs with past deadline → deadline auto-fixed
test('Weakness: past deadline in Ollama response is corrected automatically', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({
    success: true,
    data: [{ ...VALID_AI_REC[0], deadline: '2023-01-01T00:00:00.000Z' }, ...VALID_AI_REC.slice(1)],
  });

  const req = { body: { goals: VALID_GOALS, stats: VALID_STATS } };
  const res = mockRes();
  await generateWeaknessRecommendations(req, res);

  assert.equal(res.body.success, true);
  assert.equal(res.body.fallback, false);
  const dl = new Date(res.body.recommendations[0].deadline).getTime();
  assert.ok(dl > Date.now(), 'Deadline must be in the future after correction');

  aiProvider.generateResponse = original;
});

test('Weakness: a single quest object fails array validation and returns a marked fallback', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: true, data: VALID_AI_REC[0] });
  const res = mockRes();
  await generateWeaknessRecommendations({ body: { goals: VALID_GOALS, stats: VALID_STATS } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.fallback, true);
  assert.equal(res.body.fallbackReason, 'OUTPUT_SCHEMA_VALIDATION_FAILED');
  assert.equal(res.body.source, 'hunteros-engine');
  assert.equal(res.body.recommendations.length, 3);
  aiProvider.generateResponse = original;
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
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: true, data: VALID_AI_REC });

  const req = { body: { goals: VALID_GOALS, stats: VALID_STATS } };
  const res = mockRes();
  await generateWeaknessRecommendations(req, res);

  // The endpoint only returns recommendations, never awards XP
  assert.equal(res.body.xpAwarded, undefined, 'endpoint must not award XP directly');
  assert.ok(typeof res.body.recommendations[0].suggestedReward === 'number');

  aiProvider.generateResponse = original;
});
