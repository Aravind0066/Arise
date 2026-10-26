import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BottomNavigation } from '../components/BottomNavigation';
import {
  getHunterProfile,
  getHunterStats,
  getJournalEntries,
  getScreenTime,
  getWorkoutLogs,
  recordStudyCompletion,
  saveJournalEntry,
  saveScreenTimeVictory,
  saveWorkoutLog,
} from '../lib/hunterStorage';
import {
  HunterProfile,
  HunterStats,
  JournalEntry,
  ScreenTimeRecord,
  WorkoutLog,
} from '../lib/hunterTypes';
import { WORKOUT_ROUTINES } from '../lib/workoutEngine';

export default function ToolsScreen() {
  const router = useRouter();
  const [activeTool, setActiveTool] = useState<'workout' | 'study' | 'journal' | 'screen'>('workout');
  const [profile, setProfile] = useState<HunterProfile | null>(null);
  const [stats, setStats] = useState<HunterStats | null>(null);
  const [notice, setNotice] = useState('');

  // 1. WORKOUT STATE
  const [selectedRoutineId, setSelectedRoutineId] = useState(WORKOUT_ROUTINES[0].id);
  const [customExercise, setCustomExercise] = useState('Dumbbell Bench Press');
  const [sets, setSets] = useState('4');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('24');
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);

  // 2. POMODORO / STUDY STATE
  const [studyMode, setStudyMode] = useState<25 | 50 | 90>(25);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [studyTopic, setStudyTopic] = useState('Graph Theory & Shortest Path');
  const [showStudySummaryModal, setShowStudySummaryModal] = useState(false);

  // 3. JOURNAL STATE
  const [wentWell, setWentWell] = useState('');
  const [heldBack, setHeldBack] = useState('');
  const [improveTomorrow, setImproveTomorrow] = useState('');
  const [mood, setMood] = useState(8);
  const [energy, setEnergy] = useState(7);
  const [journalLogs, setJournalLogs] = useState<JournalEntry[]>([]);

  // 4. SCREEN TIME / DISCIPLINE STATE
  const [screenData, setScreenData] = useState<ScreenTimeRecord>({
    unlocks: 14,
    reelsMinutes: 18,
    productiveMinutes: 95,
    updatedAt: new Date().toISOString(),
  });

  const loadData = useCallback(async () => {
    const p = await getHunterProfile();
    const s = await getHunterStats();
    const w = await getWorkoutLogs();
    const j = await getJournalEntries();
    const sc = await getScreenTime();
    setProfile(p);
    setStats(s);
    setWorkoutLogs(w.slice(0, 5));
    setJournalLogs(j.slice(0, 3));
    setScreenData(sc);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // POMODORO TIMER ENGINE
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            if (interval) clearInterval(interval);
            setTimerRunning(false);
            setShowStudySummaryModal(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning]);

  const changeStudyMode = (min: 25 | 50 | 90) => {
    setStudyMode(min);
    setSecondsRemaining(min * 60);
    setTimerRunning(false);
  };

  const toggleTimer = () => {
    setTimerRunning((prev) => !prev);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setSecondsRemaining(studyMode * 60);
  };

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // FINISH POMODORO & REWARD KNOWLEDGE
  const handleCompletePomodoro = async () => {
    setShowStudySummaryModal(false);
    try {
      const res = await recordStudyCompletion({
        topic: studyTopic.trim() || 'Deep Work Study Session',
        durationMinutes: studyMode,
      });
      setProfile(res.profile);
      setStats(res.stats);
      setNotice(`+${studyMode >= 50 ? 80 : 50} XP AWARDED // KNOWLEDGE INCREASED TO ${res.stats.knowledge}`);
      resetTimer();
      setTimeout(() => setNotice(''), 4500);
    } catch (err: any) {
      Alert.alert('Study Error', err.message || 'Failed to complete session');
    }
  };

  // LAUNCH GUIDED WORKOUT
  const handleLaunchGuidedWorkout = () => {
    router.push({
      pathname: '/workout',
      params: {
        routineId: selectedRoutineId,
      },
    });
  };

  // SUBMIT CUSTOM WORKOUT LOG
  const handleLogCustomWorkout = async () => {
    if (!customExercise.trim()) return;
    try {
      const res = await saveWorkoutLog({
        workoutName: customExercise.trim(),
        exercisesCompleted: Number(sets) || 4,
        totalExercises: Number(sets) || 4,
        durationSeconds: 20 * 60,
        difficulty,
      });
      setWorkoutLogs((prev) => [res.workout, ...prev.slice(0, 4)]);
      setProfile(res.profile);
      setStats(res.stats);
      setNotice(`+50 XP AWARDED // STRENGTH STAT INCREASED TO ${res.stats.strength}`);
      setTimeout(() => setNotice(''), 4500);
    } catch (err: any) {
      setNotice(err.message || 'Log failed');
      setTimeout(() => setNotice(''), 4000);
    }
  };

  // SUBMIT JOURNAL ENTRY
  const handleLogJournal = async () => {
    if (!wentWell.trim() && !heldBack.trim()) {
      setNotice('Please provide at least one reflection insight.');
      setTimeout(() => setNotice(''), 4000);
      return;
    }
    try {
      const res = await saveJournalEntry({
        wentWell: wentWell.trim() || 'Held the line with focused execution.',
        heldBack: heldBack.trim() || 'Minor digital temptation.',
        improveTomorrow: improveTomorrow.trim() || 'Tackle the hardest mission first thing.',
        moodRating: mood,
        stressRating: 3,
        energyRating: energy,
      });
      setJournalLogs((prev) => [res.journal, ...prev.slice(0, 2)]);
      setProfile(res.profile);
      setStats(res.stats);
      setWentWell('');
      setHeldBack('');
      setImproveTomorrow('');
      setNotice(`+35 XP AWARDED // MINDFULNESS INCREASED TO ${res.stats.mindfulness}`);
      setTimeout(() => setNotice(''), 4500);
    } catch (err: any) {
      setNotice(err.message || 'Journal save failed');
      setTimeout(() => setNotice(''), 4000);
    }
  };

  // SUBMIT DISCIPLINE / SCREEN TIME VICTORY
  const handleLogScreenVictory = async () => {
    try {
      const res = await saveScreenTimeVictory(screenData);
      setScreenData(res.screenData);
      setProfile(res.profile);
      setStats(res.stats);
      setNotice(`+40 XP AWARDED // DISCIPLINE INCREASED TO ${res.stats.discipline}`);
      setTimeout(() => setNotice(''), 4500);
    } catch (err: any) {
      setNotice(err.message || 'Discipline save failed');
      setTimeout(() => setNotice(''), 4000);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.systemTag}>SYSTEM // UTILITY CORE</Text>
            <Text style={styles.pageTitle}>HUNTER ACTIVITY MODULES</Text>
          </View>

          {/* Module Selector Tabs */}
          <View style={styles.tabsRow}>
            {[
              { id: 'workout', label: 'WORKOUT', icon: '⚔️' },
              { id: 'study', label: 'POMODORO', icon: '⏱️' },
              { id: 'journal', label: 'JOURNAL', icon: '📝' },
              { id: 'screen', label: 'DISCIPLINE', icon: '🛡️' },
            ].map((tab) => (
              <Pressable
                key={tab.id}
                style={[styles.toolTab, activeTool === tab.id && styles.toolTabActive]}
                onPress={() => setActiveTool(tab.id as any)}
              >
                <Text style={styles.toolTabIcon}>{tab.icon}</Text>
                <Text style={[styles.toolTabLabel, activeTool === tab.id && styles.toolTabLabelActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {notice ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>⚡ {notice}</Text>
            </View>
          ) : null}

          {/* ========================================================= */}
          {/* 1. WORKOUT MODULE */}
          {/* ========================================================= */}
          {activeTool === 'workout' && (
            <View style={styles.moduleSection}>
              {/* Guided Workout Launcher Card */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>DUNGEON RAID // GUIDED WORKOUT</Text>
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>INTERACTIVE</Text>
                  </View>
                </View>
                <Text style={styles.cardSub}>
                  Select a dungeon protocol to launch the step-by-step guided movement flow.
                </Text>

                <View style={styles.routineSelectorList}>
                  {WORKOUT_ROUTINES.map((r) => {
                    const isSelected = selectedRoutineId === r.id;
                    return (
                      <Pressable
                        key={r.id}
                        style={[styles.routineItem, isSelected && styles.routineItemActive]}
                        onPress={() => setSelectedRoutineId(r.id)}
                      >
                        <View style={styles.routineItemHeader}>
                          <Text style={[styles.routineTitle, isSelected && styles.routineTitleActive]}>
                            {r.title}
                          </Text>
                          <Text style={styles.routineDuration}>{r.durationMinutes} MIN</Text>
                        </View>
                        <Text style={styles.routineGoal}>{r.goal}</Text>
                        <View style={styles.routineMetaRow}>
                          <Text style={styles.routineMetaText}>
                            {r.exercises.length} Exercises · {r.difficulty} · +{r.xpReward} XP
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={styles.primaryActionBtn}
                  onPress={handleLaunchGuidedWorkout}
                >
                  <Text style={styles.primaryActionBtnText}>LAUNCH GUIDED WORKOUT RAID ➔</Text>
                </Pressable>
              </View>

              {/* Custom Lifting Log Card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>CUSTOM TRAINING LOG</Text>
                <Text style={styles.cardSub}>
                  Record sets, reps, and weights from an off-system training session.
                </Text>

                <Text style={styles.inputLabel}>EXERCISE NAME</Text>
                <TextInput
                  value={customExercise}
                  onChangeText={setCustomExercise}
                  placeholder="e.g. Incline Dumbbell Press"
                  placeholderTextColor="#3e6382"
                  style={styles.inputField}
                />

                <View style={styles.threeColRow}>
                  <View style={styles.col}>
                    <Text style={styles.inputLabel}>SETS</Text>
                    <TextInput
                      value={sets}
                      onChangeText={setSets}
                      keyboardType="number-pad"
                      style={styles.inputField}
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.inputLabel}>REPS</Text>
                    <TextInput
                      value={reps}
                      onChangeText={setReps}
                      keyboardType="number-pad"
                      style={styles.inputField}
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.inputLabel}>KG</Text>
                    <TextInput
                      value={weight}
                      onChangeText={setWeight}
                      keyboardType="number-pad"
                      style={styles.inputField}
                    />
                  </View>
                </View>

                <Pressable style={styles.secondaryActionBtn} onPress={handleLogCustomWorkout}>
                  <Text style={styles.secondaryActionBtnText}>RECORD SET & GAIN XP (+50 XP)</Text>
                </Pressable>
              </View>

              {/* Recent Workout Logs */}
              {workoutLogs.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>RECENT WORKOUT RECORDS</Text>
                  <View style={styles.recentLogsList}>
                    {workoutLogs.map((log) => (
                      <View key={log._id} style={styles.recentLogItem}>
                        <View>
                          <Text style={styles.recentLogTitle}>{log.workoutName}</Text>
                          <Text style={styles.recentLogSub}>
                            {log.exercisesCompleted} Movements · {Math.round(log.durationSeconds / 60)} min
                          </Text>
                        </View>
                        <Text style={styles.recentLogXp}>+50 XP</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ========================================================= */}
          {/* 2. POMODORO / STUDY MODULE */}
          {/* ========================================================= */}
          {activeTool === 'study' && (
            <View style={styles.moduleSection}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>SYSTEM // DEEP WORK POMODORO</Text>
                <Text style={styles.cardSub}>
                  Lock in with zero distraction. The system awards Knowledge & Discipline XP upon completion.
                </Text>

                {/* Mode Selector */}
                <View style={styles.pomodoroModesRow}>
                  {([25, 50, 90] as const).map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.pomoModeChip, studyMode === m && styles.pomoModeChipActive]}
                      onPress={() => changeStudyMode(m)}
                    >
                      <Text style={[styles.pomoModeText, studyMode === m && styles.pomoModeTextActive]}>
                        {m} MIN {m === 25 ? '(SPRINT)' : m === 50 ? '(DEEP)' : '(HYPER)'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Timer Display */}
                <View style={styles.timerDisplayContainer}>
                  <Text style={styles.timerLargeText}>{formatTimer(secondsRemaining)}</Text>
                  <Text style={styles.timerStateText}>
                    {timerRunning ? '⚡ DEEP FOCUS ACTIVE' : '❚❚ FOCUS STANDBY'}
                  </Text>
                </View>

                {/* Study Topic Input */}
                <Text style={styles.inputLabel}>STUDY DOMAIN / CORE TOPIC</Text>
                <TextInput
                  value={studyTopic}
                  onChangeText={setStudyTopic}
                  placeholder="e.g. Distributed Consensus, System Design"
                  placeholderTextColor="#3e6382"
                  style={styles.inputField}
                />

                {/* Timer Controls */}
                <View style={styles.timerControlsRow}>
                  <Pressable
                    style={[styles.timerControlBtn, timerRunning ? styles.pauseBtn : styles.startBtn]}
                    onPress={toggleTimer}
                  >
                    <Text style={styles.timerControlBtnText}>
                      {timerRunning ? '❚❚ PAUSE SESSION' : '▶ START SESSION'}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.resetBtn} onPress={resetTimer}>
                    <Text style={styles.resetBtnText}>↺ RESET</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={styles.finishEarlyBtn}
                  onPress={() => setShowStudySummaryModal(true)}
                >
                  <Text style={styles.finishEarlyBtnText}>VERIFY & FINISH BLOCK ➔</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ========================================================= */}
          {/* 3. JOURNAL MODULE */}
          {/* ========================================================= */}
          {activeTool === 'journal' && (
            <View style={styles.moduleSection}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>MIND MATRIX // 3-PROMPT JOURNAL</Text>
                <Text style={styles.cardSub}>
                  Confront the shadow self. Daily reflection recalibrates neural focus and grants Mindfulness XP.
                </Text>

                <Text style={styles.inputLabel}>1. WHAT WENT WELL TODAY? (VICTORY)</Text>
                <TextInput
                  value={wentWell}
                  onChangeText={setWentWell}
                  placeholder="e.g. Crushed morning workout and completed 2 coding modules"
                  placeholderTextColor="#3e6382"
                  multiline
                  style={styles.textAreaField}
                />

                <Text style={styles.inputLabel}>2. WHAT HELD YOU BACK? (FRICTION / WEAKNESS)</Text>
                <TextInput
                  value={heldBack}
                  onChangeText={setHeldBack}
                  placeholder="e.g. Scrolled on phone for 20 mins after lunch"
                  placeholderTextColor="#3e6382"
                  multiline
                  style={styles.textAreaField}
                />

                <Text style={styles.inputLabel}>3. TOMORROW'S PRIME DIRECTIVE</Text>
                <TextInput
                  value={improveTomorrow}
                  onChangeText={setImproveTomorrow}
                  placeholder="e.g. No phone before 9am, lock in on DSA mock test"
                  placeholderTextColor="#3e6382"
                  multiline
                  style={styles.textAreaField}
                />

                <View style={styles.sliderRow}>
                  <View style={styles.col}>
                    <Text style={styles.inputLabel}>MOOD: {mood}/10</Text>
                    <View style={styles.scorePills}>
                      {[4, 6, 8, 10].map((v) => (
                        <Pressable
                          key={v}
                          style={[styles.scorePill, mood === v && styles.scorePillActive]}
                          onPress={() => setMood(v)}
                        >
                          <Text style={[styles.scorePillText, mood === v && styles.scorePillTextActive]}>
                            {v}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.inputLabel}>ENERGY: {energy}/10</Text>
                    <View style={styles.scorePills}>
                      {[4, 6, 8, 10].map((v) => (
                        <Pressable
                          key={v}
                          style={[styles.scorePill, energy === v && styles.scorePillActive]}
                          onPress={() => setEnergy(v)}
                        >
                          <Text style={[styles.scorePillText, energy === v && styles.scorePillTextActive]}>
                            {v}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>

                <Pressable style={styles.primaryActionBtn} onPress={handleLogJournal}>
                  <Text style={styles.primaryActionBtnText}>SAVE REFLECTION & CLAIM XP (+35 XP)</Text>
                </Pressable>
              </View>

              {journalLogs.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>RECENT REFLECTIONS</Text>
                  {journalLogs.map((j) => (
                    <View key={j._id} style={styles.recentJournalItem}>
                      <Text style={styles.recentJournalDate}>
                        {new Date(j.createdAt).toLocaleDateString()} · Mood {j.moodRating}/10
                      </Text>
                      <Text style={styles.recentJournalText}>“{j.wentWell}”</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ========================================================= */}
          {/* 4. DISCIPLINE / SCREEN TIME MODULE */}
          {/* ========================================================= */}
          {activeTool === 'screen' && (
            <View style={styles.moduleSection}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>DISCIPLINE DEFENSE // SCREEN TIME MATRIX</Text>
                <Text style={styles.cardSub}>
                  Measure intentional focus versus algorithmic capture. Overcome the doom scroll.
                </Text>

                {/* Metrics Readout */}
                <View style={styles.screenMetricsRow}>
                  <View style={styles.screenMetricBox}>
                    <Text style={styles.screenMetricLabel}>DEVICE UNLOCKS</Text>
                    <Text style={styles.screenMetricVal}>{screenData.unlocks}</Text>
                  </View>
                  <View style={styles.screenMetricBox}>
                    <Text style={styles.screenMetricLabel}>REELS / SHORTS</Text>
                    <Text style={[styles.screenMetricVal, { color: screenData.reelsMinutes > 20 ? '#ff5376' : '#38ef7d' }]}>
                      {screenData.reelsMinutes}m
                    </Text>
                  </View>
                  <View style={styles.screenMetricBox}>
                    <Text style={styles.screenMetricLabel}>PRODUCTIVE</Text>
                    <Text style={[styles.screenMetricVal, { color: '#00f3ff' }]}>
                      {screenData.productiveMinutes}m
                    </Text>
                  </View>
                </View>

                {/* Adjusters */}
                <Text style={styles.inputLabel}>UPDATE SHORT-FORM CONSUMPTION (MINUTES)</Text>
                <View style={styles.reelAdjustRow}>
                  <Pressable
                    style={styles.adjustBtn}
                    onPress={() =>
                      setScreenData((prev) => ({
                        ...prev,
                        reelsMinutes: Math.max(0, prev.reelsMinutes - 5),
                      }))
                    }
                  >
                    <Text style={styles.adjustBtnText}>−5m</Text>
                  </Pressable>
                  <Text style={styles.largeReelDisplay}>{screenData.reelsMinutes} MIN</Text>
                  <Pressable
                    style={styles.adjustBtn}
                    onPress={() =>
                      setScreenData((prev) => ({
                        ...prev,
                        reelsMinutes: prev.reelsMinutes + 5,
                      }))
                    }
                  >
                    <Text style={styles.adjustBtnText}>+5m</Text>
                  </Pressable>
                </View>

                <Pressable style={styles.primaryActionBtn} onPress={handleLogScreenVictory}>
                  <Text style={styles.primaryActionBtnText}>LOG DISCIPLINE CHECKPOINT (+40 XP)</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Pomodoro Completion Modal */}
        <Modal visible={showStudySummaryModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.summaryModalCard}>
              <Text style={styles.summaryModalTag}>SYSTEM // POMODORO COMPLETE</Text>
              <Text style={styles.summaryModalTitle}>DEEP FOCUS REWARD</Text>
              <Text style={styles.summaryModalDesc}>
                Session successfully logged for “{studyTopic}”. Ready to accredit Knowledge XP to your hunter dossier.
              </Text>

              <View style={styles.summaryModalStats}>
                <Text style={styles.summaryModalStatsText}>
                  +{studyMode >= 50 ? 80 : 50} XP · +4 KNOWLEDGE · +2 DISCIPLINE
                </Text>
              </View>

              <View style={styles.modalBtns}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setShowStudySummaryModal(false)}
                >
                  <Text style={styles.cancelBtnText}>DISMISS</Text>
                </Pressable>
                <Pressable
                  style={styles.confirmBtn}
                  onPress={handleCompletePomodoro}
                >
                  <Text style={styles.confirmBtnText}>ACCREDIT XP ➔</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <BottomNavigation active="tools" />
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
    paddingBottom: 90,
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
  pageTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  toolTab: {
    flex: 1,
    backgroundColor: '#071626',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#173654',
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  toolTabActive: {
    backgroundColor: '#00f3ff22',
    borderColor: '#00f3ff',
  },
  toolTabIcon: {
    fontSize: 16,
  },
  toolTabLabel: {
    color: '#557c9c',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  toolTabLabelActive: {
    color: '#00f3ff',
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
  moduleSection: {
    gap: 14,
  },
  card: {
    backgroundColor: '#071626',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#163b5e',
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  activePill: {
    backgroundColor: '#00f3ff22',
    borderWidth: 1,
    borderColor: '#00f3ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
    color: '#00f3ff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardSub: {
    color: '#7094b2',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 14,
  },
  routineSelectorList: {
    gap: 10,
    marginBottom: 16,
  },
  routineItem: {
    backgroundColor: '#0a1d30',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#163b5e',
    padding: 12,
  },
  routineItemActive: {
    borderColor: '#00f3ff',
    backgroundColor: '#0c2642',
  },
  routineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  routineTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  routineTitleActive: {
    color: '#00f3ff',
  },
  routineDuration: {
    color: '#ffd700',
    fontSize: 11,
    fontWeight: '900',
  },
  routineGoal: {
    color: '#7f9fb9',
    fontSize: 11,
    marginBottom: 6,
  },
  routineMetaRow: {
    borderTopWidth: 1,
    borderTopColor: '#143350',
    paddingTop: 6,
  },
  routineMetaText: {
    color: '#557e9f',
    fontSize: 10,
    fontWeight: '700',
  },
  primaryActionBtn: {
    backgroundColor: '#00f3ff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryActionBtnText: {
    color: '#02111d',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  secondaryActionBtn: {
    backgroundColor: '#0c2238',
    borderWidth: 1,
    borderColor: '#1a4974',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryActionBtnText: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '900',
  },
  inputLabel: {
    color: '#557f9f',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  inputField: {
    backgroundColor: '#0c1f33',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#19446e',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#ffffff',
    fontSize: 12,
    marginBottom: 12,
  },
  textAreaField: {
    backgroundColor: '#0c1f33',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#19446e',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#ffffff',
    fontSize: 12,
    minHeight: 50,
    marginBottom: 12,
  },
  threeColRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  col: {
    flex: 1,
  },
  recentLogsList: {
    gap: 8,
    marginTop: 6,
  },
  recentLogItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0b1d30',
    padding: 10,
    borderRadius: 8,
  },
  recentLogTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  recentLogSub: {
    color: '#678dae',
    fontSize: 10,
    marginTop: 2,
  },
  recentLogXp: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '900',
  },

  // POMODORO STYLES
  pomodoroModesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pomoModeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#09192b',
    borderWidth: 1,
    borderColor: '#173b5e',
    alignItems: 'center',
  },
  pomoModeChipActive: {
    backgroundColor: '#00f3ff22',
    borderColor: '#00f3ff',
  },
  pomoModeText: {
    color: '#658bae',
    fontSize: 9,
    fontWeight: '900',
  },
  pomoModeTextActive: {
    color: '#00f3ff',
  },
  timerDisplayContainer: {
    alignItems: 'center',
    backgroundColor: '#05111f',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#153554',
    paddingVertical: 24,
    marginBottom: 16,
  },
  timerLargeText: {
    color: '#00f3ff',
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: 2,
  },
  timerStateText: {
    color: '#ffd700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 6,
  },
  timerControlsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  timerControlBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
  },
  startBtn: {
    backgroundColor: '#00f3ff',
  },
  pauseBtn: {
    backgroundColor: '#ffd700',
  },
  timerControlBtnText: {
    color: '#02111d',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  resetBtn: {
    flex: 1,
    backgroundColor: '#0c1f33',
    borderWidth: 1,
    borderColor: '#19446e',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#89a8c4',
    fontSize: 11,
    fontWeight: '900',
  },
  finishEarlyBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  finishEarlyBtnText: {
    color: '#5e87a8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // JOURNAL STYLES
  sliderRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  scorePills: {
    flexDirection: 'row',
    gap: 6,
  },
  scorePill: {
    flex: 1,
    backgroundColor: '#0b1d30',
    borderWidth: 1,
    borderColor: '#173f67',
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  scorePillActive: {
    backgroundColor: '#00f3ff',
    borderColor: '#00f3ff',
  },
  scorePillText: {
    color: '#658bae',
    fontSize: 10,
    fontWeight: '900',
  },
  scorePillTextActive: {
    color: '#02111d',
  },
  recentJournalItem: {
    backgroundColor: '#0b1d30',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  recentJournalDate: {
    color: '#00f3ff',
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 4,
  },
  recentJournalText: {
    color: '#9dbcd8',
    fontSize: 11,
    fontStyle: 'italic',
  },

  // SCREEN TIME STYLES
  screenMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  screenMetricBox: {
    flex: 1,
    backgroundColor: '#0a1d30',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#173d63',
    paddingVertical: 12,
    alignItems: 'center',
  },
  screenMetricLabel: {
    color: '#557f9f',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  screenMetricVal: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  reelAdjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a1d30',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  adjustBtn: {
    backgroundColor: '#0f2b48',
    borderWidth: 1,
    borderColor: '#194a78',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  adjustBtnText: {
    color: '#00f3ff',
    fontSize: 12,
    fontWeight: '900',
  },
  largeReelDisplay: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },

  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 12, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  summaryModalCard: {
    width: '100%',
    backgroundColor: '#071626',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#00f3ff',
    padding: 20,
    alignItems: 'center',
  },
  summaryModalTag: {
    color: '#00f3ff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  summaryModalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 6,
  },
  summaryModalDesc: {
    color: '#83a4c0',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  summaryModalStats: {
    backgroundColor: '#0b233a',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryModalStatsText: {
    color: '#ffd700',
    fontSize: 11,
    fontWeight: '900',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#0b1d30',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#769cbd',
    fontSize: 11,
    fontWeight: '900',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#00f3ff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#02111d',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
