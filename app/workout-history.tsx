import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from '../components/BottomNavigation';
import { useAppearance, useThemedStyles } from '../lib/AppearanceContext';
import { getWorkoutLogs, getWorkoutPlanHistory } from '../lib/hunterStorage';
import type { SavedDailyWorkoutPlan } from '../lib/hunterStorage';
import type { WorkoutLog } from '../lib/hunterTypes';

type PlanEntry = { id: string; createdAt: string; plan: SavedDailyWorkoutPlan };
export default function WorkoutHistoryScreen() {
  const { theme } = useAppearance();
  const styles = useThemedStyles(pageStyles);
  const router = useRouter();
  const [plans, setPlans] = useState<PlanEntry[]>([]);
  const [records, setRecords] = useState<WorkoutLog[]>([]);
  useEffect(() => { void Promise.all([getWorkoutPlanHistory(), getWorkoutLogs()]).then(([savedPlans, logs]) => { setPlans(savedPlans); setRecords(logs); }); }, []);
  return <View style={styles.root}><SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}><Text style={{ color: theme.accent }}>← BACK</Text></Pressable>
      <Text style={styles.tag}>Workout</Text><Text style={styles.title}>WORKOUT HISTORY</Text>
      {!plans.length ? <Text style={styles.empty}>Prepared workout plans will be saved here.</Text> : plans.map(({ id, createdAt, plan }) => <View key={id} style={styles.card}>
        <Text style={styles.date}>{new Date(createdAt).toLocaleString()} · {plan.localDate}</Text>
        <Text style={styles.planTitle}>{plan.routine?.title || 'Rest day'}</Text>
        <Text style={styles.body}>{plan.routine ? `${plan.routine.goal} · ${plan.routine.durationMinutes} min · ${plan.routine.difficulty}` : plan.message}</Text>
        <Text style={styles.source}>{plan.source === 'ollama' || plan.source === 'ai' ? 'OLLAMA GENERATED' : plan.source === 'fallback' ? 'LOCAL FALLBACK' : 'REST DAY'}</Text>
        {plan.routine?.exercises.map((exercise, index) => <Text key={`${id}_${index}`} style={styles.body}>{index + 1}. {exercise.name} · {exercise.type === 'timed' ? `${exercise.durationSeconds}s` : `${exercise.targetReps ?? '—'} reps`} · rest {exercise.restSeconds}s</Text>)}
      </View>)}
      {records.map((record) => <View key={record._id} style={styles.card}>
        <Text style={styles.date}>COMPLETED · {new Date(record.createdAt).toLocaleString()}</Text>
        <Text style={styles.planTitle}>{record.workoutName}</Text>
        <Text style={styles.body}>{record.exercisesCompleted}/{record.totalExercises} exercises · {Math.floor(record.durationSeconds / 60)} min · +{record.xpEarned ?? 0} XP</Text>
        {record.sets !== undefined ? <Text style={styles.body}>{record.sets} sets · {record.reps ?? 0} reps · {record.weightKg ?? 0} kg</Text> : null}
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
  date: { color: '#9eb5c9', fontSize: 10 }, planTitle: { color: '#fff', fontSize: 16, fontWeight: '900' }, body: { color: '#b7cbdc', fontSize: 12 }, source: { color: '#00f3ff', fontSize: 9, fontWeight: '900' },
});
