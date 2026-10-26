import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BottomNavigation } from '../components/BottomNavigation';
import {
  getAchievements,
  getHunterHistory,
  getHunterProfile,
  getHunterStats,
  getWorkoutLogs,
  resetAllData,
  XP_PER_LEVEL,
} from '../lib/hunterStorage';
import { Achievement, CompletedLog, HunterProfile, HunterStats, WorkoutLog } from '../lib/hunterTypes';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<HunterProfile | null>(null);
  const [stats, setStats] = useState<HunterStats>({
    strength: 35,
    knowledge: 40,
    discipline: 30,
    health: 45,
    mindfulness: 35,
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [historyLogs, setHistoryLogs] = useState<CompletedLog[]>([]);
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    const p = await getHunterProfile();
    const s = await getHunterStats();
    const a = await getAchievements();
    const w = await getWorkoutLogs();
    const h = await getHunterHistory();
    setProfile(p);
    setStats(s);
    setAchievements(a);
    setWorkoutLogs(w);
    setHistoryLogs(h);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleResetProfile = () => {
    Alert.alert(
      'Reset Hunter Progression?',
      'This will clear local character stats and initiate re-awakening onboarding.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset System',
          style: 'destructive',
          onPress: async () => {
            await resetAllData();
            router.replace('/');
          },
        },
      ]
    );
  };

  // BMI Calculation
  const hMeters = (profile?.height || 175) / 100;
  const bmi = ((profile?.weight || 70) / (hMeters * hMeters)).toFixed(1);

  // Total Workout minutes
  const totalWorkoutMinutes = Math.round(
    workoutLogs.reduce((acc, log) => acc + (log.durationSeconds || 0), 0) / 60
  );

  const statBars = [
    { label: 'STRENGTH', val: stats.strength, color: '#ff5376', icon: '⚔️' },
    { label: 'KNOWLEDGE', val: stats.knowledge, color: '#6de7ff', icon: '📜' },
    { label: 'DISCIPLINE', val: stats.discipline, color: '#fbb03b', icon: '🛡️' },
    { label: 'HEALTH', val: stats.health, color: '#38ef7d', icon: '💧' },
    { label: 'MINDFULNESS', val: stats.mindfulness, color: '#c084fc', icon: '🧘' },
  ];

  const currentXp = profile?.xp || 0;
  const xpInCurrentLevel = currentXp % XP_PER_LEVEL;
  const xpPercent = Math.min(100, Math.round((xpInCurrentLevel / XP_PER_LEVEL) * 100));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.systemTag}>SYSTEM // HUNTER DOSSIER</Text>
            <Text style={styles.title}>CHARACTER SHEET</Text>
          </View>

          {notice ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>⚡ {notice}</Text>
            </View>
          ) : null}

          {/* Dossier Card */}
          <View style={styles.card}>
            <View style={styles.dossierTop}>
              <View style={styles.avatarGlow}>
                <Text style={styles.avatarText}>
                  {profile?.name ? profile.name.slice(0, 2).toUpperCase() : 'SJ'}
                </Text>
              </View>
              <View style={styles.dossierMeta}>
                <View style={styles.rankPill}>
                  <Text style={styles.rankPillText}>{profile?.rank || 'E-RANK'}</Text>
                </View>
                <Text style={styles.name}>{profile?.name || 'Hunter'}</Text>
                <Text style={styles.userTitle}>[ {profile?.title || 'THE AWAKENED'} ]</Text>
                <Text style={styles.email}>{profile?.email || 'hunter@system.io'}</Text>
              </View>
            </View>

            {/* Level & XP progress bar */}
            <View style={styles.levelProgressContainer}>
              <View style={styles.levelRow}>
                <Text style={styles.levelBadgeText}>LEVEL {profile?.level || 1}</Text>
                <Text style={styles.levelXpText}>
                  {xpInCurrentLevel} / {XP_PER_LEVEL} XP ({xpPercent}%)
                </Text>
              </View>
              <View style={styles.levelTrack}>
                <View style={[styles.levelFill, { width: `${xpPercent}%` }]} />
              </View>
            </View>

            {/* Biometrics Grid */}
            <View style={styles.bioGrid}>
              <View style={styles.bioBox}>
                <Text style={styles.bioLabel}>HEIGHT</Text>
                <Text style={styles.bioVal}>{profile?.height || 175} cm</Text>
              </View>
              <View style={styles.bioBox}>
                <Text style={styles.bioLabel}>WEIGHT</Text>
                <Text style={styles.bioVal}>{profile?.weight || 70} kg</Text>
              </View>
              <View style={styles.bioBox}>
                <Text style={styles.bioLabel}>BMI INDEX</Text>
                <Text style={styles.bioVal}>{bmi}</Text>
              </View>
              <View style={styles.bioBox}>
                <Text style={styles.bioLabel}>FOCUS</Text>
                <Text style={styles.bioValSmall}>{profile?.studyFocus || 'CS / DSA'}</Text>
              </View>
            </View>
          </View>

          {/* Character Attributes Breakdown */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>CHARACTER STAT BREAKDOWN</Text>
            <View style={styles.statBarsList}>
              {statBars.map((sb) => (
                <View key={sb.label} style={styles.barItem}>
                  <View style={styles.barHeader}>
                    <Text style={styles.barName}>
                      {sb.icon} {sb.label}
                    </Text>
                    <Text style={[styles.barScore, { color: sb.color }]}>{sb.val} / 100</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${sb.val}%`, backgroundColor: sb.color },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Workout Records & Training History */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>WORKOUT RECORDS & PROGRESS</Text>
            <View style={styles.recordsGrid}>
              <View style={styles.recordBox}>
                <Text style={styles.recordLabel}>RAIDS COMPLETED</Text>
                <Text style={styles.recordVal}>{workoutLogs.length}</Text>
              </View>
              <View style={styles.recordBox}>
                <Text style={styles.recordLabel}>TRAINING TIME</Text>
                <Text style={styles.recordVal}>{totalWorkoutMinutes}m</Text>
              </View>
              <View style={styles.recordBox}>
                <Text style={styles.recordLabel}>DIRECTIVES SEALED</Text>
                <Text style={[styles.recordVal, { color: '#38ef7d' }]}>{historyLogs.length}</Text>
              </View>
              <View style={styles.recordBox}>
                <Text style={styles.recordLabel}>ACTIVE STREAK</Text>
                <Text style={[styles.recordVal, { color: '#ffd700' }]}>
                  {profile?.streakDays || 1} DAYS
                </Text>
              </View>
            </View>
          </View>

          {/* Achievements & Badges Matrix */}
          <View style={styles.card}>
            <View style={styles.badgeHeaderRow}>
              <Text style={styles.cardHeaderTitle}>SYSTEM ACHIEVEMENTS & MEDALS</Text>
              <Text style={styles.badgeCounter}>
                {achievements.filter((a) => a.unlocked).length} / {achievements.length} UNLOCKED
              </Text>
            </View>

            <View style={styles.badgeGrid}>
              {achievements.map((ach) => {
                return (
                  <View
                    key={ach.id}
                    style={[styles.badgeItem, ach.unlocked && styles.badgeItemUnlocked]}
                  >
                    <Text style={styles.badgeIcon}>{ach.icon}</Text>
                    <Text
                      style={[
                        styles.badgeTitle,
                        ach.unlocked && styles.badgeTitleUnlocked,
                      ]}
                    >
                      {ach.title}
                    </Text>
                    <Text style={styles.badgeDesc} numberOfLines={2}>
                      {ach.description}
                    </Text>
                    <View
                      style={[
                        styles.badgeStatus,
                        ach.unlocked ? styles.badgeStatusDone : styles.badgeStatusLocked,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeStatusText,
                          ach.unlocked && styles.badgeStatusTextDone,
                        ]}
                      >
                        {ach.unlocked ? '✓ UNLOCKED' : 'LOCKED'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* System Reset / Diagnostic action */}
          <View style={styles.resetContainer}>
            <Pressable style={styles.resetBtn} onPress={handleResetProfile}>
              <Text style={styles.resetBtnText}>RESET HUNTER PROGRESSION & RE-AWAKEN</Text>
            </Pressable>
          </View>
        </ScrollView>
        <BottomNavigation active="profile" />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#040b14',
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  header: {
    marginTop: 12,
    marginBottom: 16,
  },
  systemTag: {
    color: '#00f3ff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  noticeBox: {
    backgroundColor: '#0b233a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00f3ff',
    padding: 10,
    marginBottom: 14,
  },
  noticeText: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#071626',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#163b5e',
    padding: 16,
    marginBottom: 14,
  },
  dossierTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarGlow: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0f2b48',
    borderWidth: 2,
    borderColor: '#00f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#00f3ff',
    fontSize: 22,
    fontWeight: '900',
  },
  dossierMeta: {
    flex: 1,
  },
  rankPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#1b1236',
    borderWidth: 1,
    borderColor: '#9d4edd',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  rankPillText: {
    color: '#c084fc',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  name: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  userTitle: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  email: {
    color: '#557c9c',
    fontSize: 10,
    marginTop: 2,
  },
  levelProgressContainer: {
    backgroundColor: '#0a1d30',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  levelBadgeText: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  levelXpText: {
    color: '#7ba0c0',
    fontSize: 10,
    fontWeight: '700',
  },
  levelTrack: {
    height: 6,
    backgroundColor: '#10273c',
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    backgroundColor: '#00f3ff',
  },
  bioGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  bioBox: {
    flex: 1,
    backgroundColor: '#0a1d30',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  bioLabel: {
    color: '#527c9c',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  bioVal: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  bioValSmall: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  cardHeaderTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statBarsList: {
    gap: 10,
  },
  barItem: {},
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barName: {
    color: '#8aaecb',
    fontSize: 11,
    fontWeight: '800',
  },
  barScore: {
    fontSize: 11,
    fontWeight: '900',
  },
  barTrack: {
    height: 5,
    backgroundColor: '#0f2438',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  recordsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  recordBox: {
    flex: 1,
    backgroundColor: '#0a1d30',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#173f67',
    paddingVertical: 12,
    alignItems: 'center',
  },
  recordLabel: {
    color: '#557f9f',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  recordVal: {
    color: '#00f3ff',
    fontSize: 16,
    fontWeight: '900',
  },
  badgeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeCounter: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '900',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeItem: {
    width: '48%',
    backgroundColor: '#091828',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#14314c',
    padding: 10,
    opacity: 0.5,
  },
  badgeItemUnlocked: {
    borderColor: '#00f3ff',
    backgroundColor: '#0b233a',
    opacity: 1,
  },
  badgeIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  badgeTitle: {
    color: '#6e93b2',
    fontSize: 11,
    fontWeight: '900',
  },
  badgeTitleUnlocked: {
    color: '#ffffff',
  },
  badgeDesc: {
    color: '#527796',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 2,
    marginBottom: 8,
  },
  badgeStatus: {
    paddingVertical: 2,
    borderRadius: 3,
    alignItems: 'center',
  },
  badgeStatusLocked: {
    backgroundColor: '#0d1e2e',
  },
  badgeStatusDone: {
    backgroundColor: '#00f3ff22',
  },
  badgeStatusText: {
    color: '#4f728f',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  badgeStatusTextDone: {
    color: '#00f3ff',
  },
  resetContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  resetBtn: {
    backgroundColor: '#1b1219',
    borderWidth: 1,
    borderColor: '#ff5376',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#ff5376',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
