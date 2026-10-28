import { useAppearance, useThemedStyles } from '../lib/AppearanceContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from '../components/BottomNavigation';
import WorkoutScreen from '../components/WorkoutScreen';
import NutritionContent from '../components/NutritionContent';
import {
  getJournalEntries,
  getScreenTime,
  getWorkoutLogs,
  recordStudyCompletion,
  saveJournalEntry,
  saveScreenTimeVictory,
  saveWorkoutLog,
} from '../lib/hunterStorage';
import {
  JournalEntry,
  ScreenTimeRecord,
  WorkoutLog,
} from '../lib/hunterTypes';
import { setChatDraft, useChatDraft } from '../lib/chatDraftStore';
import { canAccreditPomodoro } from '../lib/pomodoroRules';
import { buildCustomWorkoutLog } from '../lib/workoutLogUtils';

export default function ToolsScreen() {
  const { theme } = useAppearance();
  const themedStyles = useThemedStyles(styles);
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; section?: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const [activeTool, setActiveTool] = useState<'workout' | 'nutrition' | 'home' | 'pomo' | 'ascend'>('home');
  const [ascendSection, setAscendSection] = useState<'journal' | 'discipline'>('journal');
  const [notice, setNotice] = useState('');
  const chatSearchDraft = useChatDraft();
  const chatOpenedRef = useRef(false);
  const homeColumns = windowWidth >= 1474 ? 4 : windowWidth >= 1100 ? 3 : windowWidth < 360 ? 1 : 2;
  const homeGridMaxWidth = homeColumns === 4 ? 1460 : homeColumns === 3 ? 1080 : homeColumns === 2 ? 714 : 350;
  const homeGridWidth = Math.min(Math.max(0, windowWidth - 32), homeGridMaxWidth);
  const homeCardWidth = Math.min(350, (homeGridWidth - 14 * (homeColumns - 1)) / homeColumns);

  useEffect(() => {
    if (params.tab === 'discipline') {
      setActiveTool('ascend');
      setAscendSection('discipline');
      return;
    }
    if (params.tab === 'workout' || params.tab === 'nutrition' || params.tab === 'home' || params.tab === 'pomo' || params.tab === 'ascend') {
      setActiveTool(params.tab);
      if (params.tab === 'ascend' && params.section === 'discipline') setAscendSection('discipline');
      if (params.tab === 'ascend' && params.section === 'journal') setAscendSection('journal');
    }
  }, [params.tab, params.section]);

  // 1. WORKOUT STATE
  const [customExercise, setCustomExercise] = useState('Dumbbell Bench Press');
  const [sets, setSets] = useState('4');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('24');
  const difficulty = 'Intermediate' as const;
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);

  // 2. POMODORO / STUDY STATE
  const [studyMode, setStudyMode] = useState<25 | 50 | 90>(25);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [studyTopic, setStudyTopic] = useState('Graph Theory & Shortest Path');
  const [showStudySummaryModal, setShowStudySummaryModal] = useState(false);
  const [studySessionId, setStudySessionId] = useState(() => `pomo-${Date.now()}`);
  const [studySessionComplete, setStudySessionComplete] = useState(false);
  const [studySessionRewarded, setStudySessionRewarded] = useState(false);
  const pomodoroAccreditingRef = useRef(false);

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
    const w = await getWorkoutLogs();
    const j = await getJournalEntries();
    const sc = await getScreenTime();
    setWorkoutLogs(w.slice(0, 5));
    setJournalLogs(j.slice(0, 3));
    setScreenData(sc);
  }, []);

  useFocusEffect(
    useCallback(() => {
      chatOpenedRef.current = false;
      loadData();
    }, [loadData])
  );

  const submitSearch = () => {
    if (!chatSearchDraft.trim() || chatOpenedRef.current) return;
    chatOpenedRef.current = true;
    try {
      router.push('/chat');
    } catch {
      chatOpenedRef.current = false;
    }
  };

  // POMODORO TIMER ENGINE
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            if (interval) clearInterval(interval);
            setTimerRunning(false);
            setStudySessionComplete(true);
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
    setStudySessionId(`pomo-${Date.now()}`);
    setStudySessionComplete(false);
    setStudySessionRewarded(false);
    setShowStudySummaryModal(false);
  };

  const toggleTimer = () => {
    if (studySessionComplete || studySessionRewarded) return;
    setTimerRunning((prev) => !prev);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setSecondsRemaining(studyMode * 60);
    setStudySessionId(`pomo-${Date.now()}`);
    setStudySessionComplete(false);
    setStudySessionRewarded(false);
    setShowStudySummaryModal(false);
  };

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // FINISH POMODORO & REWARD KNOWLEDGE
  const handleCompletePomodoro = async () => {
    if (!canAccreditPomodoro(studySessionComplete, studySessionRewarded) || pomodoroAccreditingRef.current) return;
    pomodoroAccreditingRef.current = true;
    setShowStudySummaryModal(false);
    try {
      const res = await recordStudyCompletion({
        topic: studyTopic.trim() || 'Deep Work Study Session',
        durationMinutes: studyMode,
        completionId: studySessionId,
      });
      setStudySessionRewarded(true);
      setNotice(`+${studyMode >= 50 ? 80 : 50} XP AWARDED // KNOWLEDGE INCREASED TO ${res.stats.knowledge}`);
      resetTimer();
      setTimeout(() => setNotice(''), 4500);
    } catch (err: any) {
      Alert.alert('Study Error', err.message || 'Failed to complete session');
    } finally {
      pomodoroAccreditingRef.current = false;
    }
  };

  // SUBMIT CUSTOM WORKOUT LOG
  const handleLogCustomWorkout = async () => {
    if (!customExercise.trim()) return;
    try {
      const res = await saveWorkoutLog({
        ...buildCustomWorkoutLog({ workoutName: customExercise, sets, reps, weightKg: weight, difficulty }),
        routineId: `custom-${Date.now()}`,
      });
      setWorkoutLogs((prev) => [res.workout, ...prev.slice(0, 4)]);
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
      setNotice(`+40 XP AWARDED // DISCIPLINE INCREASED TO ${res.stats.discipline}`);
      setTimeout(() => setNotice(''), 4500);
    } catch (err: any) {
      setNotice(err.message || 'Discipline save failed');
      setTimeout(() => setNotice(''), 4000);
    }
  };

  return (
    <View style={themedStyles.root}>
      <SafeAreaView style={themedStyles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={themedStyles.content}>
          {/* Header */}
          <View style={themedStyles.header}>
            <Text style={themedStyles.systemTag}>ACTIVITY</Text>
            <Text style={themedStyles.pageTitle}>HUNTER ACTIVITY</Text>
          </View>

          {/* Module Selector Tabs */}
          <View style={themedStyles.tabsRow}>
            {[
              { id: 'workout', label: 'Workout', icon: '⚔️' },
              { id: 'nutrition', label: 'Nutri', icon: '🥗' },
              { id: 'home', label: 'Home', icon: '⌂' },
              { id: 'pomo', label: 'Pomo', icon: '⏱️' },
              { id: 'ascend', label: 'Ascend', icon: '⛰️' },
            ].map((tab) => (
              <Pressable
                key={tab.id}
                style={[themedStyles.toolTab, activeTool === tab.id && themedStyles.toolTabActive]}
                onPress={() => setActiveTool(tab.id as typeof activeTool)}
              >
                <Text
                  style={[
                    themedStyles.toolTabIcon,
                    tab.id === 'home' && {
                      color: activeTool === tab.id ? theme.accent : theme.textSecondary,
                      textShadowColor: activeTool === tab.id ? theme.accent : 'transparent',
                      textShadowRadius: activeTool === tab.id ? 8 : 0,
                    },
                  ]}
                >
                  {tab.icon}
                </Text>
                <Text style={[themedStyles.toolTabLabel, activeTool === tab.id && themedStyles.toolTabLabelActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {notice ? (
            <View style={themedStyles.noticeBox}>
              <Text style={themedStyles.noticeText}>⚡ {notice}</Text>
            </View>
          ) : null}

          {activeTool === 'home' && (
            <View style={themedStyles.homeSection}>
              <View style={[themedStyles.homeGrid, { maxWidth: homeGridMaxWidth }]}>
                <Pressable style={[themedStyles.homeCard, { width: homeCardWidth }]} onPress={() => setActiveTool('workout')}>
                  <ImageBackground source={require('../assets/images/tools/workout.png')} style={themedStyles.homeCardImage} imageStyle={themedStyles.homeCardImageStyle}>
                    <View style={themedStyles.homeCardShade} />
                    <View style={themedStyles.homeCardCopy}>
                      <Text style={[themedStyles.homeCardEyebrow, { color: '#7edce4' }]}>STRENGTH // RAID</Text>
                      <Text style={[themedStyles.homeCardTitle, { color: '#ffffff' }]}>Workout</Text>
                    </View>
                  </ImageBackground>
                </Pressable>
                <Pressable style={[themedStyles.homeCard, { width: homeCardWidth }]} onPress={() => setActiveTool('pomo')}>
                  <ImageBackground source={require('../assets/images/tools/pomodoro.png')} style={themedStyles.homeCardImage} imageStyle={themedStyles.homeCardImageStyle}>
                    <View style={themedStyles.homeCardShade} />
                    <View style={themedStyles.homeCardCopy}>
                      <Text style={[themedStyles.homeCardEyebrow, { color: '#7edce4' }]}>FOCUS // PROTOCOL</Text>
                      <Text style={[themedStyles.homeCardTitle, { color: '#ffffff' }]}>Pomodoro</Text>
                    </View>
                  </ImageBackground>
                </Pressable>
                <Pressable style={[themedStyles.homeCard, { width: homeCardWidth }]} onPress={() => setActiveTool('nutrition')}>
                  <ImageBackground source={require('../assets/images/tools/nutrition.png')} style={themedStyles.homeCardImage} imageStyle={themedStyles.homeCardImageStyle}>
                    <View style={themedStyles.homeCardShade} />
                    <View style={themedStyles.homeCardCopy}>
                      <Text style={[themedStyles.homeCardEyebrow, { color: '#7edce4' }]}>RECOVERY // FUEL</Text>
                      <Text style={[themedStyles.homeCardTitle, { color: '#ffffff' }]}>Nutrition</Text>
                    </View>
                  </ImageBackground>
                </Pressable>
                <Pressable style={[themedStyles.homeCard, { width: homeCardWidth }]} onPress={() => setActiveTool('ascend')}>
                  <ImageBackground source={require('../assets/images/tools/ascend.png')} style={themedStyles.homeCardImage} imageStyle={themedStyles.homeCardImageStyle}>
                    <View style={themedStyles.homeCardShade} />
                    <View style={themedStyles.homeCardCopy}>
                      <Text style={[themedStyles.homeCardEyebrow, { color: '#7edce4' }]}>JOURNAL // DISCIPLINE</Text>
                      <Text style={[themedStyles.homeCardTitle, { color: '#ffffff' }]}>Ascend</Text>
                    </View>
                  </ImageBackground>
                </Pressable>
              </View>

              <View style={themedStyles.searchSection}>
                <View style={themedStyles.searchBar}>
                  <Text style={themedStyles.searchIcon}>⌕</Text>
                  <TextInput
                    value={chatSearchDraft}
                    onChangeText={setChatDraft}
                    onSubmitEditing={submitSearch}
                    placeholder="Ask anything or search…"
                    placeholderTextColor={theme.textSecondary}
                    style={themedStyles.searchInput}
                    maxLength={2000}
                    returnKeyType="search"
                    accessibilityLabel="Ask Hunter AI or search"
                  />
                  <Pressable
                    style={[themedStyles.searchAction, !chatSearchDraft.trim() && themedStyles.searchActionDisabled]}
                    onPress={submitSearch}
                    disabled={!chatSearchDraft.trim() || chatOpenedRef.current}
                    accessibilityRole="button"
                    accessibilityLabel="Send question to Hunter AI"
                  >
                    <Text style={themedStyles.searchActionText}>➤</Text>
                  </Pressable>
                </View>
                <Text style={themedStyles.searchHint}>Quests, workouts, nutrition, study plans…</Text>
                <View style={themedStyles.searchDivider} />
              </View>
            </View>
          )}

          {/* ========================================================= */}
          {/* 1. WORKOUT MODULE */}
          {/* ========================================================= */}
          {activeTool === 'workout' && (
            <View style={themedStyles.moduleSection}>
              <WorkoutScreen embedded onWorkoutCompleted={() => { void getWorkoutLogs().then((logs) => setWorkoutLogs(logs.slice(0, 5))); }} />

              {/* Recent Workout Logs */}
              {workoutLogs.length > 0 && (
                <View style={themedStyles.card}>
                  <Text style={themedStyles.cardTitle}>RECENT WORKOUT RECORDS</Text>
                  <View style={themedStyles.recentLogsList}>
                    {workoutLogs.map((log) => (
                      <View key={log._id} style={themedStyles.recentLogItem}>
                        <View>
                          <Text style={themedStyles.recentLogTitle}>{log.workoutName}</Text>
                          <Text style={themedStyles.recentLogSub}>
                            {log.exercisesCompleted} Movements · {Math.round(log.durationSeconds / 60)} min
                            {log.sets != null && log.reps != null && log.weightKg != null
                              ? ` · ${log.sets}×${log.reps} @ ${log.weightKg} kg`
                              : ''}
                          </Text>
                        </View>
                        <Text style={themedStyles.recentLogXp}>{log.xpEarned == null ? 'XP unknown' : `+${log.xpEarned} XP`}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Custom Lifting Log Card */}
              <View style={themedStyles.card}>
                <Text style={themedStyles.cardTitle}>CUSTOM TRAINING LOG</Text>
                <Text style={themedStyles.cardSub}>
                  Record sets, reps, and weights from an off-system training session.
                </Text>

                <Text style={themedStyles.inputLabel}>EXERCISE NAME</Text>
                <TextInput
                  value={customExercise}
                  onChangeText={setCustomExercise}
                  placeholder="e.g. Incline Dumbbell Press"
                  placeholderTextColor={theme.textSecondary}
                  style={themedStyles.inputField}
                />

                <View style={themedStyles.threeColRow}>
                  <View style={themedStyles.col}>
                    <Text style={themedStyles.inputLabel}>SETS</Text>
                    <TextInput
                      value={sets}
                      onChangeText={setSets}
                      keyboardType="number-pad"
                      style={themedStyles.inputField}
                    />
                  </View>
                  <View style={themedStyles.col}>
                    <Text style={themedStyles.inputLabel}>REPS</Text>
                    <TextInput
                      value={reps}
                      onChangeText={setReps}
                      keyboardType="number-pad"
                      style={themedStyles.inputField}
                    />
                  </View>
                  <View style={themedStyles.col}>
                    <Text style={themedStyles.inputLabel}>KG</Text>
                    <TextInput
                      value={weight}
                      onChangeText={setWeight}
                      keyboardType="number-pad"
                      style={themedStyles.inputField}
                    />
                  </View>
                </View>

                <Pressable style={themedStyles.secondaryActionBtn} onPress={handleLogCustomWorkout}>
                  <Text style={themedStyles.secondaryActionBtnText}>RECORD SET & GAIN XP (+50 XP)</Text>
                </Pressable>
              </View>

            </View>
          )}

          {activeTool === 'nutrition' && <NutritionContent embedded />}

          {/* ========================================================= */}
          {/* 2. POMODORO / STUDY MODULE */}
          {/* ========================================================= */}
          {activeTool === 'pomo' && (
            <View style={themedStyles.moduleSection}>
              <View style={themedStyles.card}>
                <Text style={themedStyles.cardTitle}>POMO</Text>
                <Text style={themedStyles.cardSub}>
                  Lock in with zero distraction. The system awards Knowledge & Discipline XP upon completion.
                </Text>

                {/* Mode Selector */}
                <View style={themedStyles.pomodoroModesRow}>
                  {([25, 50, 90] as const).map((m) => (
                    <Pressable
                      key={m}
                      style={[themedStyles.pomoModeChip, studyMode === m && themedStyles.pomoModeChipActive]}
                      onPress={() => changeStudyMode(m)}
                    >
                      <Text style={[themedStyles.pomoModeText, studyMode === m && themedStyles.pomoModeTextActive]}>
                        {m} MIN {m === 25 ? '(SPRINT)' : m === 50 ? '(DEEP)' : '(HYPER)'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Timer Display */}
                <View style={themedStyles.timerDisplayContainer}>
                  <Text style={themedStyles.timerLargeText}>{formatTimer(secondsRemaining)}</Text>
                  <Text style={themedStyles.timerStateText}>
                    {timerRunning ? '⚡ DEEP FOCUS ACTIVE' : '❚❚ FOCUS STANDBY'}
                  </Text>
                </View>

                {/* Study Topic Input */}
                <Text style={themedStyles.inputLabel}>STUDY DOMAIN / CORE TOPIC</Text>
                <TextInput
                  value={studyTopic}
                  onChangeText={setStudyTopic}
                  placeholder="e.g. Distributed Consensus, System Design"
                  placeholderTextColor={theme.textSecondary}
                  style={themedStyles.inputField}
                />

                {/* Timer Controls */}
                <View style={themedStyles.timerControlsRow}>
                  <Pressable
                    style={[themedStyles.timerControlBtn, timerRunning ? themedStyles.pauseBtn : themedStyles.startBtn]}
                    onPress={toggleTimer}
                  >
                    <Text style={themedStyles.timerControlBtnText}>
                      {timerRunning ? '❚❚ PAUSE SESSION' : '▶ START SESSION'}
                    </Text>
                  </Pressable>
                  <Pressable style={themedStyles.resetBtn} onPress={resetTimer}>
                    <Text style={themedStyles.resetBtnText}>↺ RESET</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={[themedStyles.finishEarlyBtn, !studySessionComplete && { opacity: 0.45 }]}
                  disabled={!studySessionComplete || studySessionRewarded}
                  onPress={() => setShowStudySummaryModal(true)}
                >
                  <Text style={themedStyles.finishEarlyBtnText}>{studySessionRewarded ? 'SESSION REWARDED' : studySessionComplete ? 'VERIFY & FINISH BLOCK ➔' : 'FINISH BLOCK WHEN TIMER ENDS'}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ========================================================= */}
          {/* 3. JOURNAL MODULE */}
          {/* ========================================================= */}
          {activeTool === 'ascend' && (
            <View style={themedStyles.ascendSectionTabs} accessibilityRole="tablist">
              {([
                { id: 'journal', label: 'Journal' },
                { id: 'discipline', label: 'Discipline' },
              ] as const).map((section) => {
                const selected = ascendSection === section.id;
                return (
                  <Pressable
                    key={section.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    style={[
                      themedStyles.ascendSectionTab,
                      {
                        backgroundColor: selected ? theme.accentDim : theme.surface,
                        borderColor: selected ? theme.accent : theme.border,
                      },
                    ]}
                    onPress={() => setAscendSection(section.id)}
                  >
                    <Text style={{ color: selected ? theme.accent : theme.textSecondary, fontSize: 11, fontWeight: '900' }}>
                      {section.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {activeTool === 'ascend' && ascendSection === 'journal' && (
            <View style={themedStyles.moduleSection}>
              <View style={themedStyles.card}>
                <Text style={themedStyles.cardTitle}>3-Prompt Journal</Text>
                <Text style={themedStyles.cardSub}>
                  Confront the shadow self. Daily reflection recalibrates neural focus and grants Mindfulness XP.
                </Text>

                <Text style={themedStyles.inputLabel}>1. WHAT WENT WELL TODAY? (VICTORY)</Text>
                <TextInput
                  value={wentWell}
                  onChangeText={setWentWell}
                  placeholder="e.g. Crushed morning workout and completed 2 coding modules"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  style={themedStyles.textAreaField}
                />

                <Text style={themedStyles.inputLabel}>2. WHAT HELD YOU BACK? (FRICTION / WEAKNESS)</Text>
                <TextInput
                  value={heldBack}
                  onChangeText={setHeldBack}
                  placeholder="e.g. Scrolled on phone for 20 mins after lunch"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  style={themedStyles.textAreaField}
                />

                <Text style={themedStyles.inputLabel}>3. TOMORROW&apos;S PRIME DIRECTIVE</Text>
                <TextInput
                  value={improveTomorrow}
                  onChangeText={setImproveTomorrow}
                  placeholder="e.g. No phone before 9am, lock in on DSA mock test"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  style={themedStyles.textAreaField}
                />

                <View style={themedStyles.sliderRow}>
                  <View style={themedStyles.col}>
                    <Text style={themedStyles.inputLabel}>MOOD: {mood}/10</Text>
                    <View style={themedStyles.scorePills}>
                      {[4, 6, 8, 10].map((v) => (
                        <Pressable
                          key={v}
                          style={[themedStyles.scorePill, mood === v && themedStyles.scorePillActive]}
                          onPress={() => setMood(v)}
                        >
                          <Text style={[themedStyles.scorePillText, mood === v && themedStyles.scorePillTextActive]}>
                            {v}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={themedStyles.col}>
                    <Text style={themedStyles.inputLabel}>ENERGY: {energy}/10</Text>
                    <View style={themedStyles.scorePills}>
                      {[4, 6, 8, 10].map((v) => (
                        <Pressable
                          key={v}
                          style={[themedStyles.scorePill, energy === v && themedStyles.scorePillActive]}
                          onPress={() => setEnergy(v)}
                        >
                          <Text style={[themedStyles.scorePillText, energy === v && themedStyles.scorePillTextActive]}>
                            {v}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>

                <Pressable style={themedStyles.primaryActionBtn} onPress={handleLogJournal}>
                  <Text style={themedStyles.primaryActionBtnText}>SAVE REFLECTION & CLAIM XP (+35 XP)</Text>
                </Pressable>
              </View>

              {journalLogs.length > 0 && (
                <View style={themedStyles.card}>
                  <Text style={themedStyles.cardTitle}>RECENT REFLECTIONS</Text>
                  {journalLogs.map((j) => (
                    <View key={j._id} style={themedStyles.recentJournalItem}>
                      <Text style={themedStyles.recentJournalDate}>
                        {new Date(j.createdAt).toLocaleDateString()} · Mood {j.moodRating}/10
                      </Text>
                      <Text style={themedStyles.recentJournalText}>“{j.wentWell}”</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ========================================================= */}
          {/* 4. DISCIPLINE / SCREEN TIME MODULE */}
          {/* ========================================================= */}
          {activeTool === 'ascend' && ascendSection === 'discipline' && (
            <View style={themedStyles.moduleSection}>
              <View style={themedStyles.card}>
                <Text style={themedStyles.cardTitle}>DISCIPLINE DEFENSE // SCREEN TIME MATRIX</Text>
                <Text style={themedStyles.cardSub}>
                  Measure intentional focus versus algorithmic capture. Overcome the doom scroll.
                </Text>
                <Text style={themedStyles.developmentNote}>
                  Manual estimates only — HunterOS does not read device screen-time or unlock data.
                </Text>

                {/* Metrics Readout */}
                <View style={themedStyles.screenMetricsRow}>
                  <View style={themedStyles.screenMetricBox}>
                    <Text style={themedStyles.screenMetricLabel}>DEVICE UNLOCKS</Text>
                    <Text style={themedStyles.screenMetricVal}>{screenData.unlocks}</Text>
                  </View>
                  <View style={themedStyles.screenMetricBox}>
                    <Text style={themedStyles.screenMetricLabel}>REELS / SHORTS</Text>
                    <Text style={[themedStyles.screenMetricVal, { color: screenData.reelsMinutes > 20 ? theme.error : theme.success }]}>
                      {screenData.reelsMinutes}m
                    </Text>
                  </View>
                  <View style={themedStyles.screenMetricBox}>
                    <Text style={themedStyles.screenMetricLabel}>PRODUCTIVE</Text>
                    <Text style={[themedStyles.screenMetricVal, { color: theme.accent }]}>
                      {screenData.productiveMinutes}m
                    </Text>
                  </View>
                </View>

                {/* Adjusters */}
                <Text style={themedStyles.inputLabel}>UPDATE SHORT-FORM CONSUMPTION (MINUTES)</Text>
                <View style={themedStyles.reelAdjustRow}>
                  <Pressable
                    style={themedStyles.adjustBtn}
                    onPress={() =>
                      setScreenData((prev) => ({
                        ...prev,
                        reelsMinutes: Math.max(0, prev.reelsMinutes - 5),
                      }))
                    }
                  >
                    <Text style={themedStyles.adjustBtnText}>−5m</Text>
                  </Pressable>
                  <Text style={themedStyles.largeReelDisplay}>{screenData.reelsMinutes} MIN</Text>
                  <Pressable
                    style={themedStyles.adjustBtn}
                    onPress={() =>
                      setScreenData((prev) => ({
                        ...prev,
                        reelsMinutes: prev.reelsMinutes + 5,
                      }))
                    }
                  >
                    <Text style={themedStyles.adjustBtnText}>+5m</Text>
                  </Pressable>
                </View>

                <Pressable style={themedStyles.primaryActionBtn} onPress={handleLogScreenVictory}>
                  <Text style={themedStyles.primaryActionBtnText}>LOG DISCIPLINE CHECKPOINT (+40 XP)</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Pomodoro Completion Modal */}
        <Modal visible={showStudySummaryModal} transparent animationType="fade">
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.summaryModalCard}>
              <Text style={themedStyles.summaryModalTag}>POMO COMPLETE</Text>
              <Text style={themedStyles.summaryModalTitle}>DEEP FOCUS REWARD</Text>
              <Text style={themedStyles.summaryModalDesc}>
                Session successfully logged for “{studyTopic}”. Ready to accredit Knowledge XP to your hunter dossier.
              </Text>

              <View style={themedStyles.summaryModalStats}>
                <Text style={themedStyles.summaryModalStatsText}>
                  +{studyMode >= 50 ? 80 : 50} XP · +4 KNOWLEDGE · +2 DISCIPLINE
                </Text>
              </View>

              <View style={themedStyles.modalBtns}>
                <Pressable
                  style={themedStyles.cancelBtn}
                  onPress={() => setShowStudySummaryModal(false)}
                >
                  <Text style={themedStyles.cancelBtnText}>DISMISS</Text>
                </Pressable>
                <Pressable
                  style={themedStyles.confirmBtn}
                  onPress={handleCompletePomodoro}
                  disabled={!studySessionComplete || studySessionRewarded}
                >
                  <Text style={themedStyles.confirmBtnText}>ACCREDIT XP ➔</Text>
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
  searchSection: {
    marginTop: 18,
    marginBottom: 14,
  },
  searchBar: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#081727',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1b3b58',
    paddingLeft: 14,
    paddingRight: 7,
    shadowColor: '#00d9e8',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  searchIcon: {
    color: '#00dce8',
    fontSize: 27,
    lineHeight: 30,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#e3f1fc',
    fontSize: 15,
    paddingVertical: 12,
    outlineStyle: 'none',
  } as any,
  searchAction: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#00dce8',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  searchActionDisabled: {
    opacity: 0.35,
  },
  searchActionText: {
    color: '#03111b',
    fontSize: 18,
    fontWeight: '900',
  },
  searchHint: {
    color: '#526b82',
    fontSize: 10,
    letterSpacing: 0.2,
    marginTop: 8,
    marginLeft: 12,
  },
  searchDivider: {
    height: 1,
    marginTop: 13,
    backgroundColor: '#102438',
    opacity: 0.9,
  },
  homeSection: {
    gap: 2,
  },
  homeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: 1060,
    alignSelf: 'center',
    justifyContent: 'center',
    columnGap: 14,
    rowGap: 14,
  },
  homeCard: {
    width: 250,
    aspectRatio: 0.75,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#071626',
    borderWidth: 1,
    borderColor: '#1b3a52',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  homeCardImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  homeCardImageStyle: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
    resizeMode: 'cover',
  },
  homeCardShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 8, 14, 0.2)',
  },
  homeCardCopy: {
    backgroundColor: 'rgba(2, 8, 14, 0.7)',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 243, 255, 0.28)',
  },
  homeCardEyebrow: {
    color: '#7edce4',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginBottom: 3,
  },
  homeCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
  },
  developmentNote: {
    color: '#8093a5',
    fontSize: 10,
    lineHeight: 15,
    marginTop: -6,
    marginBottom: 12,
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
  ascendSectionTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  ascendSectionTab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
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
