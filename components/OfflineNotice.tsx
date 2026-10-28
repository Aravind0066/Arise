import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppearance, useThemedStyles } from '../lib/AppearanceContext';

export function OfflineNotice({ visible = true }: { visible?: boolean }) {
  const { theme } = useAppearance();
  const styles = useThemedStyles(noticeStyles);
  if (!visible) return null;

  return (
    <View style={[styles.container, { borderColor: theme.warning }]} accessibilityRole="alert">
      <Text style={[styles.title, { color: theme.warning }]}>You are offline</Text>
      <Text style={styles.copy}>Internet is unavailable. Hunter AI can still work when the app backend and Ollama are running locally.</Text>
    </View>
  );
}

const noticeStyles = StyleSheet.create({
  container: {
    marginVertical: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#0b1e30',
    gap: 5,
  },
  title: { fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  copy: { color: '#a8c5df', fontSize: 12, lineHeight: 18 },
});
