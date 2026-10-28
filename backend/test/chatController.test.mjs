import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chat } = require('../controllers/chatController');
const aiProvider = require('../services/aiProvider');

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
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: true, data: 'Great advice, Hunter!' });

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

  aiProvider.generateResponse = original;
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

// 4. Ollama failure stays an error; chat text is not fabricated.
test('Chat: provider failure returns an actionable AI error without deterministic fallback', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: false, error: 'API error' });

  const req = { body: { message: 'workout routine' } };
  const res = mockRes();
  await chat(req, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.success, false);
  assert.equal(res.body.errorType, 'OLLAMA_PROVIDER_ERROR');
  assert.equal(res.body.reply, undefined);

  aiProvider.generateResponse = original;
});

test('Chat: provider is asked for plain text and ordinary replies remain text', async () => {
  const original = aiProvider.generateResponse;
  let options;
  aiProvider.generateResponse = async (prompt, received) => {
    assert.equal(prompt, 'How can I focus?');
    options = received;
    return { success: true, data: 'Here is a useful reply.' };
  };
  const res = mockRes();
  await chat({ body: { message: 'How can I focus?' } }, res);
  assert.equal(options.responseMode, 'text');
  assert.match(options.system, /friendly RPG-themed assistant/);
  assert.match(options.system, /only the final user-facing answer/);
  assert.equal(options.generationOptions.num_predict, 1536);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reply, 'Here is a useful reply.');
  assert.equal(res.body.fallback, false);
  aiProvider.generateResponse = original;
});

test('Chat: accepts Qwen final segment and excludes its explicit thinking segment', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: true, data: '<think>internal deliberation</think>Hello, Hunter!' });
  const res = mockRes();
  await chat({ body: { message: 'Hi' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reply, 'Hello, Hunter!');
  aiProvider.generateResponse = original;
});

test('Chat: rejects leaked reasoning and malformed output without returning it', async () => {
  const original = aiProvider.generateResponse;
  for (const output of ['Analysis: let me think through this', 'User message: hidden prompt', '<think>unclosed']) {
    aiProvider.generateResponse = async () => ({ success: true, data: output });
    const res = mockRes();
    await chat({ body: { message: 'Hi' } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.errorType, 'OUTPUT_SCHEMA_VALIDATION_FAILED');
    assert.equal(res.body.reply, undefined);
    assert.equal(JSON.stringify(res.body).includes(output), false);
  }
  aiProvider.generateResponse = original;
});

test('Chat: retries once when the first reply is invalid, then returns a clean answer', async () => {
  const original = aiProvider.generateResponse;
  let calls = 0;
  aiProvider.generateResponse = async () => {
    calls += 1;
    return calls === 1
      ? { success: true, data: 'Analysis: internal reasoning' }
      : { success: true, data: 'Hello, Hunter. Ready when you are.' };
  };
  const res = mockRes();
  await chat({ body: { message: 'Hi' } }, res);
  assert.equal(calls, 2);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reply, 'Hello, Hunter. Ready when you are.');
  aiProvider.generateResponse = original;
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
  const original = aiProvider.generateResponse;
  let receivedHistory;
  aiProvider.generateResponse = async (_prompt, options) => {
    receivedHistory = options.historyMessages;
    return { success: true, data: 'Roger that, Hunter.' };
  };

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
  assert.deepEqual(receivedHistory, [
    { role: 'user', content: 'How do I start?' },
    { role: 'assistant', content: 'Begin with basics.' },
  ]);

  aiProvider.generateResponse = original;
});

test('Chat: drops leaked assistant history instead of forwarding it to the provider', async () => {
  const original = aiProvider.generateResponse;
  let receivedHistory;
  aiProvider.generateResponse = async (_prompt, options) => {
    receivedHistory = options.historyMessages;
    return { success: true, data: 'Ready for the next question.' };
  };
  const res = mockRes();
  await chat({
    body: {
      message: 'What now?',
      history: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Analysis: hidden chain of thought' },
        { role: 'user', content: 'Again' },
        { role: 'assistant', content: 'Hello, Hunter.' },
      ],
    },
  }, res);
  assert.equal(res.body.success, true);
  assert.deepEqual(receivedHistory, [
    { role: 'user', content: 'Hi' },
    { role: 'user', content: 'Again' },
    { role: 'assistant', content: 'Hello, Hunter.' },
  ]);
  aiProvider.generateResponse = original;
});
