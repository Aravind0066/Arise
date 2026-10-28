import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const questRoutes = require('../routes/questRoutes');
const weaknessRoutes = require('../routes/weaknessRecommendationRoutes');
const chatRoutes = require('../routes/chatRoutes');
const aiProvider = require('../services/aiProvider');

test('Express mounts the intended quest endpoints and their handlers return the frontend contract', async () => {
  const original = aiProvider.generateResponse;
  aiProvider.generateResponse = async (_prompt, options) => {
    if (options.feature === 'quest-generate') {
      return { success: true, data: [
        { title: 'Focus block', description: 'Study one lesson.', durationMinutes: 25, xpReward: 40 },
        { title: 'Recall drill', description: 'Recall the key ideas.', durationMinutes: 15, xpReward: 30 },
        { title: 'Review note', description: 'Write a short summary.', durationMinutes: 10, xpReward: 20 },
      ] };
    }
    if (options.feature === 'chat') {
      return { success: true, data: 'Hello, Hunter. Ready when you are.' };
    }
    return { success: true, data: [
      { title: 'Strength session', description: 'Complete the planned sets.', category: 'Fitness', estimatedDuration: 30, difficulty: 'Beginner', suggestedReward: 40 },
      { title: 'Recall session', description: 'Review a saved topic.', category: 'Study', estimatedDuration: 20, difficulty: 'Intermediate', suggestedReward: 35 },
      { title: 'Plan session', description: 'Set the next target.', category: 'Discipline', estimatedDuration: 15, difficulty: 'Beginner', suggestedReward: 25 },
    ] };
  };

  const serverSource = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  try {
    assert.match(serverSource, /app\.use\(["']\/api\/quests["'],\s*questRoutes\)/);
    assert.match(serverSource, /app\.use\(["']\/api\/weakness["'],\s*weaknessRoutes\)/);
    assert.match(serverSource, /app\.use\(["']\/api\/chat["'],\s*chatRoutes\)/);
    const questRoute = questRoutes.stack.find((layer) => layer.route?.path === '/generate' && layer.route.methods.post);
    const weaknessRoute = weaknessRoutes.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.post);
    const chatRoute = chatRoutes.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.post);
    assert.ok(questRoute, 'POST /api/quests/generate is registered');
    assert.ok(weaknessRoute, 'POST /api/weakness is registered');
    assert.ok(chatRoute, 'POST /api/chat is registered');
    const invoke = async (route, body) => {
      const handler = route.route.stack[0].handle;
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
      await handler({ body }, res);
      return res;
    };
    const quest = await invoke(questRoute, { goal: 'study', category: 'Study', availableMinutes: 45 });
    const questBody = quest.body;
    assert.equal(quest.statusCode, 200);
    assert.equal(questBody.success, true);
    assert.equal(questBody.fallback, false);
    assert.equal(questBody.data.length, 3);
    assert.equal(questBody.data[0].generatedBy, 'ai');

    const weakness = await invoke(weaknessRoute, { goals: ['conditioning'], stats: { strength: 30, knowledge: 40, discipline: 35, health: 40, mindfulness: 35 } });
    const weaknessBody = weakness.body;
    assert.equal(weakness.statusCode, 200);
    assert.equal(weaknessBody.success, true);
    assert.equal(weaknessBody.fallback, false);
    assert.equal(weaknessBody.recommendations.length, 3);
    assert.equal(weaknessBody.data[0].title, 'Strength session');

    const chat = await invoke(chatRoute, { message: 'Hello' });
    assert.equal(chat.statusCode, 200);
    assert.equal(chat.body.success, true);
    assert.equal(chat.body.fallback, false);
    assert.equal(chat.body.reply, 'Hello, Hunter. Ready when you are.');
  } finally {
    aiProvider.generateResponse = original;
  }
});
