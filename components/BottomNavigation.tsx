import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

export type NavigationTab = 'status' | 'quests' | 'tools' | 'history' | 'profile';

const TABS: {
  key: NavigationTab;
  label: string;
  icon: string;
  route: '/' | '/quests' | '/tools' | '/history' | '/profile';
}[] = [
  { key: 'status', label: 'STATUS', icon: '⚡', route: '/' },
  { key: 'quests', label: 'QUESTS', icon: '⚔️', route: '/quests' },
  { key: 'tools', label: 'TOOLS', icon: '🛠️', route: '/tools' },
  { key: 'history', label: 'LOGS', icon: '📜', route: '/history' },
  { key: 'profile', label: 'SYSTEM', icon: '👤', route: '/profile' },
];

export function BottomNavigation({ active }: { active: NavigationTab }) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => router.replace(tab.route)}
          >
            <View style={[styles.tabIndicator, isActive && styles.activeIndicator]} />
            <Text style={[styles.icon, isActive && styles.activeIcon]}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#040b14',
    borderTopWidth: 1,
    borderTopColor: '#16314c',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tabIndicator: {
    width: 24,
    height: 2,
    backgroundColor: 'transparent',
    borderRadius: 2,
  },
  activeIndicator: {
    backgroundColor: '#00f3ff',
  },
  icon: {
    fontSize: 14,
    opacity: 0.6,
  },
  activeIcon: {
    opacity: 1,
  },
  label: {
    color: '#4f7288',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  activeLabel: {
    color: '#00f3ff',
  },
});
