import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('saved workout plan restoration is mounted separately from explicit prepare action', async () => {
  const workout = await source('../components/WorkoutScreen.tsx');
  assert.match(workout, /const savedPlan = await getSavedDailyWorkoutPlan\(\)/);
  assert.match(workout, /savedPlan\?\.localDate === getLocalWorkoutDate\(\)/);
  assert.match(workout, /onPress=\{\(\) => prepareTodayWorkout\(\)\}/);
});

test('Nutrition opens from saved history and never calls generation from its mount effect', async () => {
  const nutrition = await source('../components/NutritionContent.tsx');
  assert.match(nutrition, /getNutritionHistory\(\)\.then/);
  assert.match(nutrition, /onPress=\{fetchRecommendations\}/);
  assert.doesNotMatch(nutrition, /useEffect\(\(\)\s*=>\s*\{\s*void fetchRecommendations/);
});

test('Quest and chat restoration effects load saved state without triggering AI requests', async () => {
  const quests = await source('../app/quests.tsx');
  const focusStart = quests.indexOf('useFocusEffect(');
  const focusEnd = quests.indexOf('const handleQuestAction', focusStart);
  const focusEffect = quests.slice(focusStart, focusEnd);
  assert.match(focusEffect, /loadData\(\)/);
  assert.doesNotMatch(focusEffect, /fetchRecommendations\(\)/);

  const chat = await source('../app/chat.tsx');
  assert.match(chat, /useEffect\(\(\) => \{ void restoreChats\(\); \}, \[restoreChats\]\)/);
  assert.match(chat, /getChatConversations\(\)/);
  assert.doesNotMatch(chat, /useEffect\(\(\) => \{[^}]*chatWithAI/s);
});
