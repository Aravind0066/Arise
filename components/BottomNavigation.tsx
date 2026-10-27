import { useThemedStyles } from '../lib/AppearanceContext';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppearance } from '../lib/AppearanceContext';

export type NavigationTab = 'home' | 'quests' | 'tools' | 'system';

const TABS: {
  key: NavigationTab;
  label: string;
  icon: string;
  route: '/' | '/quests' | '/tools' | '/profile';
}[] = [
  { key: 'home', label: 'Home', icon: '⌂', route: '/' },
  { key: 'quests', label: 'Quest', icon: '⚔️', route: '/quests' },
  { key: 'tools', label: 'Tools', icon: '🛠️', route: '/tools' },
  { key: 'system', label: 'System', icon: '👤', route: '/profile' },
];

export function BottomNavigation({ active }: { active: NavigationTab }) {
  const themedStyles = useThemedStyles(styles);
  const router = useRouter();
  const { theme, typography } = useAppearance();

  return (
    <View style={[themedStyles.container, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={themedStyles.tab}
            onPress={() => router.replace(tab.route)}
          >
            <View style={[themedStyles.tabIndicator, isActive && { backgroundColor: theme.accent }]} />
            <Text
              style={[
                themedStyles.icon,
                { color: isActive ? theme.accent : theme.textSecondary },
                isActive && themedStyles.activeIcon,
              ]}
            >
              {tab.icon}
            </Text>
            <Text
              style={[
                themedStyles.label,
                { color: theme.textSecondary, fontSize: typography.label },
                isActive && { color: theme.accent },
              ]}
            >
              {tab.label}
            </Text>
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
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activeLabel: {
    color: '#00f3ff',
  },
});
