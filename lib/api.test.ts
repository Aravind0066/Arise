// Frontend API wrapper tests using Node's built‑in test runner
import { describe, test, afterEach, after } from 'node:test';
import { strict as assert } from 'assert';
import { generateAI, getWeaknessRecommendations, getNutritionRecommendations, chatWithAI } from './api';
import type { ApiResponse, AiGenerateInput, WeaknessInput, NutritionInput, ChatInput } from './hunterTypes';

const originalFetch = global.fetch as any;

afterEach(() => {
  // restore original fetch after each test
  global.fetch = originalFetch;
});

after(() => {
  // no special cleanup needed
});

describe('API wrapper', () => {
  test('generateAI returns reply on success', async () => {
    const mockReply = { success: true, data: { reply: 'Hello' } } as ApiResponse<{ reply: string }>;
    global.fetch = ((...args: any[]) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockReply),
      })
    ) as any;
    const input: AiGenerateInput = { prompt: 'Hi' };
    const res = await generateAI(input);
    assert.deepStrictEqual(res, mockReply);
  });

  test('generateAI throws on empty prompt', async () => {
    await assert.rejects(
      generateAI({ prompt: '   ' }),
      /Prompt must be a non‑empty string/
    );
  });

  test('chatWithAI validates length', async () => {
    const longMessage = 'a'.repeat(2001);
    const payload: ChatInput = { message: longMessage };
    await assert.rejects(
      chatWithAI(payload),
      /Message exceeds maximum length of 2000 characters/
    );
  });

  test('weakness recommendations forward payload', async () => {
    const mockResp = { success: true, data: [] } as ApiResponse<any[]>;
    global.fetch = ((...args: any[]) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockResp) })
    ) as any;
    const payload: WeaknessInput = { goals: [], stats: {}, completedQuests: [] };
    const res = await getWeaknessRecommendations(payload);
    assert.strictEqual(res, mockResp);
  });

  test('nutrition recommendations forward payload', async () => {
    const mockResp = { success: true, data: [] } as ApiResponse<any[]>;
    global.fetch = ((...args: any[]) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockResp) })
    ) as any;
    const payload: NutritionInput = {};
    const res = await getNutritionRecommendations(payload);
    assert.strictEqual(res, mockResp);
  });
});
