const test = require('node:test');
const assert = require('node:assert/strict');
const { createCorsOptions } = require('../config/cors');
const { getHealthState } = require('../config/health');
const { chat } = require('../controllers/chatController');
const { generateNutritionRecommendations } = require('../controllers/nutritionController');
const { generateRecommendations } = require('../controllers/recommendationController');
const aiProvider = require('../services/aiProvider');

function isAllowed(options, origin) {
  let result;
  options.origin(origin, (error, allowed) => {
    assert.equal(error, null);
    result = allowed;
  });
  return result;
}

test('production CORS allows explicitly configured origins only', () => {
  const options = createCorsOptions({ NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example.com, https://staging.example.com/' });
  assert.equal(isAllowed(options, 'https://app.example.com'), true);
  assert.equal(isAllowed(options, 'https://staging.example.com'), true);
  assert.equal(isAllowed(options, 'https://other.example.com'), false);
  assert.equal(isAllowed(options, 'http://localhost:8081'), false);
  assert.equal(isAllowed(options, undefined), true);
});

test('development CORS keeps loopback and private LAN origins available', () => {
  const options = createCorsOptions({ NODE_ENV: 'development', CORS_ORIGINS: '' });
  assert.equal(isAllowed(options, 'http://localhost:8081'), true);
  assert.equal(isAllowed(options, 'http://192.168.1.12:8081'), true);
  assert.equal(isAllowed(options, 'https://unlisted.example.com'), false);
});

test('health reports a healthy stateless backend and device-local player storage', () => {
  assert.deepEqual(getHealthState(), {
    status: 'healthy',
    backendStatus: 'available',
    database: 'not used; player data is stored locally on the device',
  });
  assert.equal(getHealthState().status, 'healthy');
});

test('chat and nutrition return real provider errors while quests retain their existing fallback', async () => {
  const originalGenerateResponse = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: false, error: 'Ollama unavailable in test' });
  const makeResponse = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  try {
    const chatResponse = makeResponse();
    await chat({ body: { message: 'Give me a workout routine' } }, chatResponse);
    assert.equal(chatResponse.statusCode, 502);
    assert.equal(chatResponse.body.success, false);
    assert.equal(chatResponse.body.errorType, 'OLLAMA_PROVIDER_ERROR');

    const nutritionResponse = makeResponse();
    await generateNutritionRecommendations({ body: { fitnessGoal: 'Strength' } }, nutritionResponse);
    assert.equal(nutritionResponse.statusCode, 502);
    assert.equal(nutritionResponse.body.success, false);
    assert.equal(nutritionResponse.body.errorType, 'OLLAMA_PROVIDER_ERROR');

    const questResponse = makeResponse();
    await generateRecommendations({ body: { goal: 'Study consistency', category: 'Study', availableMinutes: 45 } }, questResponse);
    assert.equal(questResponse.statusCode, 200);
    assert.equal(questResponse.body.mode, 'local-first-gateway');
    assert.equal(questResponse.body.data.length, 3);
  } finally {
    aiProvider.generateResponse = originalGenerateResponse;
  }
});
