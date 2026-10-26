import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';


const require = createRequire(import.meta.url);
const { generate } = require('../controllers/aiController');
const geminiService = require('../services/geminiService');



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
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({ success: true, data: { result: 'ok' } });
  const req = { body: { prompt: 'Hello' } };
  const res = mockRes();
  await generate(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data, { result: 'ok' });
  geminiService.generateResponse = original;
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
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({ success: false, error: 'Rate limit exceeded' });
  const req = { body: { prompt: 'test' } };
  const res = mockRes();
  await generate(req, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Rate limit'));
  geminiService.generateResponse = original;
});
