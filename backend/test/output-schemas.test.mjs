import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const {
  extractJsonArray,
  weaknessRecommendationsSchema,
  generatedQuestsSchema,
} = require('../utils/outputSchemas');

test('extractJsonArray keeps raw arrays and unwraps the preferred object keys', () => {
  const items = [{ title: 'A' }, { title: 'B' }, { title: 'C' }];
  assert.equal(extractJsonArray(items), items);
  assert.equal(extractJsonArray({ recommendations: items })[0].title, 'A');
  assert.equal(extractJsonArray({ quests: items }, ['quests'])[1].title, 'B');
  assert.equal(extractJsonArray({ tasks: items })[2].title, 'C');
});

test('extractJsonArray rejects a single quest object instead of inventing an array', () => {
  assert.equal(extractJsonArray({ title: 'One quest', description: 'Not an array', xpReward: 40 }), null);
  assert.equal(extractJsonArray('not json'), null);
  assert.equal(extractJsonArray(null), null);
});

test('quest schemas require wrapped arrays with the live item counts', () => {
  assert.equal(weaknessRecommendationsSchema.type, 'object');
  assert.equal(weaknessRecommendationsSchema.properties.recommendations.minItems, 3);
  assert.equal(weaknessRecommendationsSchema.properties.recommendations.maxItems, 5);
  assert.equal(generatedQuestsSchema.type, 'object');
  assert.equal(generatedQuestsSchema.properties.quests.minItems, 3);
  assert.equal(generatedQuestsSchema.properties.quests.maxItems, 3);
});
