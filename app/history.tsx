import { useAppearance, useThemedStyles } from '../lib/AppearanceContext';
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getHunterHistory, getHunterProfile } from '../lib/hunterStorage';
import { CompletedLog, HunterProfile } from '../lib/hunterTypes';

const HISTORY_CATEGORIES = ['ALL', 'FITNESS', 'STUDY', 'MINDFULNESS', 'DISCIPLINE'] as const;

export default function HistoryScreen() {
  const { theme } = useAppearance();
  const themedStyles = useThemedStyles(styles);
  const router = useRouter();
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
    <View style={themedStyles.root}>
      <SafeAreaView style={themedStyles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={themedStyles.content}>
          <View style={themedStyles.header}>
            <Pressable style={themedStyles.backBtn} onPress={() => router.replace('/profile')}>
              <Text style={themedStyles.backBtnText}>← SYSTEM</Text>
            </Pressable>
            <View>
              <Text style={themedStyles.systemTag}>Activity History</Text>
              <Text style={themedStyles.title}>MISSION ARCHIVE</Text>
            </View>
          </View>

          {/* Cumulative Summary Cards */}
          <View style={themedStyles.summaryRow}>
            <View style={themedStyles.summaryCard}>
              <Text style={themedStyles.summaryLabel}>TOTAL VERIFIED XP</Text>
              <Text style={themedStyles.summaryVal}>{totalXp}</Text>
            </View>
            <View style={themedStyles.summaryCard}>
              <Text style={themedStyles.summaryLabel}>DIRECTIVES SEALED</Text>
              <Text style={[themedStyles.summaryVal, { color: theme.success }]}>{logs.length}</Text>
            </View>
            <View style={themedStyles.summaryCard}>
              <Text style={themedStyles.summaryLabel}>HUNTER RANK</Text>
              <Text style={[themedStyles.summaryVal, { color: theme.warning }]}>
                {profile?.rank || 'E-RANK'}
              </Text>
            </View>
          </View>

          {/* Category Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={themedStyles.filterRow}
          >
            {HISTORY_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[themedStyles.filterChip, selectedFilter === cat && themedStyles.filterChipActive]}
                onPress={() => setSelectedFilter(cat)}
              >
                <Text style={[themedStyles.filterText, selectedFilter === cat && themedStyles.filterTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* History Item Cards */}
          <View style={themedStyles.logsList}>
            {filteredLogs.map((log) => {
              const dateVal = log.completedAt ? new Date(log.completedAt) : new Date();
              const formattedDate = dateVal.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <View key={log._id} style={themedStyles.logCard}>
                  <View style={themedStyles.logHeader}>
                    <View style={themedStyles.catPill}>
                      <Text style={themedStyles.catPillText}>{log.category.toUpperCase()}</Text>
                    </View>
                    <Text style={themedStyles.xpEarned}>+{log.xpEarned} XP</Text>
                  </View>

                  <Text style={themedStyles.logTitle}>{log.title}</Text>

                  <View style={themedStyles.logFooter}>
                    <Text style={themedStyles.statRaised}>
                      Raised {log.statRaised?.toUpperCase()} (+{log.statBonus || 3})
                    </Text>
                    <Text style={themedStyles.logTimestamp}>{formattedDate}</Text>
                  </View>
                </View>
              );
            })}

            {filteredLogs.length === 0 && (
              <View style={themedStyles.emptyCard}>
                <Text style={themedStyles.emptyIcon}>📜</Text>
                <Text style={themedStyles.emptyTitle}>NO COMPLETED DIRECTIVES FOUND</Text>
                <Text style={themedStyles.emptySub}>
                  Complete workouts, study blocks, or reflection journals to log verified progression here.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050b14' },
  safe: { flex: 1 },
  content: { padding: 18, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 7, backgroundColor: '#0b1e30', borderWidth: 1, borderColor: '#1c3d5e' },
  backBtnText: { color: '#00f3ff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
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
