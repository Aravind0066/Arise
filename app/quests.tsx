import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BottomNavigation } from '../components/BottomNavigation';
import { completeQuest, generateQuests, getQuests, Quest } from '../lib/api';
import { loadCurrentUser } from '../lib/currentUser';

const formatDeadline = (deadline: string) => {
  const remaining = new Date(deadline).getTime() - Date.now();
  if (remaining <= 0) return 'EXPIRED';
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  return `${hours}H ${minutes}M LEFT`;
};

export default function QuestsScreen() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Connect the backend to load live quests.');
  const [busyQuest, setBusyQuest] = useState<string | null>(null);

  const loadQuests = useCallback(async () => {
    try {
      const result = await getQuests();
      setQuests(result.data);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load quests');
    }
  }, []);

  const finishQuest = async (quest: Quest) => {
    const user = await loadCurrentUser();
    if (!user) {
      setMessage('Create your profile before completing quests.');
      return;
    }
    setBusyQuest(quest._id);
    try {
      await completeQuest(user._id, quest._id);
      setQuests((current) => current.map((item) => item._id === quest._id ? { ...item, status: 'completed' } : item));
      setMessage(`Quest complete. +${quest.xpReward} XP awarded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to complete quest');
    } finally {
      setBusyQuest(null);
    }
  };

  useFocusEffect(useCallback(() => {
    loadQuests();
  }, [loadQuests]));

  const askAI = async () => {
    if (!goal.trim()) {
      setMessage('Enter a goal before requesting recommendations.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const result = await generateQuests({
        goal,
        category: 'Learning',
        availableMinutes: 60,
        difficulty: 'Beginner',
      });
      setQuests((current) => [...result.data, ...current]);
      setGoal('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI recommendation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.system}>ARISE // QUEST ENGINE</Text>
          <Text style={styles.title}>ACTIVE QUESTS</Text>
          <View style={styles.aiPanel}>
            <Text style={styles.panelLabel}>AI RECOMMENDATION</Text>
            <TextInput
              value={goal}
              onChangeText={setGoal}
              placeholder="What do you want to improve?"
              placeholderTextColor="#5686a4"
              style={styles.input}
            />
            <Pressable style={styles.button} onPress={askAI} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? 'GENERATING...' : 'GENERATE QUESTS'}</Text>
            </Pressable>
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {quests.map((quest) => (
            <View key={quest._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.category}>{quest.category.toUpperCase()}</Text>
                <Text style={[styles.status, quest.status === 'expired' && styles.expired]}>{quest.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.questTitle}>{quest.title}</Text>
              <Text style={styles.description}>{quest.description}</Text>
              <View style={styles.meta}>
                <Text style={styles.reward}>+{quest.xpReward} XP</Text>
                <Text style={styles.deadline}>{formatDeadline(quest.deadline)}</Text>
              </View>
              {quest.status === 'active' ? (
                <Pressable style={styles.complete} onPress={() => finishQuest(quest)} disabled={busyQuest === quest._id}>
                  <Text style={styles.completeText}>{busyQuest === quest._id ? 'SYNCING...' : 'COMPLETE QUEST'}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
        <BottomNavigation active="quests" />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050b14' },
  safeArea: { flex: 1 },
  content: { padding: 20, paddingBottom: 112 },
  system: { color: '#5686a4', fontSize: 10, fontWeight: '700', letterSpacing: 1.7 },
  title: { color: '#e6fbff', fontSize: 25, fontWeight: '800', letterSpacing: 2, marginTop: 16, marginBottom: 18 },
  aiPanel: { borderWidth: 1, borderColor: '#1a4865', padding: 14, marginBottom: 16 },
  panelLabel: { color: '#6de7ff', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#285675', color: '#e6fbff', padding: 12, fontSize: 14, marginBottom: 10 },
  button: { backgroundColor: '#6de7ff', padding: 13, alignItems: 'center' },
  buttonText: { color: '#07131f', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  message: { color: '#f4b76a', fontSize: 12, marginBottom: 14 },
  card: { borderWidth: 1, borderColor: '#1d3c5c', backgroundColor: '#071522', padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  category: { color: '#6de7ff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  status: { color: '#73e0a1', fontSize: 10, fontWeight: '800' },
  expired: { color: '#e98383' },
  questTitle: { color: '#e6fbff', fontSize: 18, fontWeight: '800', marginTop: 12 },
  description: { color: '#82b8d5', fontSize: 13, lineHeight: 20, marginTop: 6 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  reward: { color: '#6de7ff', fontSize: 12, fontWeight: '800' },
  deadline: { color: '#f4b76a', fontSize: 12, fontWeight: '800' },
  complete: { borderWidth: 1, borderColor: '#6de7ff', padding: 12, alignItems: 'center', marginTop: 16 },
  completeText: { color: '#6de7ff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});
