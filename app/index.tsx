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
import { BottomNavigation } from '../components/BottomNavigation';
import { MorningBriefingModal } from '../components/MorningBriefingModal';
import { OnboardingModal } from '../components/OnboardingModal';
import { PentagonChart } from '../components/PentagonChart';
import {
  getHunterHistory,
  getHunterProfile,
  getHunterQuests,
  getHunterStats,
  getWorkoutLogs,
  saveHunterProfile,
  saveHunterStats,
  XP_PER_LEVEL,
} from '../lib/hunterStorage';
import { CompletedLog, HunterProfile, HunterQuest, HunterStats, WorkoutLog } from '../lib/hunterTypes';
import { getWorkoutActivity } from '../lib/workoutActivity';

export default function HomeScreen() {
  const { theme } = useAppearance();
  const themedStyles = useThemedStyles(styles);
  const router = useRouter();
  const [profile, setProfile] = useState<HunterProfile | null>(null);
  const [stats, setStats] = useState<HunterStats>({
    strength: 35,
    knowledge: 40,
    discipline: 30,
    health: 45,
    mindfulness: 35,
  });
  const [quests, setQuests] = useState<HunterQuest[]>([]);
  const [history, setHistory] = useState<CompletedLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMorningBriefing, setShowMorningBriefing] = useState(false);
  const [systemNotification, setSystemNotification] = useState('');

  const loadData = useCallback(async () => {
    const p = await getHunterProfile();
    const s = await getHunterStats();

    if (!p || !p.onboarded) {
      setShowOnboarding(true);
      return;
    }

    const q = await getHunterQuests();
    const h = await getHunterHistory();
    const w = await getWorkoutLogs();
    setShowOnboarding(false);
    setProfile(p);
    setStats(s);
    setQuests(q);
    setHistory(h);
    setWorkoutLogs(w);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleOnboardingComplete = async (newProfile: HunterProfile, newStats: HunterStats) => {
    setProfile(newProfile);
    setStats(newStats);
    const q = await getHunterQuests();
    const h = await getHunterHistory();
    const w = await getWorkoutLogs();
    setQuests(q);
    setHistory(h);
    setWorkoutLogs(w);
    setShowOnboarding(false);
    setSystemNotification(`HUNTER AWAKENED: ${newProfile.name} // [ ${newProfile.title} ]`);
    setTimeout(() => setSystemNotification(''), 5000);
  };

  const handleMorningDismiss = async (completedCount: number) => {
    setShowMorningBriefing(false);
    if (completedCount > 0 && profile) {
      const updatedProfile = { ...profile, morningProtocolDoneToday: true };
      updatedProfile.xp += completedCount * 20;
      updatedProfile.level = Math.floor(updatedProfile.xp / XP_PER_LEVEL) + 1;
      await saveHunterProfile(updatedProfile);
      setProfile(updatedProfile);

      const s = { ...stats };
      s.health = Math.min(100, s.health + 2);
      s.discipline = Math.min(100, s.discipline + 2);
      await saveHunterStats(s);
      setStats(s);

      setSystemNotification(
        `MORNING PROTOCOL ENGAGED: +${completedCount * 20} XP · 1.25x MULTIPLIER ACTIVE`
      );
      setTimeout(() => setSystemNotification(''), 4500);
    }
  };

  const handleActionableQuestPress = (quest: HunterQuest) => {
    if (quest.category.toUpperCase() === 'FITNESS') {
      router.push({
        pathname: '/tools',
        params: {
          tab: 'workout',
          questId: quest._id,
          workoutTitle: quest.title,
        },
      });
    } else if (quest.category.toUpperCase() === 'STUDY') {
      router.push({ pathname: '/tools', params: { tab: 'pomo' } });
    } else {
      router.push('/quests');
    }
  };

  // Calculations for Level and Progress
  const currentXp = profile?.xp ?? 0;
  const currentLevel = profile?.level ?? 1;
  const xpInCurrentLevel = currentXp % XP_PER_LEVEL;
  const xpProgressPercent = Math.min(100, (xpInCurrentLevel / XP_PER_LEVEL) * 100);

  const activeQuests = quests.filter((q) => q.status === 'active');
  const completedToday = quests.filter((q) => q.status === 'completed').length;
  const totalToday = Math.max(1, quests.length);
  const dailyProgressPercent = Math.round((completedToday / totalToday) * 100);

  // Single featured actionable quest
  const featuredQuest = activeQuests[0] || null;
  const workoutActivity = getWorkoutActivity(workoutLogs);

  // Next level unlock description
  const nextLevel = currentLevel + 1;
  const nextRewardText =
    currentLevel >= 10
      ? 'Level 15: Master Rank Title & Minimalist HUD Matrix'
      : currentLevel >= 5
      ? 'Level 10: Shadow Crimson HUD Theme & Elite Designation'
      : `Level ${nextLevel}: Advanced Workout Routines & Stat Surge`;

  return (
    <View style={themedStyles.root}>
      <SafeAreaView style={themedStyles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={themedStyles.content}>
          {/* Top HUD Header */}
          <View style={themedStyles.topBar}>
            <View>
              <Text style={themedStyles.systemBrand}>HOME // HUNTER-OS</Text>
              <Text style={themedStyles.systemSub}>DAILY PROGRESSION DASHBOARD</Text>
            </View>
            <View style={themedStyles.statusGroup}>
              <View style={themedStyles.liveBadge}>
                <Text style={themedStyles.liveDot}>●</Text>
                <Text style={themedStyles.liveText}>SYSTEM ONLINE</Text>
              </View>
            </View>
          </View>

          {/* System Notification banner */}
          {systemNotification ? (
            <View style={themedStyles.notifBanner}>
              <Text style={themedStyles.notifText}>⚡ {systemNotification}</Text>
            </View>
          ) : null}

          {/* Hunter Identity Card */}
          <View style={themedStyles.identityCard}>
            <View style={themedStyles.identityHeader}>
              <View style={themedStyles.rankBadge}>
                <Text style={themedStyles.rankText}>{profile?.rank || 'E-RANK'}</Text>
              </View>
              <Text style={themedStyles.hunterTitle}>[ {profile?.title || 'THE AWAKENED'} ]</Text>
            </View>

            <View style={themedStyles.identityBody}>
              <View>
                <Text style={themedStyles.hunterName}>{profile?.name || 'Hunter'}</Text>
                <Text style={themedStyles.hunterBio}>
                  {profile?.fitnessLevel || 'Intermediate'} · {profile?.studyFocus || 'DSA'}
                </Text>
              </View>
              <View style={themedStyles.levelBlock}>
                <Text style={themedStyles.levelLabel}>HUNTER LEVEL</Text>
                <Text style={themedStyles.levelNumber}>{currentLevel}</Text>
              </View>
            </View>

            {/* XP Progression Bar */}
            <View style={themedStyles.xpSection}>
              <View style={themedStyles.xpLabelRow}>
                <Text style={themedStyles.xpCaption}>EXPERIENCE PROGRESS</Text>
                <Text style={themedStyles.xpNumbers}>
                  {xpInCurrentLevel} / {XP_PER_LEVEL} XP
                </Text>
              </View>
              <View style={themedStyles.xpTrack}>
                <View style={[themedStyles.xpFill, { width: `${xpProgressPercent}%` }]} />
              </View>
            </View>

            {/* Next Level Rewards Preview Box */}
            <View style={themedStyles.nextRewardBox}>
              <Text style={themedStyles.nextRewardLabel}>NEXT LEVEL REWARD PREVIEW:</Text>
              <Text style={themedStyles.nextRewardText}>{nextRewardText}</Text>
            </View>
          </View>

          {/* Morning System Protocol Banner */}
          <Pressable
            style={themedStyles.morningCard}
            onPress={() => setShowMorningBriefing(true)}
          >
            <View style={themedStyles.morningIconBox}>
              <Text style={themedStyles.morningIcon}>☀</Text>
            </View>
            <View style={themedStyles.morningDetails}>
              <Text style={themedStyles.morningTitle}>
                {profile?.morningProtocolDoneToday
                  ? 'MORNING PROTOCOL ACTIVE (1.25x XP)'
                  : 'ENGAGE MORNING SYSTEM BRIEFING'}
              </Text>
              <Text style={themedStyles.morningSub}>
                Sunlight · Hydration · Posture · 10m Physiology
              </Text>
            </View>
            <Text style={themedStyles.morningArrow}>➔</Text>
          </Pressable>

          {/* Pentagon Stat Radar Chart Card */}
          <View style={themedStyles.pentagonCard}>
            <View style={themedStyles.sectionHeader}>
              <Text style={themedStyles.sectionTitle}>PENTAGON STAT MATRIX</Text>
              <Text style={themedStyles.statBalanceTag}>
                TOTAL: {stats.strength + stats.knowledge + stats.discipline + stats.health + stats.mindfulness} PTS
              </Text>
            </View>

            <PentagonChart stats={stats} size={300} />

            {/* Quick Stat Tiles */}
            <View style={themedStyles.statTilesGrid}>
              <View style={themedStyles.statTile}>
                <Text style={themedStyles.statTileLabel}>⚔️ STR</Text>
                <Text style={[themedStyles.statTileVal, { color: theme.error }]}>{stats.strength}</Text>
              </View>
              <View style={themedStyles.statTile}>
                <Text style={themedStyles.statTileLabel}>📜 KNW</Text>
                <Text style={[themedStyles.statTileVal, { color: theme.accent }]}>{stats.knowledge}</Text>
              </View>
              <View style={themedStyles.statTile}>
                <Text style={themedStyles.statTileLabel}>🛡️ DIS</Text>
                <Text style={[themedStyles.statTileVal, { color: theme.warning }]}>{stats.discipline}</Text>
              </View>
              <View style={themedStyles.statTile}>
                <Text style={themedStyles.statTileLabel}>💧 HLT</Text>
                <Text style={[themedStyles.statTileVal, { color: theme.success }]}>{stats.health}</Text>
              </View>
              <View style={themedStyles.statTile}>
                <Text style={themedStyles.statTileLabel}>🧘 MND</Text>
                <Text style={[themedStyles.statTileVal, { color: theme.purple }]}>{stats.mindfulness}</Text>
              </View>
            </View>
          </View>

          {/* One Featured Actionable Directive */}
          {featuredQuest && (
            <View style={themedStyles.featuredQuestCard}>
              <View style={themedStyles.featuredBadgeRow}>
                <View style={themedStyles.featuredPill}>
                  <Text style={themedStyles.featuredPillText}>★ FEATURED SYSTEM DIRECTIVE</Text>
                </View>
                <Text style={themedStyles.featuredXpBadge}>+{featuredQuest.xpReward} XP</Text>
              </View>

              <Text style={themedStyles.featuredTitle}>{featuredQuest.title}</Text>
              <Text style={themedStyles.featuredDesc}>{featuredQuest.description}</Text>

              <View style={themedStyles.featuredFooter}>
                <Text style={themedStyles.featuredStatText}>
                  Target: +{featuredQuest.statBonus} {featuredQuest.targetStat.toUpperCase()}
                </Text>
                <Pressable
                  style={themedStyles.featuredActionBtn}
                  onPress={() => handleActionableQuestPress(featuredQuest)}
                >
                  <Text style={themedStyles.featuredActionBtnText}>
                    {featuredQuest.category.toUpperCase() === 'FITNESS'
                      ? 'ENTER WORKOUT RAID ➔'
                      : featuredQuest.category.toUpperCase() === 'STUDY'
                      ? 'START STUDY BLOCK ➔'
                      : 'ENGAGE DIRECTIVE ➔'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Daily Missions & Streak Summary */}
          <View style={themedStyles.dailyHUDCard}>
            <View style={themedStyles.dailyHUDHeader}>
              <Text style={themedStyles.dailyHUDTitle}>DAILY MISSION RATIO</Text>
              <Text style={themedStyles.dailyHUDVal}>
                {completedToday} / {totalToday} DIRECTIVES ({dailyProgressPercent}%)
              </Text>
            </View>
            <View style={themedStyles.dailyHUDTrack}>
              <View style={[themedStyles.dailyHUDFill, { width: `${dailyProgressPercent}%` }]} />
            </View>
          </View>

          <View style={themedStyles.activitySummaryCard}>
            <View style={themedStyles.activitySummaryHeader}>
              <View>
                <Text style={themedStyles.activitySummaryTitle}>WORKOUT CONSISTENCY</Text>
                <Text style={themedStyles.activitySummarySub}>
                  {workoutActivity.hasHistory
                    ? `${workoutActivity.completedDaysThisWeek} of 7 days active this week`
                    : 'No completed workouts logged yet'}
                </Text>
              </View>
              <Text style={themedStyles.activityStreak}>🔥 {workoutActivity.streak}-day</Text>
            </View>
            <View style={themedStyles.activitySummaryWeek}>
              {workoutActivity.activity.map((day) => (
                <View key={day.key} style={themedStyles.activitySummaryDay}>
                  <Text style={[themedStyles.activitySummaryLabel, day.isToday && themedStyles.activitySummaryToday]}>{day.label}</Text>
                  <View style={[
                    themedStyles.activitySummaryDot,
                    day.complete && themedStyles.activitySummaryComplete,
                    day.isToday && !day.complete && themedStyles.activitySummaryTodayDot,
                  ]}>
                    <Text style={themedStyles.activitySummaryCheck}>{day.complete ? '✓' : day.isToday ? '•' : ''}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={themedStyles.recentProgressCard}>
            <View style={themedStyles.recentProgressHeader}>
              <Text style={themedStyles.recentProgressTitle}>RECENT PROGRESS</Text>
              <Pressable onPress={() => router.push('/profile')}>
                <Text style={themedStyles.recentProgressLink}>SYSTEM RECORDS →</Text>
              </Pressable>
            </View>
            {history.length ? history.slice(0, 3).map((entry) => (
              <View key={entry._id} style={themedStyles.recentProgressRow}>
                <View style={themedStyles.recentProgressCopy}>
                  <Text style={themedStyles.recentProgressEntry} numberOfLines={1}>{entry.title}</Text>
                  <Text style={themedStyles.recentProgressCategory}>{entry.category}</Text>
                </View>
                <Text style={themedStyles.recentProgressXp}>+{entry.xpEarned} XP</Text>
              </View>
            )) : (
              <Text style={themedStyles.recentProgressEmpty}>Completed routines and directives will appear here.</Text>
            )}
          </View>
        </ScrollView>

        <MorningBriefingModal
          visible={showMorningBriefing}
          hunterName={profile?.name || 'Hunter'}
          onDismiss={handleMorningDismiss}
        />

        <OnboardingModal
          visible={showOnboarding}
          onComplete={handleOnboardingComplete}
        />

        <BottomNavigation active="home" />
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
    paddingBottom: 95,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  systemBrand: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  systemSub: {
    color: '#557c9c',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 243, 255, 0.08)',
    borderWidth: 1,
    borderColor: '#00f3ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 5,
  },
  liveDot: {
    color: '#00f3ff',
    fontSize: 8,
  },
  liveText: {
    color: '#00f3ff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  notifBanner: {
    backgroundColor: '#0b233a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00f3ff',
    padding: 10,
    marginBottom: 14,
  },
  notifText: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  identityCard: {
    backgroundColor: '#071626',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#163b5e',
    padding: 16,
    marginBottom: 14,
  },
  identityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rankBadge: {
    backgroundColor: '#1b1236',
    borderWidth: 1,
    borderColor: '#9d4edd',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  rankText: {
    color: '#c084fc',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  hunterTitle: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  identityBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  hunterName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  hunterBio: {
    color: '#6e93b2',
    fontSize: 11,
    marginTop: 2,
  },
  levelBlock: {
    alignItems: 'flex-end',
  },
  levelLabel: {
    color: '#557f9f',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  levelNumber: {
    color: '#00f3ff',
    fontSize: 26,
    fontWeight: '900',
  },
  xpSection: {
    marginBottom: 12,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  xpCaption: {
    color: '#557f9f',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  xpNumbers: {
    color: '#7ba0c0',
    fontSize: 10,
    fontWeight: '800',
  },
  xpTrack: {
    height: 6,
    backgroundColor: '#0c1d2e',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#00f3ff',
  },
  nextRewardBox: {
    backgroundColor: '#091827',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#13314f',
  },
  nextRewardLabel: {
    color: '#587f9f',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  nextRewardText: {
    color: '#93b6d4',
    fontSize: 10,
    fontWeight: '700',
  },
  morningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09192b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#173f66',
    padding: 14,
    marginBottom: 14,
  },
  morningIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#0e2b47',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  morningIcon: {
    fontSize: 18,
    color: '#ffd700',
  },
  morningDetails: {
    flex: 1,
  },
  morningTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  morningSub: {
    color: '#6f93b1',
    fontSize: 10,
    marginTop: 2,
  },
  morningArrow: {
    color: '#00f3ff',
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 8,
  },
  pentagonCard: {
    backgroundColor: '#071626',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#163b5e',
    padding: 16,
    marginBottom: 14,
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statBalanceTag: {
    color: '#00f3ff',
    fontSize: 9,
    fontWeight: '900',
  },
  statTilesGrid: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
    marginTop: 10,
  },
  statTile: {
    flex: 1,
    backgroundColor: '#0a1d30',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  statTileLabel: {
    color: '#557f9f',
    fontSize: 8,
    fontWeight: '900',
    marginBottom: 2,
  },
  statTileVal: {
    fontSize: 13,
    fontWeight: '900',
  },
  featuredQuestCard: {
    backgroundColor: '#071626',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#00f3ff',
    padding: 16,
    marginBottom: 14,
  },
  featuredBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  featuredPill: {
    backgroundColor: '#00f3ff22',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  featuredPillText: {
    color: '#00f3ff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  featuredXpBadge: {
    color: '#ffd700',
    fontSize: 11,
    fontWeight: '900',
  },
  featuredTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
    marginBottom: 6,
  },
  featuredDesc: {
    color: '#84a5c2',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#143350',
    paddingTop: 10,
  },
  featuredStatText: {
    color: '#5982a3',
    fontSize: 10,
    fontWeight: '800',
  },
  featuredActionBtn: {
    backgroundColor: '#00f3ff',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  featuredActionBtnText: {
    color: '#02111d',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  dailyHUDCard: {
    backgroundColor: '#071626',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#163b5e',
    padding: 14,
    marginBottom: 14,
  },
  activitySummaryCard: {
    backgroundColor: '#071626',
    borderWidth: 1,
    borderColor: '#183652',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  activitySummaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  activitySummaryTitle: { color: '#eaf6ff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  activitySummarySub: { color: '#698ba6', fontSize: 10, marginTop: 4 },
  activityStreak: { color: '#fbb03b', fontSize: 13, fontWeight: '900' },
  activitySummaryWeek: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 14 },
  activitySummaryDay: { flex: 1, alignItems: 'center', gap: 6 },
  activitySummaryLabel: { color: '#69839a', fontSize: 9, fontWeight: '700' },
  activitySummaryToday: { color: '#00f3ff' },
  activitySummaryDot: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: '#263a4e', backgroundColor: '#101d2a', alignItems: 'center', justifyContent: 'center' },
  activitySummaryComplete: { borderColor: '#22c99a', backgroundColor: 'rgba(34, 201, 154, 0.18)' },
  activitySummaryTodayDot: { borderColor: '#00cbd4', backgroundColor: 'rgba(0, 203, 212, 0.08)' },
  activitySummaryCheck: { color: '#42e0b2', fontSize: 13, fontWeight: '900' },
  recentProgressCard: { backgroundColor: '#071626', borderWidth: 1, borderColor: '#183652', borderRadius: 12, padding: 14, marginTop: 14, marginBottom: 18 },
  recentProgressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  recentProgressTitle: { color: '#eaf6ff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  recentProgressLink: { color: '#00dce8', fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
  recentProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#122c45' },
  recentProgressCopy: { flex: 1 },
  recentProgressEntry: { color: '#cde1ee', fontSize: 11, fontWeight: '700' },
  recentProgressCategory: { color: '#6687a2', fontSize: 9, marginTop: 3 },
  recentProgressXp: { color: '#38ef7d', fontSize: 10, fontWeight: '900' },
  recentProgressEmpty: { color: '#698ba6', fontSize: 10, paddingTop: 6, lineHeight: 15 },
  dailyHUDHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dailyHUDTitle: {
    color: '#557f9f',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dailyHUDVal: {
    color: '#38ef7d',
    fontSize: 10,
    fontWeight: '800',
  },
  dailyHUDTrack: {
    height: 6,
    backgroundColor: '#0c1d2e',
    borderRadius: 3,
    overflow: 'hidden',
  },
  dailyHUDFill: {
    height: '100%',
    backgroundColor: '#38ef7d',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionTile: {
    width: '48%',
    backgroundColor: '#071626',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#163b5e',
    padding: 14,
  },
  actionIcon: {
    fontSize: 22,
    marginBottom: 8,
  },
  actionTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  actionSub: {
    color: '#5b82a3',
    fontSize: 10,
    marginTop: 2,
  },
});
