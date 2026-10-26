import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BottomNavigation } from '../components/BottomNavigation';
import { getHunterHistory, getHunterProfile } from '../lib/hunterStorage';
import { CompletedLog, HunterProfile } from '../lib/hunterTypes';

const HISTORY_CATEGORIES = ['ALL', 'FITNESS', 'STUDY', 'MINDFULNESS', 'DISCIPLINE'] as const;

export default function HistoryScreen() {
  const [logs, setLogs] = useState<CompletedLog[]>([]);
  const [profile, setProfile] = useState<HunterProfile | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  const loadData = useCallback(async () => {
    const h = await getHunterHistory();
    const p = await getHunterProfile();
    setLogs(h);
    setProfile(p);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const totalXp = logs.reduce((sum, item) => sum + item.xpEarned, 0);

  const filteredLogs = logs.filter((log) => {
    if (selectedFilter === 'ALL') return true;
    return log.category.toUpperCase().includes(selectedFilter);
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.systemTag}>SYSTEM // ACTIVITY AUDIT</Text>
            <Text style={styles.title}>MISSION ARCHIVE</Text>
          </View>

          {/* Cumulative Summary Cards */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>TOTAL VERIFIED XP</Text>
              <Text style={styles.summaryVal}>{totalXp}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>DIRECTIVES SEALED</Text>
              <Text style={[styles.summaryVal, { color: '#38ef7d' }]}>{logs.length}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>HUNTER RANK</Text>
              <Text style={[styles.summaryVal, { color: '#fbb03b' }]}>
                {profile?.rank || 'E-RANK'}
              </Text>
            </View>
          </View>

          {/* Category Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {HISTORY_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[styles.filterChip, selectedFilter === cat && styles.filterChipActive]}
                onPress={() => setSelectedFilter(cat)}
              >
                <Text style={[styles.filterText, selectedFilter === cat && styles.filterTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* History Item Cards */}
          <View style={styles.logsList}>
            {filteredLogs.map((log) => {
              const dateVal = log.completedAt ? new Date(log.completedAt) : new Date();
              const formattedDate = dateVal.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <View key={log._id} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <View style={styles.catPill}>
                      <Text style={styles.catPillText}>{log.category.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.xpEarned}>+{log.xpEarned} XP</Text>
                  </View>

                  <Text style={styles.logTitle}>{log.title}</Text>

                  <View style={styles.logFooter}>
                    <Text style={styles.statRaised}>
                      Raised {log.statRaised?.toUpperCase()} (+{log.statBonus || 3})
                    </Text>
                    <Text style={styles.logTimestamp}>{formattedDate}</Text>
                  </View>
                </View>
              );
            })}

            {filteredLogs.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📜</Text>
                <Text style={styles.emptyTitle}>NO COMPLETED DIRECTIVES FOUND</Text>
                <Text style={styles.emptySub}>
                  Complete workouts, study blocks, or reflection journals to log verified progression here.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
        <BottomNavigation active="history" />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050b14' },
  safe: { flex: 1 },
  content: { padding: 18, paddingBottom: 120 },
  header: { marginBottom: 16 },
  systemTag: { color: '#00f3ff', fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: '#ffffff', fontSize: 24, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#071626',
    borderWidth: 1,
    borderColor: '#183652',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  summaryLabel: { color: '#5f88a9', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  summaryVal: { color: '#00f3ff', fontSize: 18, fontWeight: '900', marginTop: 4 },
  filterRow: {
    gap: 8,
    paddingBottom: 14,
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#091827',
    borderWidth: 1,
    borderColor: '#183654',
  },
  filterChipActive: {
    backgroundColor: '#00f3ff',
    borderColor: '#00f3ff',
  },
  filterText: {
    color: '#557c9c',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  filterTextActive: {
    color: '#02111d',
  },
  logsList: { gap: 10 },
  logCard: {
    backgroundColor: '#071626',
    borderWidth: 1,
    borderColor: '#183652',
    borderRadius: 8,
    padding: 14,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catPill: {
    backgroundColor: 'rgba(0, 243, 255, 0.08)',
    borderWidth: 1,
    borderColor: '#00f3ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3,
  },
  catPillText: { color: '#00f3ff', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  xpEarned: { color: '#38ef7d', fontSize: 11, fontWeight: '900' },
  logTitle: { color: '#ffffff', fontSize: 14, fontWeight: '900', lineHeight: 19 },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#122c45',
    marginTop: 10,
    paddingTop: 8,
  },
  statRaised: { color: '#5f88a9', fontSize: 10, fontWeight: '800' },
  logTimestamp: { color: '#7fa3bf', fontSize: 10 },
  emptyCard: {
    backgroundColor: '#071626',
    borderWidth: 1,
    borderColor: '#183652',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { color: '#ffffff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  emptySub: { color: '#7fa3bf', fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 6 },
});
