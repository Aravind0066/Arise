import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

export type NavigationTab = 'status' | 'quests' | 'history' | 'profile';

const TABS: { key: NavigationTab; label: string; route: '/' | '/quests' | '/history' | '/profile' }[] = [
  { key: 'status', label: 'STATUS', route: '/' },
  { key: 'quests', label: 'QUESTS', route: '/quests' },
  { key: 'history', label: 'HISTORY', route: '/history' },
  { key: 'profile', label: 'PROFILE', route: '/profile' },
];

export function BottomNavigation({ active }: { active: NavigationTab }) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {TABS.map((tab) => (
        <Pressable key={tab.key} style={styles.tab} onPress={() => router.replace(tab.route)}>
          <View style={[styles.tabMark, active === tab.key && styles.activeMark]} />
          <Text style={[styles.label, active === tab.key && styles.activeLabel]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#07121e', borderTopWidth: 1, borderTopColor: '#1a4865', paddingHorizontal: 8, paddingTop: 10, paddingBottom: 12 },
  tab: { flex: 1, alignItems: 'center', gap: 7 },
  tabMark: { width: 22, height: 2, backgroundColor: 'transparent' },
  activeMark: { backgroundColor: '#6de7ff' },
  label: { color: '#4f7288', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  activeLabel: { color: '#6de7ff' },
});
