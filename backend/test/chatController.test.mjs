import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chat } = require('../controllers/chatController');
const geminiService = require('../services/geminiService');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

// 1. Valid message → returns success with top-level reply
test('Chat: valid message returns success with top-level reply', async () => {
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({ success: true, data: 'Great advice, Hunter!' });

  const req = { body: { message: 'How do I study better?' } };
  const res = mockRes();
  await chat(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(typeof res.body.reply, 'string', 'reply must be a string at top level');
  assert.ok(res.body.reply.length > 0, 'reply must be non-empty');
  // data envelope also present for backward compat
  assert.ok(res.body.data, 'data envelope must be present');
  assert.equal(typeof res.body.data.reply, 'string');

  geminiService.generateResponse = original;
});

// 2. Empty message → 400
test('Chat: empty message returns 400', async () => {
  const req = { body: { message: '' } };
  const res = mockRes();
  await chat(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Message is required'));
});

// 3. Missing message → 400
test('Chat: missing message returns 400', async () => {
  const req = { body: {} };
  const res = mockRes();
  await chat(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

// 4. Gemini fails → uses deterministic fallback (still success=true)
test('Chat: Gemini failure falls back to deterministic reply', async () => {
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({ success: false, error: 'API error' });

  const req = { body: { message: 'workout routine' } };
  const res = mockRes();
  await chat(req, res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.fallback, true);
  assert.equal(typeof res.body.reply, 'string');
  assert.ok(res.body.reply.length > 0);

  geminiService.generateResponse = original;
});

// 5. Message too long → 400
test('Chat: message exceeding 2000 chars returns 400', async () => {
  const req = { body: { message: 'x'.repeat(2001) } };
  const res = mockRes();
  await chat(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('2000'));
});

// 6. Valid history array accepted
test('Chat: valid history array accepted', async () => {
  const original = geminiService.generateResponse;
  geminiService.generateResponse = async () => ({ success: true, data: 'Roger that, Hunter.' });

  const req = {
    body: {
      message: 'Next step?',
      history: [
        { role: 'user', content: 'How do I start?' },
        { role: 'assistant', content: 'Begin with basics.' },
      ],
    },
  };
  const res = mockRes();
  await chat(req, res);
  assert.equal(res.body.success, true);
  assert.equal(typeof res.body.reply, 'string');

  geminiService.generateResponse = original;
});
