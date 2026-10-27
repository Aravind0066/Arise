import test from 'node:test';
import assert from 'node:assert/strict';

import pkg from '../services/geminiService.js';
const { generateResponse, _internal } = pkg;

// Helper to temporarily set env variable
function withEnv(key, value, fn) {
  const old = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try { fn(); } finally { if (old === undefined) delete process.env[key]; else process.env[key] = old; }
}

// Test missing API key
test('Gemini Service: returns error when GEMINI_API_KEY missing', async () => {
  withEnv('GEMINI_API_KEY', undefined, async () => {
    const result = await generateResponse('test prompt');
    assert.equal(result.success, false);
    assert.ok(result.error.includes('GEMINI_API_KEY'));
  });
});

test('Gemini Service: remaps shut-down / hanging model aliases to gemini-3.5-flash', () => {
  assert.equal(_internal.resolveModel('gemini-2.0-flash'), 'gemini-3.5-flash');
  assert.equal(_internal.resolveModel('gemini-3.5-flash-lite'), 'gemini-3.5-flash');
  assert.equal(_internal.resolveModel('gemini-3.5-flash'), 'gemini-3.5-flash');
  assert.equal(_internal.resolveModel(undefined), 'gemini-3.5-flash');
});

// Test handling of rate limit error
test('Gemini Service: handles rate limit (429) error gracefully', async () => {
  // Mock client that throws error with code 429
  const mockClient = {
    getGenerativeModel: () => ({
      generateContent: () => {
        const err = new Error('Rate limit');
        err.code = 429;
        throw err;
      },
    }),
  };
  // Override internal getClient
  const originalGetClient = _internal.getClient;
  _internal.getClient = () => mockClient;

  try {
    const result = await generateResponse('test prompt');
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Rate limit'));
  } finally {
    // Restore original
    _internal.getClient = originalGetClient;
  }
});
