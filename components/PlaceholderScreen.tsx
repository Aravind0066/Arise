import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation, NavigationTab } from './BottomNavigation';
import { useThemedStyles } from '../lib/AppearanceContext';

export function PlaceholderScreen({ active, title }: { active: NavigationTab; title: string }) {
  const themedStyles = useThemedStyles(styles);
  return (
    <View style={themedStyles.root}>
      <SafeAreaView style={styles.safeArea}>
        <View style={themedStyles.content}>
          <Text style={themedStyles.system}>ARISE // SYSTEM ONLINE</Text>
          <Text style={themedStyles.title}>{title}</Text>
          <Text style={themedStyles.message}>This module is ready for the next system update.</Text>
        </View>
        <BottomNavigation active={active} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050b14' },
  safeArea: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  system: { color: '#5686a4', fontSize: 10, fontWeight: '700', letterSpacing: 1.7 },
  title: { color: '#e6fbff', fontSize: 24, fontWeight: '800', letterSpacing: 2, marginTop: 18 },
  message: { color: '#7197aa', fontSize: 13, textAlign: 'center', marginTop: 12 },
});
