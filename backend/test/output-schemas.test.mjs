import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const {
  extractJsonArray,
  weaknessRecommendationsSchema,
  generatedQuestsSchema,
  workoutSchema,
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

test('workout schema constrains fields to the ranges enforced by the frontend normalizer', () => {
  const exercise = workoutSchema.properties.exercises.items;
  assert.equal(workoutSchema.properties.durationMinutes.minimum, 8);
  assert.equal(workoutSchema.properties.durationMinutes.maximum, 75);
  assert.equal(exercise.properties.targetReps.minimum, 1);
  assert.equal(exercise.properties.targetReps.maximum, 40);
  assert.equal(exercise.properties.durationSeconds.minimum, 15);
  assert.equal(exercise.properties.durationSeconds.maximum, 120);
  assert.equal(exercise.properties.restSeconds.minimum, 0);
  assert.equal(exercise.properties.restSeconds.maximum, 90);
  assert.equal(exercise.properties.targetMuscles.maxItems, 4);
  for (const name of ['Bench Press', 'Leg Press', 'Cable Crossover', 'Lat Pulldown', 'Dumbbell Shoulder Press']) {
    assert.ok(exercise.properties.name.enum.includes(name), `${name} must be allowed for Gym mode`);
  }
});
