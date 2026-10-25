import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { completeQuest, getQuests, getUser, Quest, User } from '../lib/api';
import { loadCurrentUser, saveCurrentUser } from '../lib/currentUser';
import { BottomNavigation } from '../components/BottomNavigation';

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [quest, setQuest] = useState<Quest | null>(null);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const saved = await loadCurrentUser();
    if (!saved) { setMessage('Create your profile to activate your hunter dashboard.'); return; }
    try {
      const [fresh, quests] = await Promise.all([getUser(saved._id), getQuests()]);
      setUser(fresh); await saveCurrentUser(fresh);
      setQuest(quests.data.find((item) => item.status === 'active') ?? null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to sync dashboard'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const finish = async () => {
    if (!user || !quest) return;
    try { await completeQuest(user._id, quest._id); setQuest({ ...quest, status: 'completed' }); setMessage(`Quest complete. +${quest.xpReward} XP earned.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to complete quest'); }
  };
  const level = user ? Math.floor(user.xp / 500) + 1 : 1;
  const nextXp = level * 500;
  const progress = user ? Math.min(100, (user.xp % 500) / 5) : 0;
  return <View style={styles.root}><StatusBar style="light" /><SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}><View style={styles.header}><Text style={styles.system}>ARISE // SYSTEM ONLINE</Text><Text style={styles.live}>● LIVE</Text></View>
      <View style={styles.level}><View><Text style={styles.caption}>HUNTER LEVEL</Text><Text style={styles.levelNumber}>{level}</Text></View><View style={styles.xpBlock}><Text style={styles.caption}>EXPERIENCE</Text><Text style={styles.xp}>{user?.xp ?? 0} / {nextXp} XP</Text></View></View>
      <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {!user ? <Pressable style={styles.button} onPress={() => router.replace('/profile')}><Text style={styles.buttonText}>CREATE PROFILE</Text></Pressable> : null}
      <View style={styles.section}><Text style={styles.sectionTitle}>NEXT QUEST</Text>{quest ? <View style={styles.card}><Text style={styles.category}>{quest.category.toUpperCase()} {'//'} {quest.status.toUpperCase()}</Text><Text style={styles.questTitle}>{quest.title}</Text><Text style={styles.description}>{quest.description}</Text><View style={styles.meta}><Text style={styles.reward}>+{quest.xpReward} XP</Text><Text style={styles.deadline}>{new Date(quest.deadline).toLocaleString()}</Text></View>{quest.status === 'active' ? <Pressable style={styles.button} onPress={finish}><Text style={styles.buttonText}>COMPLETE QUEST</Text></Pressable> : null}</View> : <Text style={styles.empty}>No active quests. Generate one from the QUESTS tab.</Text>}</View>
    </ScrollView><BottomNavigation active="status" />
  </SafeAreaView></View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050b14' }, safe: { flex: 1 }, content: { padding: 18, paddingBottom: 112 }, header: { flexDirection: 'row', justifyContent: 'space-between' },
  system: { color: '#5686a4', fontSize: 10, fontWeight: '700', letterSpacing: 1.7 }, live: { color: '#73e0a1', fontSize: 10, fontWeight: '800' }, level: { borderWidth: 1, borderColor: '#1d3c5c', marginTop: 24, padding: 18, flexDirection: 'row', justifyContent: 'space-between' },
  caption: { color: '#5686a4', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, levelNumber: { color: '#e6fbff', fontSize: 42, fontWeight: '900', marginTop: 4 }, xpBlock: { justifyContent: 'center' }, xp: { color: '#6de7ff', fontWeight: '800', marginTop: 7 },
  track: { height: 8, backgroundColor: '#123049', marginTop: 10 }, fill: { height: 8, backgroundColor: '#6de7ff' }, message: { color: '#f4b76a', fontSize: 13, marginTop: 18, lineHeight: 20 }, section: { marginTop: 30 },
  sectionTitle: { color: '#6de7ff', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 }, card: { borderWidth: 1, borderColor: '#1d3c5c', backgroundColor: '#071522', padding: 16 },
  category: { color: '#82b8d5', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, questTitle: { color: '#e6fbff', fontSize: 21, fontWeight: '800', marginTop: 12 }, description: { color: '#82b8d5', lineHeight: 20, marginTop: 7 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 18 }, reward: { color: '#6de7ff', fontWeight: '800' }, deadline: { color: '#f4b76a', fontSize: 11 }, button: { backgroundColor: '#6de7ff', padding: 14, alignItems: 'center', marginTop: 4 }, buttonText: { color: '#07131f', fontWeight: '900', letterSpacing: 1 }, empty: { color: '#7197aa', lineHeight: 21 },
});
