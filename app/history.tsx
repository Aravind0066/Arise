import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BottomNavigation } from '../components/BottomNavigation';
import { getHistory, CompletedQuest } from '../lib/api';
import { loadCurrentUser } from '../lib/currentUser';

export default function HistoryScreen() {
  const [items, setItems] = useState<CompletedQuest[]>([]);
  const [message, setMessage] = useState('No completed quests yet.');
  const load = useCallback(async () => {
    const user = await loadCurrentUser();
    if (!user) {
      setMessage('Create your profile to see completion history.');
      return;
    }
    try {
      const result = await getHistory(user._id);
      setItems(result.data);
      setMessage(result.data.length ? '' : 'No completed quests yet.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load history');
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.root}><StatusBar style="light" /><SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.system}>ARISE // ACTIVITY LOG</Text><Text style={styles.title}>HISTORY</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {items.map((item) => <View style={styles.card} key={item._id}>
          <Text style={styles.category}>{item.questId.category.toUpperCase()}</Text>
          <Text style={styles.quest}>{item.questId.title}</Text>
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
          <Text style={styles.reward}>+{item.xpEarned} XP</Text>
        </View>)}
      </ScrollView><BottomNavigation active="history" />
    </SafeAreaView></View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050b14' }, safe: { flex: 1 }, content: { padding: 20, paddingBottom: 112 },
  system: { color: '#5686a4', fontSize: 10, fontWeight: '700', letterSpacing: 1.7 }, title: { color: '#e6fbff', fontSize: 25, fontWeight: '800', letterSpacing: 2, marginTop: 16, marginBottom: 18 },
  message: { color: '#f4b76a', fontSize: 13, marginBottom: 14 }, card: { borderWidth: 1, borderColor: '#1d3c5c', backgroundColor: '#071522', padding: 16, marginBottom: 12 },
  category: { color: '#6de7ff', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, quest: { color: '#e6fbff', fontSize: 18, fontWeight: '800', marginTop: 10 },
  date: { color: '#82b8d5', fontSize: 12, marginTop: 8 }, reward: { color: '#73e0a1', fontSize: 13, fontWeight: '800', marginTop: 12 },
});
