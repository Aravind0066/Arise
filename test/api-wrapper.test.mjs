// Frontend API wrapper tests using Node's built-in test runner
import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAI,
  getApiBaseUrl,
  getWeaknessRecommendations,
  getNutritionRecommendations,
  chatWithAI,
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

  test('reports an unreachable backend without exposing a JSON parse error', async () => {
    global.fetch = () => Promise.reject(new TypeError('fetch failed'));

    await assert.rejects(
      chatWithAI({ message: 'Hello' }),
      /Unable to connect to HunterOS backend/
    );
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
