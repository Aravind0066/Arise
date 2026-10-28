import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';


const require = createRequire(import.meta.url);
const { generate } = require('../controllers/aiController');
const aiProvider = require('../services/aiProvider');



function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

// 1. Valid input – service returns success
test('AI Route: valid prompt returns success', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: true, data: { result: 'ok' } });
  const req = { body: { prompt: 'Hello' } };
  const res = mockRes();
  await generate(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data, { result: 'ok' });
  aiProvider.generateResponse = original;
});

test('AI Route: workout requests pass the workout JSON schema to Ollama', async () => {
  const original = aiProvider.generateResponse;
  let providerOptions;
  aiProvider.generateResponse = async (_prompt, options) => {
    providerOptions = options;
    return { success: true, data: { result: 'ok' } };
  };
  const req = { body: { prompt: 'Return workout JSON', responseFormat: 'workout' } };
  const res = mockRes();
  await generate(req, res);
  assert.equal(providerOptions.responseMode, 'json');
  assert.equal(providerOptions.feature, 'workout');
  assert.equal(providerOptions.format.properties.exercises.type, 'array');
  aiProvider.generateResponse = original;
});

// 2. Invalid input – missing prompt
test('AI Route: missing prompt returns 400', async () => {
  const req = { body: {} };
  const res = mockRes();
  await generate(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Prompt'));
});

// 3. Service reports rate limit error
test('AI Route: service rate limit error returns 502 with message', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: false, error: 'Rate limit exceeded' });
  const req = { body: { prompt: 'test' } };
  const res = mockRes();
  await generate(req, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Rate limit'));
  assert.equal(res.body.errorType, 'OLLAMA_PROVIDER_ERROR');
  aiProvider.generateResponse = original;
});
