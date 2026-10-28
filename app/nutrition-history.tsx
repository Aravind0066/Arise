import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from '../components/BottomNavigation';
import { useAppearance, useThemedStyles } from '../lib/AppearanceContext';
import { getNutritionHistory } from '../lib/hunterStorage';
import type { NutritionHistoryRecord } from '../lib/hunterTypes';

export default function NutritionHistoryScreen() {
  const { theme } = useAppearance();
  const styles = useThemedStyles(pageStyles);
  const router = useRouter();
  const [records, setRecords] = useState<NutritionHistoryRecord[]>([]);
  useEffect(() => { void getNutritionHistory().then(setRecords); }, []);
  return <View style={styles.root}><SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}><Text style={{ color: theme.accent }}>← BACK</Text></Pressable>
      <Text style={styles.tag}>Nutrition</Text><Text style={styles.title}>NUTRITION HISTORY</Text>
      {!records.length ? <Text style={styles.empty}>No saved meal plans yet. Generate guidance from Nutrition to save a plan here.</Text> : records.map((record) => <View key={record.id} style={styles.card}>
        <Text style={styles.date}>{new Date(record.createdAt).toLocaleString()}</Text>
        <Text style={styles.goal}>{record.fitnessGoal || 'Nutrition goal not specified'} · {record.preparationTime ? `${record.preparationTime} min` : 'time not specified'} · {record.inputs?.mealsToPlan === 'full-day' ? 'Full day' : 'One meal'}</Text>
        {record.inputs?.availableIngredients?.length ? <Text style={styles.body}>Ingredients supplied: {record.inputs.availableIngredients.join(', ')}</Text> : null}
        {record.inputs?.dietaryPreferences?.length ? <Text style={styles.body}>Preferences: {record.inputs.dietaryPreferences.join(', ')}</Text> : null}
        {record.fallback ? <Text style={styles.source}>DETERMINISTIC FALLBACK</Text> : <Text style={styles.source}>{record.source === 'ollama-local' ? 'OLLAMA GENERATED' : 'AI GENERATED'}</Text>}
        {record.recommendations.map((meal, index) => <View key={`${record.id}_${index}`} style={styles.meal}>
          <Text style={styles.mealName}>{meal.name}</Text>
          {meal.preparationTimeMinutes ? <Text style={styles.body}>Estimated prep: about {meal.preparationTimeMinutes} min</Text> : null}
          <Text style={styles.body}>Ingredients: {meal.ingredients.join(', ')}</Text>
          {meal.steps.map((step, stepIndex) => <Text key={stepIndex} style={styles.body}>{stepIndex + 1}. {step}</Text>)}
          {meal.nutrition ? <Text style={styles.body}>Approximate nutrition: {meal.nutrition.calories ?? meal.nutrition.approximateCalories ?? 'calories not estimated'} · protein {meal.nutrition.protein ?? meal.nutrition.approximateProtein ?? 'not estimated'}{meal.nutrition.carbohydrates !== undefined ? ` · carbs ${meal.nutrition.carbohydrates}` : ''}{meal.nutrition.fat !== undefined ? ` · fat ${meal.nutrition.fat}` : ''}</Text> : null}
          {meal.nutrition?.note ? <Text style={styles.body}>{meal.nutrition.note}</Text> : null}
          {meal.goalAlignment ? <Text style={styles.body}>Goal fit: {meal.goalAlignment}</Text> : null}
          {meal.substitutions?.length ? <Text style={styles.body}>Optional swaps: {meal.substitutions.join(', ')}</Text> : null}
        </View>)}
      </View>)}
    </ScrollView><BottomNavigation active="tools" />
  </SafeAreaView></View>;
}

const pageStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050b14' }, safe: { flex: 1 }, content: { padding: 18, paddingBottom: 110, gap: 12, width: '100%', maxWidth: 960, alignSelf: 'center' },
  back: { alignSelf: 'flex-start', padding: 10, borderWidth: 1, borderColor: '#1c3d5e', borderRadius: 8 },
  tag: { color: '#00f3ff', fontSize: 10, fontWeight: '900', letterSpacing: 2 }, title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  empty: { color: '#9eb5c9', padding: 20, borderWidth: 1, borderColor: '#1c3d5e', borderRadius: 10 },
  card: { padding: 16, backgroundColor: '#071626', borderWidth: 1, borderColor: '#1c3d5e', borderRadius: 10, gap: 8 },
  date: { color: '#9eb5c9', fontSize: 10 }, goal: { color: '#fff', fontWeight: '800' }, source: { color: '#00f3ff', fontSize: 9, fontWeight: '900' },
  meal: { paddingTop: 8, borderTopWidth: 1, borderColor: '#1c3d5e', gap: 4 }, mealName: { color: '#fff', fontWeight: '800' }, body: { color: '#9eb5c9', fontSize: 12 },
});
