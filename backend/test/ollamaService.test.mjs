import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const provider = require('../services/aiProvider');

test('Ollama provider defaults are local and model configurable', () => {
  assert.equal(provider.DEFAULT_BASE_URL, 'http://127.0.0.1:11434');
  assert.equal(provider.DEFAULT_MODEL, 'qwen3:4b');
  assert.equal(provider.parseContent('{"items":[1]}').items[0], 1);
  assert.equal(provider.parseContent('Plain response'), 'Plain response');
  assert.deepEqual(provider.parseContent('```json\n{"ok":true}\n```'), { ok: true });
  assert.deepEqual(provider.parseContent('Result:\n{"items":[{"x":1}]}\nDone.'), { items: [{ x: 1 }] });
});

test('Ollama JSON mode keeps think disabled so structured output stays in content', async () => {
  const originalFetch = global.fetch;
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ message: { content: '{"ok":true}' } }) };
  };
  try {
    await provider.generateResponse('Return JSON', { responseMode: 'json', format: { type: 'object' } });
    assert.equal(requestBody.think, false);
  } finally { global.fetch = originalFetch; }
});

test('Ollama provider sends structured JSON format and repairs fenced JSON output', async () => {
  const originalFetch = global.fetch;
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ message: { content: '```json\n{"title":"Test","exercises":[]}\n```' } }) };
  };
  try {
    const schema = { type: 'object', required: ['title'] };
    const result = await provider.generateResponse('Return workout JSON', { responseMode: 'json', format: schema, feature: 'workout' });
    assert.deepEqual(requestBody.format, schema);
    assert.equal(result.success, true);
    assert.equal(result.data.title, 'Test');
  } finally { global.fetch = originalFetch; }
});

test('Ollama provider rejects malformed structured JSON but keeps ordinary chat text', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({ message: { content: '{not valid json' } }) });
    const invalid = await provider.generateResponse('Return a JSON array', { responseMode: 'json' });
    assert.equal(invalid.success, false);
    assert.equal(invalid.errorType, 'MALFORMED_MODEL_OUTPUT');
    global.fetch = async () => ({ ok: true, json: async () => ({ message: { content: 'A normal reply, with { braces } in the text.' } }) });
    const chat = await provider.generateResponse('Chat naturally', { responseMode: 'text' });
    assert.equal(chat.success, true);
    assert.equal(chat.data, 'A normal reply, with { braces } in the text.');
  } finally { global.fetch = originalFetch; }
});

test('Ollama chat response is parsed and model is passed in request', async () => {
  const originalFetch = global.fetch;
  const originalBase = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434/';
  process.env.OLLAMA_MODEL = 'fine-tuned-test';
  global.fetch = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'fine-tuned-test');
    assert.equal(body.stream, false);
    return { ok: true, json: async () => ({ message: { content: '{"ok":true}' } }) };
  };
  try {
    assert.deepEqual(await provider.generateResponse('Return JSON'), {
      success: true, data: { ok: true }, provider: 'ollama', model: 'fine-tuned-test',
    });
  } finally {
    global.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.OLLAMA_BASE_URL; else process.env.OLLAMA_BASE_URL = originalBase;
    if (originalModel === undefined) delete process.env.OLLAMA_MODEL; else process.env.OLLAMA_MODEL = originalModel;
  }
});

test('Ollama chat sends Hunter system/history separately and ignores a separate thinking field', async () => {
  const originalFetch = global.fetch;
  let body;
  global.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ message: { role: 'assistant', content: 'Good morning, Hunter.', thinking: 'private reasoning that must never display' } }) };
  };
  try {
    const result = await provider.generateResponse('Hi', {
      responseMode: 'text',
      system: 'Be concise.',
      historyMessages: [{ role: 'user', content: 'Earlier question' }],
      generationOptions: { num_predict: 1536 },
    });
    assert.equal(body.think, true);
    assert.deepEqual(body.messages.map(({ role }) => role), ['system', 'user', 'user']);
    assert.equal(body.messages[0].content, 'Be concise.');
    assert.equal(body.messages[1].content, 'Earlier question');
    assert.equal(body.options.num_predict, 1536);
    assert.equal(result.data, 'Good morning, Hunter.');
    assert.equal(result.data.includes('private reasoning'), false);
  } finally { global.fetch = originalFetch; }
});

test('Ollama provider reports unavailable service, missing model, malformed body, and timeouts safely', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => { throw new TypeError('fetch failed'); };
    const unavailable = await provider.generateResponse('hello');
    assert.match(unavailable.error, /not reachable/);
    assert.equal(unavailable.errorType, 'OLLAMA_UNAVAILABLE');
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({ error: 'model not found' }) });
    const missing = await provider.generateResponse('hello');
    assert.match(missing.error, /ollama pull qwen3:4b/);
    assert.equal(missing.errorType, 'MODEL_NOT_FOUND');
    global.fetch = async () => ({ ok: true, json: async () => ({ message: {} }) });
    assert.match((await provider.generateResponse('hello')).error, /malformed or empty/);
    global.fetch = async () => ({ ok: true, json: async () => ({ message: { content: '', thinking: 'internal only' } }) });
    const thinkingOnly = await provider.generateResponse('hello', { responseMode: 'text' });
    assert.match(thinkingOnly.error, /reasoning budget/);
    assert.equal(thinkingOnly.errorType, 'INVALID_PROVIDER_RESPONSE');
    global.fetch = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
      const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
    }, { once: true }));
    const timeout = await provider.generateResponse('hello', { timeout: 5 });
    assert.match(timeout.error, /timed out/);
    assert.equal(timeout.errorType, 'GENERATION_TIMEOUT');
  } finally { global.fetch = originalFetch; }
});

test('Ollama availability check distinguishes unreachable service from missing and installed models', async () => {
  const originalFetch = global.fetch;
  const originalBase = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;
  process.env.OLLAMA_BASE_URL = 'http://ollama.test:11434';
  process.env.OLLAMA_MODEL = 'configured:1b';
  try {
    global.fetch = async (url) => { assert.equal(url, 'http://ollama.test:11434/api/tags'); throw new TypeError('fetch failed'); };
    assert.equal((await provider.checkAvailability()).status, 'ollama_unavailable');
    global.fetch = async () => ({ ok: true, json: async () => ({ models: [{ name: 'other:1b' }] }) });
    assert.equal((await provider.checkAvailability()).status, 'model_missing');
    global.fetch = async () => ({ ok: true, json: async () => ({ models: [{ name: 'configured:1b' }] }) });
    const result = await provider.checkAvailability();
    assert.equal(result.status, 'model_ready');
    assert.match(result.message, /inference has not been checked/);
  } finally {
    global.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.OLLAMA_BASE_URL; else process.env.OLLAMA_BASE_URL = originalBase;
    if (originalModel === undefined) delete process.env.OLLAMA_MODEL; else process.env.OLLAMA_MODEL = originalModel;
  }
});

test('provider maps model missing, malformed output, and timeout to distinct statuses', () => {
  assert.equal(provider.responseStatusFor('MODEL_NOT_FOUND'), 503);
  assert.equal(provider.responseStatusFor('OLLAMA_UNAVAILABLE'), 503);
  assert.equal(provider.responseStatusFor('GENERATION_TIMEOUT'), 504);
  assert.equal(provider.responseStatusFor('MALFORMED_MODEL_OUTPUT'), 502);
  assert.equal(provider.responseStatusFor('OUTPUT_SCHEMA_VALIDATION_FAILED'), 502);
});
