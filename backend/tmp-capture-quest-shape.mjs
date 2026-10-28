import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const aiProvider = require('./services/aiProvider.js');
const { generatedQuestsSchema, extractJsonArray } = require('./utils/outputSchemas.js');

const prompt = [
  "You are HunterOS's friendly RPG-themed directive generator.",
  'Create exactly 3 quests for the goal: Study for 30 minutes',
  'Category: Study. Difficulty: Beginner. Available time: 45 minutes.',
  'Use epic System terminology (e.g., IRON PROTOCOL, SHADOW RECON, SYNAPSE ENCRYPTION).',
  'Return only a JSON object { "quests": [ ... ] } matching the supplied structured-output schema, with exactly 3 objects. Each object needs title, description, xpReward, and durationMinutes. No markdown or commentary.',
].join('\n');

const result = await aiProvider.generateResponse(prompt, { responseMode: 'json', format: generatedQuestsSchema, feature: 'quest-generate' });
const extracted = result.success ? extractJsonArray(result.data, ['quests', 'recommendations', 'items', 'tasks', 'data']) : null;
const items = Array.isArray(extracted) ? extracted : [];
const itemShapes = items.slice(0, 5).map((item) => {
  if (!item || typeof item !== 'object') return { type: typeof item };
  const durationMinutes = item.durationMinutes ?? item.estimatedDuration ?? item.duration_minutes;
  const xpReward = item.xpReward ?? item.suggestedReward ?? item.xp_reward;
  return {
    keys: Object.keys(item).slice(0, 16),
    durationMinutesType: typeof durationMinutes,
    durationMinutesInteger: Number.isInteger(durationMinutes),
    xpRewardType: typeof xpReward,
    xpRewardInteger: Number.isInteger(xpReward),
    hasTitle: typeof item.title === 'string' && item.title.trim().length > 0,
    hasDescription: typeof item.description === 'string' && item.description.trim().length > 0,
  };
});

console.log(JSON.stringify({
  success: result.success,
  errorType: result.errorType,
  dataShape: aiProvider.describeOutputShape(result.data),
  extractedLength: Array.isArray(extracted) ? extracted.length : null,
  extractedIsNull: extracted === null,
  itemShapes,
}, null, 2));
