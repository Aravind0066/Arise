import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BottomNavigation } from '../components/BottomNavigation';
import { createUser, getUser, User } from '../lib/api';
import { clearCurrentUser, loadCurrentUser, saveCurrentUser } from '../lib/currentUser';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const saved = await loadCurrentUser();
    if (saved) {
      try { const fresh = await getUser(saved._id); setUser(fresh); await saveCurrentUser(fresh); } catch { setUser(saved); }
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const register = async () => {
    if (!name.trim() || !email.trim()) { setMessage('Name and email are required.'); return; }
    try { const created = await createUser(name.trim(), email.trim().toLowerCase()); await saveCurrentUser(created); setUser(created); setMessage('Profile linked to Arise.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create profile'); }
  };
  const signOut = async () => { await clearCurrentUser(); setUser(null); setName(''); setEmail(''); setMessage('Profile disconnected.'); };

  return <View style={styles.root}><StatusBar style="light" /><SafeAreaView style={styles.safe}>
    <View style={styles.content}><Text style={styles.system}>ARISE // HUNTER PROFILE</Text><Text style={styles.title}>PROFILE</Text>
      {user ? <><Text style={styles.name}>{user.name}</Text><Text style={styles.email}>{user.email}</Text>
        <View style={styles.stat}><Text style={styles.statLabel}>TOTAL EXPERIENCE</Text><Text style={styles.xp}>{user.xp} XP</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>LEVEL</Text><Text style={styles.xp}>{user.level}</Text></View>
        <Pressable style={styles.secondary} onPress={signOut}><Text style={styles.secondaryText}>DISCONNECT PROFILE</Text></Pressable></>
        : <><Text style={styles.message}>Create a profile to complete quests and keep your history.</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="#5686a4" style={styles.input} />
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#5686a4" style={styles.input} />
          <Pressable style={styles.button} onPress={register}><Text style={styles.buttonText}>CREATE PROFILE</Text></Pressable></>}
      {message ? <Text style={styles.notice}>{message}</Text> : null}
    </View><BottomNavigation active="profile" />
  </SafeAreaView></View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050b14' }, safe: { flex: 1 }, content: { flex: 1, padding: 20 },
  system: { color: '#5686a4', fontSize: 10, fontWeight: '700', letterSpacing: 1.7 }, title: { color: '#e6fbff', fontSize: 25, fontWeight: '800', letterSpacing: 2, marginTop: 16, marginBottom: 24 },
  name: { color: '#e6fbff', fontSize: 24, fontWeight: '800' }, email: { color: '#82b8d5', marginTop: 6 }, message: { color: '#82b8d5', fontSize: 14, lineHeight: 21, marginBottom: 18 },
  input: { borderWidth: 1, borderColor: '#285675', color: '#e6fbff', padding: 13, fontSize: 14, marginBottom: 10 }, button: { backgroundColor: '#6de7ff', padding: 14, alignItems: 'center' },
  buttonText: { color: '#07131f', fontWeight: '900', letterSpacing: 1 }, stat: { borderBottomWidth: 1, borderBottomColor: '#1d3c5c', paddingVertical: 18, flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  statLabel: { color: '#5686a4', fontSize: 11, fontWeight: '800', letterSpacing: 1 }, xp: { color: '#6de7ff', fontWeight: '800' }, secondary: { borderWidth: 1, borderColor: '#1d3c5c', padding: 14, alignItems: 'center', marginTop: 28 },
  secondaryText: { color: '#e98383', fontWeight: '800', letterSpacing: 1 }, notice: { color: '#f4b76a', marginTop: 16 },
});
