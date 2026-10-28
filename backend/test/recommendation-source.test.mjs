import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { generateRecommendations } = require('../controllers/recommendationController');
const aiProvider = require('../services/aiProvider');

function responseCapture() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('labels deterministic quest recommendations as fallback when Ollama is unavailable', async () => {
  
  const originalGenerateResponse = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({ success: false, error: 'Rate limit exceeded' });
  try {
    const res = responseCapture();
    await generateRecommendations({ body: { goal: 'study algebra', category: 'Study', availableMinutes: 30 } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.source, 'hunteros-engine');
    assert.equal(res.body.fallback, true);
  } finally {
    aiProvider.generateResponse = originalGenerateResponse;
  }
});

test('accepts parsed Ollama quest arrays through the shared service', async () => {
  const originalGenerateResponse = aiProvider.generateResponse;
  let options;
  aiProvider.generateResponse = async (_prompt, received) => {
    options = received;
    return {
    success: true,
    data: [
      { title: 'Focused study', description: 'Review one topic.', durationMinutes: 25, xpReward: 45 },
      { title: 'Practice recall', description: 'Recall the core concepts.', durationMinutes: 20, xpReward: 40 },
      { title: 'Plan next steps', description: 'Write the next review target.', durationMinutes: 10, xpReward: 30 },
    ],
  };
  };
  try {
    const res = responseCapture();
    await generateRecommendations({ body: { goal: 'study algebra', category: 'Study', availableMinutes: 30 } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.source, 'ollama-local');
    assert.equal(res.body.fallback, false);
    assert.equal(res.body.data[0].title, 'Focused study');
    assert.equal(options.feature, 'quest-generate');
    assert.equal(options.responseMode, 'json');
    assert.equal(options.format.type, 'object');
    assert.equal(options.format.properties.quests.minItems, 3);
    assert.equal(options.format.properties.quests.maxItems, 3);
    assert.equal(res.body.data.length, 3);
    assert.equal(res.body.data[0].generatedBy, 'ai');
  } finally {
    aiProvider.generateResponse = originalGenerateResponse;
  }
});

test('accepts Ollama quests wrapped in a { quests: [...] } object', async () => {
  const originalGenerateResponse = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({
    success: true,
    data: {
      quests: [
        { title: 'Focus block', description: 'Study one lesson.', durationMinutes: 25, xpReward: 40 },
        { title: 'Recall drill', description: 'Recall the key ideas.', durationMinutes: 15, xpReward: 30 },
        { title: 'Review note', description: 'Write a short summary.', durationMinutes: 10, xpReward: 20 },
      ],
    },
  });
  try {
    const res = responseCapture();
    await generateRecommendations({ body: { goal: 'study algebra', category: 'Study', availableMinutes: 30 } }, res);
    assert.equal(res.body.fallback, false);
    assert.equal(res.body.data.length, 3);
    assert.equal(res.body.data[0].title, 'Focus block');
  } finally {
    aiProvider.generateResponse = originalGenerateResponse;
  }
});

test('keeps live quests when Ollama returns more than three valid items', async () => {
  const originalGenerateResponse = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({
    success: true,
    data: {
      quests: [
        { title: 'Focus block', description: 'Study one lesson.', durationMinutes: 25, xpReward: 40 },
        { title: 'Recall drill', description: 'Recall the key ideas.', durationMinutes: 15, xpReward: 30 },
        { title: 'Review note', description: 'Write a short summary.', durationMinutes: 10, xpReward: 20 },
        { title: 'Extra protocol', description: 'An extra valid directive the model added.', durationMinutes: 12, xpReward: 22 },
      ],
    },
  });
  try {
    const res = responseCapture();
    await generateRecommendations({ body: { goal: 'study algebra', category: 'Study', availableMinutes: 30 } }, res);
    assert.equal(res.body.fallback, false);
    assert.equal(res.body.source, 'ollama-local');
    assert.equal(res.body.data.length, 3);
    assert.equal(res.body.data[0].title, 'Focus block');
    assert.equal(res.body.data[0].generatedBy, 'ai');
    assert.equal(res.body.data[2].title, 'Review note');
  } finally {
    aiProvider.generateResponse = originalGenerateResponse;
  }
});

test('falls back explicitly when Ollama returns one quest object instead of the required array', async () => {
  const originalGenerateResponse = aiProvider.generateResponse;
  aiProvider.generateResponse = async () => ({
    success: true,
    data: { title: 'One quest', description: 'A single item cannot satisfy the requested three.', durationMinutes: 25, xpReward: 40 },
  });
  try {
    const res = responseCapture();
    await generateRecommendations({ body: { goal: 'study algebra', category: 'Study', availableMinutes: 30 } }, res);
    assert.equal(res.body.fallback, true);
    assert.equal(res.body.source, 'hunteros-engine');
    assert.equal(res.body.fallbackReason, 'OUTPUT_SCHEMA_VALIDATION_FAILED');
    assert.equal(res.body.data.length, 3);
    assert.ok(res.body.data.every((quest) => quest.generatedBy === 'system' && quest.fallback === true));
  } finally {
    aiProvider.generateResponse = originalGenerateResponse;
  }
});
