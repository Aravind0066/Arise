// Frontend API wrapper tests using Node's built-in test runner
import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAI,
  getApiBaseUrl,
  getWeaknessRecommendations,
  getNutritionRecommendations,
  chatWithAI,
  generateQuests,
  checkCloudHealth,
  getExpoDevelopmentApiBaseUrl,
  getSafeApiBaseUrlForDiagnostics,
} from '../lib/api.ts';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('API wrapper', () => {
  test('normalizes a configured host to the backend API path', () => {
    const previous = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:5000/';
    assert.equal(getApiBaseUrl(), 'http://127.0.0.1:5000/api');
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = previous;
  });

  test('native Expo development requests target the machine hosting the Expo packager', () => {
    assert.equal(getExpoDevelopmentApiBaseUrl('192.168.1.25:8081'), 'http://192.168.1.25:5000/api');
    assert.equal(getExpoDevelopmentApiBaseUrl('bad host'), null);
    assert.equal(getExpoDevelopmentApiBaseUrl(undefined), null);
  });

  test('safe diagnostics show the API endpoint without URL credentials or query secrets', () => {
    const previous = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = 'https://user:pass@example.test/api?token=private#fragment';
    try {
      assert.equal(getSafeApiBaseUrlForDiagnostics(), 'https://example.test/api');
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = previous;
    }
  });

  test('production requires an explicit public HTTPS API URL', () => {
    const previousUrl = process.env.EXPO_PUBLIC_API_URL;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      delete process.env.EXPO_PUBLIC_API_URL;
      assert.throws(() => getApiBaseUrl(), /must be set.*production/);
      process.env.EXPO_PUBLIC_API_URL = 'http://localhost:5000';
      assert.throws(() => getApiBaseUrl(), /public HTTPS/);
      process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/';
      assert.equal(getApiBaseUrl(), 'https://api.example.com/api');
    } finally {
      if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = previousUrl;
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  test('generateAI returns reply on success', async () => {
    const mockReply = { success: true, data: { reply: 'Hello' } };
    global.fetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: () => Promise.resolve(JSON.stringify(mockReply)),
      });
    const res = await generateAI({ prompt: 'Hi' });
    assert.deepStrictEqual(res, mockReply);
  });

  test('generateAI throws on empty prompt', async () => {
    await assert.rejects(
      generateAI({ prompt: '   ' }),
      /Prompt must be a non‑empty string/
    );
  });

  test('chatWithAI validates length', async () => {
    await assert.rejects(
      chatWithAI({ message: 'a'.repeat(2001) }),
      /Message exceeds maximum length of 2000 characters/
    );
  });

  test('chatWithAI returns top-level reply on success', async () => {
    const mockReply = { success: true, reply: 'Hunter, keep pushing forward.' };
    global.fetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: () => Promise.resolve(JSON.stringify(mockReply)),
      });
    const res = await chatWithAI({ message: 'Give me motivation' });
    assert.deepStrictEqual(res, mockReply);
  });

  test('reports an HTML response as a server configuration error', async () => {
    global.fetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'text/html; charset=utf-8' },
        text: () => Promise.resolve('<!DOCTYPE html><html>Expo</html>'),
      });

    await assert.rejects(
      chatWithAI({ message: 'Hello' }),
      /HTML\/text instead of JSON|API base URL is correct/
    );
  });

  test('reports HTML body even when Content-Type is missing (no raw JSON parse error)', async () => {
    global.fetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve('<!DOCTYPE html><html><body>Cannot POST /api/chat</body></html>'),
      });

    await assert.rejects(
      chatWithAI({ message: 'Hello' }),
      /HTML\/text instead of JSON|API base URL is correct/
    );
  });

  test('reports JSON API 404 without JSON parse exception', async () => {
    global.fetch = () =>
      Promise.resolve({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        text: () =>
          Promise.resolve(JSON.stringify({ success: false, error: 'Endpoint not found: POST /api/chat' })),
      });

    await assert.rejects(
      chatWithAI({ message: 'Hello' }),
      /Endpoint not found/
    );
  });

  test('malformed JSON diagnostics do not expose API URL credentials, query values, or body contents', async () => {
    const previous = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = 'https://user:secret@example.test/api?token=private';
    global.fetch = () => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: () => Promise.resolve('{"sensitive":"private response content"'),
    });
    try {
      await assert.rejects(chatWithAI({ message: 'Hello' }), (error) => {
        assert.match(error.message, /invalid or malformed JSON/);
        assert.match(error.message, /https:\/\/example\.test\/api\/chat/);
        assert.doesNotMatch(error.message, /secret|token=private|sensitive|private response/);
        return true;
      });
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = previous;
    }
  });

  test('non-JSON HTTP errors do not expose raw server or proxy response bodies', async () => {
    global.fetch = () => Promise.resolve({
      ok: false,
      status: 502,
      headers: { get: () => 'text/html' },
      text: () => Promise.resolve('<html>stack trace with private token</html>'),
    });
    await assert.rejects(chatWithAI({ message: 'Hello' }), (error) => {
      assert.match(error.message, /HTTP 502 with a non-JSON response/);
      assert.doesNotMatch(error.message, /stack trace|private token/);
      return true;
    });
  });

  test('reports an unreachable backend without exposing a JSON parse error', async () => {
    global.fetch = () => Promise.reject(new TypeError('fetch failed'));

    await assert.rejects(
      chatWithAI({ message: 'Hello' }),
      { kind: 'backend', message: /Could not connect to the HunterOS backend/, diagnostic: /API http:\/\/localhost:5000\/api · fetch error: fetch failed/ }
    );
  });

  test('reports backend connectivity separately from Ollama model readiness', async () => {
    global.fetch = () => Promise.resolve({
      ok: true, status: 200, headers: { get: () => 'application/json' },
      text: () => Promise.resolve(JSON.stringify({
        status: 'healthy', backendStatus: 'available', uptimeSeconds: 1, timestamp: new Date().toISOString(),
        cloudService: 'local', database: 'device local',
        aiProvider: { status: 'model_missing', model: 'qwen3:4b', message: 'Configured model is not installed.' },
      })),
    });
    const result = await checkCloudHealth();
    assert.equal(result.isOnline, true);
    assert.equal(result.backendStatus, 'available');
    assert.equal(result.aiProvider.status, 'model_missing');
    assert.equal(result.aiProvider.message, 'Configured model is not installed.');
  });

  test('preserves actionable Ollama model and timeout diagnostics from the backend', async () => {
    global.fetch = () => Promise.resolve({
      ok: false, status: 502, headers: { get: () => 'application/json' },
      text: () => Promise.resolve(JSON.stringify({ success: false, errorType: 'MODEL_NOT_FOUND', error: 'Configured Ollama model "qwen3:4b" is not installed.' })),
    });
    await assert.rejects(chatWithAI({ message: 'Hello' }), { kind: 'ai', message: /Configured Ollama model.*not installed/ });
    global.fetch = () => Promise.resolve({
      ok: false, status: 504, headers: { get: () => 'application/json' },
      text: () => Promise.resolve(JSON.stringify({ success: false, errorType: 'GENERATION_TIMEOUT', error: 'Ollama request timed out after 120000ms.' })),
    });
    await assert.rejects(chatWithAI({ message: 'Hello' }), { kind: 'ai', message: /timed out after 120000ms/ });
  });

  test('does not present a backend fallback as a live Hunter AI answer', async () => {
    global.fetch = () => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: () => Promise.resolve(JSON.stringify({ success: true, fallback: true, reply: 'Local fallback' })),
    });
    await assert.rejects(chatWithAI({ message: 'Hello' }), { kind: 'ai' });
  });

  test('rejects nutrition fallback and preserves explicit fallback markers for quest generation', async () => {
    global.fetch = () => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: () => Promise.resolve(JSON.stringify({
        success: true,
        fallback: true,
        source: 'hunteros-engine',
        recommendations: [],
        data: [
          { title: 'Local quest one', description: 'Marked fallback.', durationMinutes: 25, xpReward: 40 },
          { title: 'Local quest two', description: 'Marked fallback.', durationMinutes: 20, xpReward: 30 },
          { title: 'Local quest three', description: 'Marked fallback.', durationMinutes: 10, xpReward: 20 },
        ],
      })),
    });
    await assert.rejects(getNutritionRecommendations({ fitnessGoal: 'Strength' }), { kind: 'ai' });
    const weakness = await getWeaknessRecommendations({ goals: [], stats: {}, recentQuests: [] });
    assert.equal(weakness.fallback, true);
    assert.equal(weakness.source, 'hunteros-engine');
    const quests = await generateQuests({ goal: 'Study', category: 'Study', availableMinutes: 30, difficulty: 'Beginner' });
    assert.equal(quests.fallback, true);
    assert.equal(quests.source, 'hunteros-engine');
    assert.ok(quests.data.every((quest) => quest.generatedBy === 'system' && quest.fallback));
  });

  test('classifies provider quota responses separately from server failures', async () => {
    global.fetch = () => Promise.resolve({
      ok: false,
      status: 429,
      headers: { get: () => 'application/json' },
      text: () => Promise.resolve(JSON.stringify({ error: 'Quota exceeded' })),
    });
    await assert.rejects(chatWithAI({ message: 'Hello' }), {
      kind: 'ai',
      message: 'Hunter AI is temporarily unavailable. Please try again later.',
    });
  });

  test('classifies an unlabelled backend gateway failure as a server error', async () => {
    global.fetch = () => Promise.resolve({
      ok: false,
      status: 502,
      headers: { get: () => 'application/json' },
      text: () => Promise.resolve(JSON.stringify({ error: 'Backend gateway is unavailable' })),
    });
    await assert.rejects(chatWithAI({ message: 'Hello' }), { kind: 'backend' });
  });

  test('success mocks without content-type header still parse JSON bodies', async () => {
    const mockReply = { success: true, reply: 'Ready.' };
    global.fetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify(mockReply)),
      });
    const res = await chatWithAI({ message: 'ping' });
    assert.deepStrictEqual(res, mockReply);
  });

  test('weakness recommendations forward payload and return recommendations', async () => {
    const mockResp = {
      success: true,
      recommendations: [
        {
          title: 'Iron Will Drill',
          description: 'Progressive overload session.',
          category: 'Fitness',
          estimatedDuration: 30,
          difficulty: 'Beginner',
          deadline: new Date(Date.now() + 3600000).toISOString(),
          suggestedReward: 60,
        },
      ],
    };
    let capturedBody = '';
    global.fetch = (url, options) => {
      capturedBody = options?.body || '';
      assert.match(String(url), /\/weakness$/);
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: () => Promise.resolve(JSON.stringify(mockResp)),
      });
    };
    const res = await getWeaknessRecommendations({
      goals: ['Ascension'],
      stats: { strength: 30 },
      recentQuests: [],
      availableMinutes: 45,
      preferredCategories: ['Fitness'],
      completedQuests: [],
    });
    assert.deepStrictEqual(res, mockResp);
    assert.equal(res.recommendations.length, 1);
    const parsed = JSON.parse(capturedBody);
    assert.deepEqual(parsed.goals, ['Ascension']);
    assert.equal(parsed.availableMinutes, 45);
  });

  test('nutrition recommendations forward payload and return recommendations', async () => {
    const mockResp = {
      success: true,
      recommendations: [
        {
          name: 'Power Bowl',
          ingredients: ['rice', 'chicken'],
          portions: '1 bowl',
          steps: ['Cook', 'Combine'],
        },
      ],
      fallback: false,
    };
    mockResp.data = mockResp.recommendations;
    global.fetch = (url) => {
      assert.match(String(url), /\/nutrition$/);
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: () => Promise.resolve(JSON.stringify(mockResp)),
      });
    };
    const res = await getNutritionRecommendations({ fitnessGoal: 'Muscle', prepTimeMinutes: 30 });
    assert.deepStrictEqual(res, mockResp);
    assert.equal(res.fallback, false);
    assert.deepEqual(res.data, res.recommendations);
  });
});
