import { useAppearance, useThemedStyles } from '../lib/AppearanceContext';
import React, { useEffect, useRef, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExerciseIllustration } from './ExerciseIllustration';
import {
  getHunterStats,
  getHunterProfile,
  getWorkoutLogs,
  recordWorkoutCompletion,
  saveDailyWorkoutPlan,
} from '../lib/hunterStorage';
import { Exercise, HunterProfile, HunterStats, WorkoutLog, WorkoutRoutine } from '../lib/hunterTypes';
import { getPersonalizedWorkout } from '../lib/workoutEngine';
import { generateAdjustedWorkoutPlan, getOrCreateDailyWorkoutPlan } from '../lib/dailyWorkout';
import { getLocalWorkoutDate, type WorkoutPlanAdjustment } from '../lib/workoutPlanUtils';
import { getWorkoutActivity } from '../lib/workoutActivity';

type WorkoutPhase = 'landing' | 'preparation' | 'active' | 'rest' | 'completed';

const adjustmentOptions: { key: keyof WorkoutPlanAdjustment; values: string[] }[] = [
  { key: 'difficulty', values: ['Beginner', 'Intermediate', 'Advanced'] },
  { key: 'targetFocus', values: ['Full Body', 'Upper Body', 'Lower Body', 'Core', 'Conditioning'] },
  { key: 'equipment', values: ['None (Bodyweight)', 'Dumbbells / Basic', 'Full Gym'] },
];

function WorkoutFlowScroller({
  embedded,
  contentContainerStyle,
  children,
}: {
  embedded: boolean;
  contentContainerStyle: object;
  children: React.ReactNode;
}) {
  return embedded ? (
    <View style={contentContainerStyle}>{children}</View>
  ) : (
    <ScrollView contentContainerStyle={contentContainerStyle} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

function WorkoutActivityWidget({ logs }: { logs: WorkoutLog[] }) {
  const themedStyles = useThemedStyles(styles);
  const activity = getWorkoutActivity(logs);
  return (
    <View style={themedStyles.streakCard}>
      <Text style={themedStyles.streakEyebrow}>WEEKLY ACTIVITY</Text>
      <Text style={themedStyles.streakCount}>🔥 {activity.streak}-day streak</Text>
      <Text style={themedStyles.streakCaption}>
        {activity.hasHistory ? 'Build consistency, one completed workout at a time.' : 'Your completed workouts will appear here.'}
      </Text>
      <View style={themedStyles.activityStrip}>
        {activity.activity.map((day) => (
          <View key={day.key} style={themedStyles.activityDay}>
            <Text style={[themedStyles.activityDayLabel, day.isToday && themedStyles.activityTodayLabel]}>{day.label}</Text>
            <View style={[themedStyles.activityDot, day.complete && themedStyles.activityDotComplete, day.isToday && !day.complete && themedStyles.activityDotToday]}>
              <Text style={[themedStyles.activityDotText, day.complete && themedStyles.activityDotTextComplete]}>{day.complete ? '✓' : day.isToday ? '•' : ''}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={themedStyles.activityFootnote}>Activity is counted from saved workout logs. Preparing a plan does not add a streak day.</Text>
    </View>
  );
}

type WorkoutScreenProps = { embedded?: boolean; children?: React.ReactNode };

export default function WorkoutScreen({ embedded = false, children }: WorkoutScreenProps) {
  const { theme } = useAppearance();
  const themedStyles = useThemedStyles(styles);
  const router = useRouter();
  const params = useLocalSearchParams<{ questId?: string; routineId?: string; workoutTitle?: string }>();

  const [profile, setProfile] = useState<HunterProfile | null>(null);
  const [stats, setStats] = useState<HunterStats | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [routine, setRoutine] = useState<WorkoutRoutine | null>(null);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isRestDay, setIsRestDay] = useState(false);
  const [planSource, setPlanSource] = useState<'ai' | 'fallback' | 'rest' | null>(null);
  const [planNotice, setPlanNotice] = useState('');
  const [phase, setPhase] = useState<WorkoutPhase>('landing');
  const [loadError, setLoadError] = useState('');
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState('');
  const [durationDraft, setDurationDraft] = useState('30');
  const [adjustment, setAdjustment] = useState<WorkoutPlanAdjustment>({
    durationMinutes: 30,
    difficulty: 'Beginner',
    targetFocus: 'Full Body',
    equipment: 'None (Bodyweight)',
  });

  // Active workout execution states
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [exerciseTimeRemaining, setExerciseTimeRemaining] = useState(30);
  const [restTimeRemaining, setRestTimeRemaining] = useState(30);
  const [repCount, setRepCount] = useState(12);

  // Metrics for completion
  const [totalSecondsElapsed, setTotalSecondsElapsed] = useState(0);
  const [completedExercisesCount, setCompletedExercisesCount] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const planAbortRef = useRef<AbortController | null>(null);
  const adjustAbortRef = useRef<AbortController | null>(null);

  // Completion summary data
  const [rewardSummary, setRewardSummary] = useState<{
    xpEarned: number;
    statRaised: string;
    statBonus: number;
  } | null>(null);

  // Load saved profile and completion history; generating a plan is an explicit action.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getHunterProfile();
      const stats = await getHunterStats();
      const logs = await getWorkoutLogs();
      if (cancelled) return;
      setProfile(p);
      setStats(stats);
      setWorkoutLogs(logs);
      if (params.routineId) {
        setRoutine(getPersonalizedWorkout(p, params.routineId));
        setPhase('preparation');
      }
    })().catch(() => {
      if (cancelled) return;
    }).finally(() => {
      if (!cancelled) setIsProfileLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [params.routineId]);

  const prepareTodayWorkout = async (forceRefresh = false) => {
    if (isPlanLoading || !stats) return;
    const controller = new AbortController();
    planAbortRef.current = controller;
    setIsPlanLoading(true);
    setLoadError('');
    if (!routine) setPlanNotice('');
    try {
      const dailyPlan = await getOrCreateDailyWorkoutPlan(profile, stats, new Date(), controller.signal, forceRefresh);
      setIsRestDay(dailyPlan.isRestDay);
      setPlanSource(dailyPlan.source);
      setRoutine(dailyPlan.routine);
      setPlanNotice(dailyPlan.message ?? (dailyPlan.source === 'ai' ? 'Personalized AI plan saved for today.' : ''));
      if (dailyPlan.isRestDay) setPhase('rest');
      else if (dailyPlan.routine) {
        setAdjustment((current) => ({
          ...current,
          durationMinutes: dailyPlan.routine!.durationMinutes,
          difficulty: dailyPlan.routine!.difficulty,
          equipment: dailyPlan.routine!.equipment,
        }));
        setPhase('preparation');
      }
    } catch (error) {
      setLoadError(controller.signal.aborted
        ? 'Workout request cancelled. You can try again when ready.'
        : error instanceof Error ? error.message : 'Could not prepare today’s workout. Check your connection and try again.');
    } finally {
      if (planAbortRef.current === controller) planAbortRef.current = null;
      setIsPlanLoading(false);
    }
  };

  const cancelPlanRequest = () => planAbortRef.current?.abort();

  const submitPlanAdjustment = async () => {
    if (!routine || !stats || isAdjusting) return;
    const controller = new AbortController();
    adjustAbortRef.current = controller;
    setIsAdjusting(true);
    setAdjustError('');
    try {
      const durationMinutes = Math.max(8, Math.min(75, Number.parseInt(durationDraft, 10) || adjustment.durationMinutes));
      const requestedAdjustment = { ...adjustment, durationMinutes };
      setAdjustment(requestedAdjustment);
      setDurationDraft(String(durationMinutes));
      const revisedRoutine = await generateAdjustedWorkoutPlan(profile, stats, requestedAdjustment, new Date(), controller.signal);
      await saveDailyWorkoutPlan({
        localDate: getLocalWorkoutDate(),
        restDay: profile?.restDay?.trim() ?? '',
        isRestDay: false,
        routine: revisedRoutine,
        source: 'ai',
        message: 'Adjusted AI plan saved for today.',
      });
      setRoutine(revisedRoutine);
      setPlanSource('ai');
      setPlanNotice('Adjusted AI plan saved for today. Review it before starting.');
      setAdjustModalVisible(false);
    } catch (error) {
      setAdjustError(controller.signal.aborted
        ? 'Adjustment cancelled. The current plan is unchanged.'
        : error instanceof Error ? error.message : 'Could not adjust this plan. The current plan is unchanged.');
    } finally {
      if (adjustAbortRef.current === controller) adjustAbortRef.current = null;
      setIsAdjusting(false);
    }
  };

  const cancelAdjustment = () => adjustAbortRef.current?.abort();

  // Overall workout stopwatch (runs during active and rest)
  useEffect(() => {
    if (phase === 'active' || phase === 'rest') {
      if (isPaused) return;
      const interval = setInterval(() => {
        setTotalSecondsElapsed((t) => t + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase, isPaused]);

  // Current exercise pointer
  const currentExercise: Exercise | undefined = routine?.exercises[currentIndex];
  const nextExercise: Exercise | undefined = routine?.exercises[currentIndex + 1];

  // Initialize timers when switching exercises
  const initExerciseState = (ex: Exercise) => {
    if (ex.type === 'timed') {
      setExerciseTimeRemaining(ex.durationSeconds || 35);
    } else {
      setRepCount(ex.targetReps || 12);
    }
  };

  // Timed exercise countdown
  useEffect(() => {
    if (phase === 'active' && currentExercise?.type === 'timed' && !isPaused) {
      if (exerciseTimeRemaining <= 0) {
        handleExerciseFinished();
        return;
      }
      const timer = setInterval(() => {
        setExerciseTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleExerciseFinished();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [phase, isPaused, exerciseTimeRemaining, currentExercise]);

  // Rest period countdown
  useEffect(() => {
    if (phase === 'rest' && !isPaused) {
      if (restTimeRemaining <= 0) {
        advanceToNextExercise();
        return;
      }
      const timer = setInterval(() => {
        setRestTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            advanceToNextExercise();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [phase, isPaused, restTimeRemaining]);

  const startWorkout = () => {
    if (!routine || routine.exercises.length === 0) return;
    setCurrentIndex(0);
    setCompletedExercisesCount(0);
    setTotalSecondsElapsed(0);
    initExerciseState(routine.exercises[0]);
    setPhase('active');
  };

  const handleExerciseFinished = () => {
    if (!routine) return;
    setCompletedExercisesCount((c) => c + 1);

    // If this was the last exercise, finish workout!
    if (currentIndex >= routine.exercises.length - 1) {
      finalizeWorkout();
      return;
    }

    // Otherwise, transition to rest
    const rest = currentExercise?.restSeconds || 25;
    if (rest > 0) {
      setRestTimeRemaining(rest);
      setPhase('rest');
    } else {
      advanceToNextExercise();
    }
  };

  const advanceToNextExercise = () => {
    if (!routine) return;
    const nextIdx = currentIndex + 1;
    if (nextIdx < routine.exercises.length) {
      setCurrentIndex(nextIdx);
      initExerciseState(routine.exercises[nextIdx]);
      setPhase('active');
    } else {
      finalizeWorkout();
    }
  };

  const skipCurrentExercise = () => {
    if (!routine) return;
    if (currentIndex >= routine.exercises.length - 1) {
      finalizeWorkout();
    } else {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      initExerciseState(routine.exercises[nextIdx]);
    }
  };

  const skipRest = () => {
    advanceToNextExercise();
  };

  const addRestTime = (seconds: number) => {
    setRestTimeRemaining((prev) => prev + seconds);
  };

  const finalizeWorkout = async () => {
    if (!routine || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await recordWorkoutCompletion({
        workoutName: routine.title,
        routineId: routine.id,
        questId: params.questId,
        exercisesCompleted: Math.max(1, completedExercisesCount + 1),
        totalExercises: routine.exercises.length,
        durationSeconds: Math.max(60, totalSecondsElapsed),
        difficulty: routine.difficulty,
        xpReward: routine.xpReward,
        statBonus: routine.statBonus,
      });

      setRewardSummary({
        xpEarned: routine.xpReward,
        statRaised: routine.targetStat.toUpperCase(),
        statBonus: routine.statBonus,
      });
      setPhase('completed');
    } catch (err: any) {
      Alert.alert('System Error', err.message || 'Failed to record workout');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmExit = () => {
    setShowExitModal(false);
    if (embedded) {
      setPhase('landing');
      setRoutine(null);
      setCurrentIndex(0);
      return;
    }
    router.back();
  };

  const returnAfterCompletion = async () => {
    if (embedded) {
      setWorkoutLogs(await getWorkoutLogs());
      setRoutine(null);
      setIsRestDay(false);
      setPhase('landing');
      return;
    }
    router.replace('/');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (isPlanLoading && !embedded) {
    return (
      <View style={themedStyles.centerRoot}>
        <Text style={themedStyles.loadingText}>PREPARING TODAY'S WORKOUT...</Text>
        <Pressable style={themedStyles.cancelRequestBtn} onPress={cancelPlanRequest}>
          <Text style={themedStyles.cancelRequestText}>CANCEL REQUEST</Text>
        </Pressable>
      </View>
    );
  }

  if (isRestDay) {
    return (
      <View style={[themedStyles.root, embedded && themedStyles.embeddedRoot]}>
        <SafeAreaView style={[themedStyles.safe, embedded && themedStyles.embeddedSafe]} edges={embedded ? [] : ['top', 'bottom']}>
          {!embedded ? (
            <View style={themedStyles.prepHeader}>
              <Pressable style={themedStyles.backButton} onPress={() => router.back()}>
                <Text style={themedStyles.backButtonText}>← BACK</Text>
              </Pressable>
              <View style={themedStyles.rankPill}>
                <Text style={themedStyles.rankPillText}>RECOVERY PROTOCOL</Text>
              </View>
            </View>
          ) : null}
          <WorkoutFlowScroller embedded={embedded} contentContainerStyle={themedStyles.landingContent}>
            <WorkoutActivityWidget logs={workoutLogs} />
            <View style={themedStyles.landingPlanCard}>
              <Text style={themedStyles.landingPlanTitle}>TODAY’S PROTOCOL</Text>
              <Text style={themedStyles.restDayTitle}>TODAY IS A REST DAY</Text>
              <Text style={themedStyles.restDayCopy}>{planNotice}</Text>
              <Text style={themedStyles.restDayCopy}>Recovery is part of the training plan. Your progress and stats are unchanged.</Text>
              <Pressable style={[themedStyles.startWorkoutBtn, themedStyles.disabledAction]} disabled>
                <Text style={themedStyles.startWorkoutBtnText}>REST DAY — NO PLAN TO PREPARE</Text>
              </Pressable>
            </View>
            {children}
          </WorkoutFlowScroller>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'landing') {
    return (
      <View style={[themedStyles.root, embedded && themedStyles.embeddedRoot]}>
        <SafeAreaView style={[themedStyles.safe, embedded && themedStyles.embeddedSafe]} edges={embedded ? [] : ['top', 'bottom']}>
          {!embedded ? (
            <View style={themedStyles.prepHeader}>
              <Pressable style={themedStyles.backButton} onPress={() => router.back()}>
                <Text style={themedStyles.backButtonText}>← BACK</Text>
              </Pressable>
              <View style={themedStyles.rankPill}><Text style={themedStyles.rankPillText}>DAILY TRAINING</Text></View>
            </View>
          ) : null}
          <WorkoutFlowScroller embedded={embedded} contentContainerStyle={themedStyles.landingContent}>
            <WorkoutActivityWidget logs={workoutLogs} />

            <View style={themedStyles.landingPlanCard}>
              <Text style={themedStyles.landingPlanTitle}>TODAY’S PROTOCOL</Text>
              <Text style={themedStyles.landingPlanCopy}>Your plan uses saved profile details, fitness level, goals, and recovery preferences when available.</Text>
              {loadError ? <Text style={themedStyles.planError}>{loadError}</Text> : null}
              {isProfileLoading ? <Text style={themedStyles.landingPlanCopy}>Loading your saved profile…</Text> : null}
              <Pressable
                style={[themedStyles.startWorkoutBtn, (isProfileLoading || isPlanLoading || !stats) && themedStyles.disabledAction]}
                onPress={() => prepareTodayWorkout()}
                disabled={isProfileLoading || isPlanLoading || !stats}
              >
                <Text style={themedStyles.startWorkoutBtnText}>{isPlanLoading ? 'PREPARING…' : "PREPARE TODAY'S WORKOUT"}</Text>
              </Pressable>
              {isPlanLoading ? (
                <Pressable style={themedStyles.cancelRequestBtn} onPress={cancelPlanRequest}>
                  <Text style={themedStyles.cancelRequestText}>CANCEL REQUEST</Text>
                </Pressable>
              ) : null}
            </View>
            {children}
          </WorkoutFlowScroller>
        </SafeAreaView>
      </View>
    );
  }

  if (!routine) {
    return (
      <View style={themedStyles.centerRoot}>
        <Text style={themedStyles.loadingText}>WORKOUT PLAN UNAVAILABLE. PLEASE RETURN AND TRY AGAIN.</Text>
      </View>
    );
  }

  // ==========================================
  // PHASE 1: PREPARATION SCREEN
  // ==========================================
  if (phase === 'preparation') {
    return (
      <View style={[themedStyles.root, embedded && themedStyles.embeddedRoot]}>
        <SafeAreaView style={[themedStyles.safe, embedded && themedStyles.embeddedSafe]} edges={embedded ? [] : ['top', 'bottom']}>
          {/* Top navigation header */}
          {!embedded ? (
            <View style={themedStyles.prepHeader}>
              <Pressable style={themedStyles.backButton} onPress={() => router.back()}>
                <Text style={themedStyles.backButtonText}>✕ ABORT</Text>
              </Pressable>
              <View style={themedStyles.rankPill}>
                <Text style={themedStyles.rankPillText}>{routine.codeName}</Text>
              </View>
            </View>
          ) : null}

          <WorkoutFlowScroller embedded={embedded} contentContainerStyle={themedStyles.prepContent}>
            <WorkoutActivityWidget logs={workoutLogs} />
            <View style={themedStyles.landingPlanCard}>
              <Text style={themedStyles.landingPlanTitle}>TODAY’S PROTOCOL</Text>
              {loadError ? <Text style={themedStyles.planError}>{loadError}</Text> : null}
              <Pressable
                style={[themedStyles.startWorkoutBtn, isPlanLoading && themedStyles.disabledAction]}
                onPress={() => prepareTodayWorkout()}
                disabled={isPlanLoading}
              >
                <Text style={themedStyles.startWorkoutBtnText}>{isPlanLoading ? 'PREPARING…' : "PREPARE TODAY'S WORKOUT"}</Text>
              </Pressable>
              {isPlanLoading ? <Pressable style={themedStyles.cancelRequestBtn} onPress={cancelPlanRequest}><Text style={themedStyles.cancelRequestText}>CANCEL REQUEST</Text></Pressable> : null}
              {planSource === 'fallback' && !isPlanLoading ? (
                <Pressable style={themedStyles.retryPlanBtn} onPress={() => prepareTodayWorkout(true)}>
                  <Text style={themedStyles.retryPlanText}>RETRY AI GENERATION</Text>
                </Pressable>
              ) : null}
            </View>
            {/* Mission Dossier Card */}
            <View style={themedStyles.missionCard}>
              <Text style={themedStyles.missionSysTag}>DUNGEON PROTOCOL // PHYSICAL ASCENSION</Text>
              <Text style={themedStyles.missionTitle}>{routine.title}</Text>
              <Text style={themedStyles.missionGoal}>{routine.goal}</Text>
              {planNotice ? <Text style={themedStyles.planNotice}>{planNotice}</Text> : null}

              {/* Metrics Badge Grid */}
              <View style={themedStyles.prepMetricsGrid}>
                <View style={themedStyles.prepMetricBox}>
                  <Text style={themedStyles.prepMetricLabel}>EST. TIME</Text>
                  <Text style={themedStyles.prepMetricVal}>{routine.durationMinutes} MIN</Text>
                </View>
                <View style={themedStyles.prepMetricBox}>
                  <Text style={themedStyles.prepMetricLabel}>EXERCISES</Text>
                  <Text style={themedStyles.prepMetricVal}>{routine.exercises.length}</Text>
                </View>
                <View style={themedStyles.prepMetricBox}>
                  <Text style={themedStyles.prepMetricLabel}>EQUIPMENT</Text>
                  <Text style={themedStyles.prepMetricValSmall}>{routine.equipment}</Text>
                </View>
                <View style={themedStyles.prepMetricBox}>
                  <Text style={themedStyles.prepMetricLabel}>DIFFICULTY</Text>
                  <Text style={[themedStyles.prepMetricVal, { color: theme.error }]}> 
                    {routine.difficulty.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Reward preview */}
              <View style={themedStyles.rewardPreviewRow}>
                <View style={themedStyles.rewardChip}>
                  <Text style={themedStyles.rewardChipText}>⚡ +{routine.xpReward} XP</Text>
                </View>
                <View style={[themedStyles.rewardChip, { borderColor: theme.error }]}>
                  <Text style={[themedStyles.rewardChipText, { color: theme.error }]}> 
                    ⚔️ +{routine.statBonus} {routine.targetStat.toUpperCase()}
                  </Text>
                </View>
                <View style={[themedStyles.rewardChip, { borderColor: theme.success }]}>
                  <Text style={[themedStyles.rewardChipText, { color: theme.success }]}>💧 +2 HEALTH</Text>
                </View>
              </View>
            </View>

            {/* Exercise Sequence List */}
            <View style={themedStyles.sequenceHeader}>
              <Text style={themedStyles.sequenceTitle}>ORDER OF BATTLE ({routine.exercises.length} MOVEMENTS)</Text>
              <Text style={themedStyles.sequenceSub}>Sequential progression to muscular failure</Text>
            </View>

            <View style={themedStyles.exerciseSequenceList}>
              {routine.exercises.map((ex, idx) => (
                <View key={ex.id} style={themedStyles.exerciseSequenceItem}>
                  <View style={themedStyles.exSeqNumber}>
                    <Text style={themedStyles.exSeqNumberText}>0{idx + 1}</Text>
                  </View>
                  <View style={themedStyles.exSeqInfo}>
                    <Text style={themedStyles.exSeqName}>{ex.name}</Text>
                    <Text style={themedStyles.exSeqTarget}>
                      {ex.type === 'timed' ? `⏱️ ${ex.durationSeconds}s Duration` : `⚔️ ${ex.targetReps} Repetitions`}
                      {' · '}Rest: {ex.restSeconds}s
                    </Text>
                    <View style={themedStyles.tagRow}>
                      {ex.targetMuscles.map((m) => (
                        <View key={m} style={themedStyles.muscleTag}>
                          <Text style={themedStyles.muscleTagText}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
            </View>
            {children}
          </WorkoutFlowScroller>

          {/* Fixed Bottom Action CTA */}
          <View style={[themedStyles.bottomCtaBar, embedded && themedStyles.embeddedBottomCtaBar]}>
            <Pressable style={themedStyles.adjustPlanBtn} onPress={() => { setAdjustError(''); setDurationDraft(String(adjustment.durationMinutes)); setAdjustModalVisible(true); }}>
              <Text style={themedStyles.adjustPlanBtnText}>ADJUST PLAN</Text>
            </Pressable>
            <Pressable style={[themedStyles.startWorkoutBtn, themedStyles.startWorkoutFlex]} onPress={startWorkout}>
              <Text style={themedStyles.startWorkoutBtnText}>START WORKOUT RAID ➔</Text>
            </Pressable>
          </View>

          <Modal visible={adjustModalVisible} transparent animationType="fade" onRequestClose={() => setAdjustModalVisible(false)}>
            <View style={themedStyles.modalBackdrop}>
              <ScrollView contentContainerStyle={themedStyles.adjustModalScroll} keyboardShouldPersistTaps="handled">
                <View style={themedStyles.adjustModalCard}>
                  <Text style={themedStyles.adjustModalTitle}>ADJUST TODAY’S PLAN</Text>
                  <Text style={themedStyles.adjustModalCopy}>A revised recommendation will replace today’s saved plan only after it validates successfully.</Text>
                  <Text style={themedStyles.adjustLabel}>DURATION (MINUTES)</Text>
                  <TextInput
                    value={durationDraft}
                    onChangeText={setDurationDraft}
                    onEndEditing={() => {
                      const value = Math.max(8, Math.min(75, Number.parseInt(durationDraft, 10) || adjustment.durationMinutes));
                      setAdjustment((current) => ({ ...current, durationMinutes: value }));
                      setDurationDraft(String(value));
                    }}
                    keyboardType="number-pad"
                    style={themedStyles.adjustDurationInput}
                    accessibilityLabel="Workout duration in minutes"
                  />
                  {adjustmentOptions.map(({ key, values }) => (
                    <View key={key} style={themedStyles.adjustOptionGroup}>
                      <Text style={themedStyles.adjustLabel}>{key === 'targetFocus' ? 'TARGET FOCUS' : key === 'equipment' ? 'AVAILABLE EQUIPMENT' : 'DIFFICULTY'}</Text>
                      <View style={themedStyles.adjustChoiceRow}>
                        {values.map((value) => (
                          <Pressable
                            key={value}
                            style={[themedStyles.adjustChoice, adjustment[key] === value && themedStyles.adjustChoiceActive]}
                            onPress={() => setAdjustment((current) => ({ ...current, [key]: value } as WorkoutPlanAdjustment))}
                          >
                            <Text style={[themedStyles.adjustChoiceText, adjustment[key] === value && themedStyles.adjustChoiceTextActive]}>{value}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                  {adjustError ? <Text style={themedStyles.planError}>{adjustError}</Text> : null}
                  <Pressable style={[themedStyles.startWorkoutBtn, isAdjusting && themedStyles.disabledAction]} onPress={submitPlanAdjustment} disabled={isAdjusting}>
                    <Text style={themedStyles.startWorkoutBtnText}>{isAdjusting ? 'GENERATING…' : 'GENERATE REVISED PLAN'}</Text>
                  </Pressable>
                  {isAdjusting ? (
                    <Pressable style={themedStyles.cancelAdjustBtn} onPress={cancelAdjustment}>
                      <Text style={themedStyles.cancelAdjustText}>CANCEL GENERATION</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={themedStyles.cancelAdjustBtn} onPress={() => setAdjustModalVisible(false)}>
                      <Text style={themedStyles.cancelAdjustText}>KEEP CURRENT PLAN</Text>
                    </Pressable>
                  )}
                </View>
              </ScrollView>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    );
  }

  // ==========================================
  // PHASE 2: REST TRANSITION SCREEN
  // ==========================================
  if (phase === 'rest') {
    return (
      <View style={[themedStyles.root, embedded && themedStyles.embeddedRoot]}>
        <SafeAreaView style={[themedStyles.safe, embedded && themedStyles.embeddedSafe]} edges={embedded ? [] : ['top', 'bottom']}>
          <View style={themedStyles.restCardContainer}>
            <View style={themedStyles.restBadge}>
              <Text style={themedStyles.restBadgeText}>SYSTEM // CELLULAR REHYDRATION</Text>
            </View>

            <Text style={themedStyles.restHeaderTitle}>REST & RECOVER</Text>
            <Text style={themedStyles.restSub}>Deep diaphragmatic breathing to clear lactic acid</Text>

            <ExerciseIllustration type="rest" size={180} isActive={true} />

            {/* Big Countdown Number */}
            <View style={themedStyles.restTimerCircle}>
              <Text style={themedStyles.restTimerNumber}>{restTimeRemaining}</Text>
              <Text style={themedStyles.restTimerUnit}>SECONDS</Text>
            </View>

            {/* Next Movement Preview */}
            {nextExercise && (
              <View style={themedStyles.nextPreviewBox}>
                <Text style={themedStyles.nextPreviewTag}>UP NEXT</Text>
                <Text style={themedStyles.nextPreviewName}>{nextExercise.name}</Text>
                <Text style={themedStyles.nextPreviewTarget}>
                  {nextExercise.type === 'timed'
                    ? `${nextExercise.durationSeconds}s Timed Hold`
                    : `${nextExercise.targetReps} Reps`}
                </Text>
              </View>
            )}

            {/* Rest control buttons */}
            <View style={themedStyles.restButtonsRow}>
              <Pressable style={themedStyles.addTimeBtn} onPress={() => addRestTime(15)}>
                <Text style={themedStyles.addTimeBtnText}>+15 SEC REST</Text>
              </Pressable>
              <Pressable style={themedStyles.skipRestBtn} onPress={skipRest}>
                <Text style={themedStyles.skipRestBtnText}>SKIP REST ➔</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ==========================================
  // PHASE 3: ACTIVE WORKOUT EXECUTION
  // ==========================================
  if (phase === 'active' && currentExercise) {
    const isTimed = currentExercise.type === 'timed';
    const totalExercises = routine.exercises.length;
    const progressPercent = Math.round(((currentIndex + 1) / totalExercises) * 100);

    return (
      <View style={[themedStyles.root, embedded && themedStyles.embeddedRoot]}>
        <SafeAreaView style={[themedStyles.safe, embedded && themedStyles.embeddedSafe]} edges={embedded ? [] : ['top', 'bottom']}>
          {/* Top Active Bar */}
          <View style={themedStyles.activeTopBar}>
            <Pressable style={themedStyles.exitIconBtn} onPress={() => setShowExitModal(true)}>
              <Text style={themedStyles.exitIconText}>✕</Text>
            </Pressable>

            <View style={themedStyles.exerciseCounter}>
              <Text style={themedStyles.counterText}>
                EXERCISE {currentIndex + 1} OF {totalExercises}
              </Text>
              <Text style={themedStyles.stopwatchText}>⏱ {formatTime(totalSecondsElapsed)}</Text>
            </View>

            <Pressable
              style={themedStyles.pauseToggleBtn}
              onPress={() => setIsPaused((prev) => !prev)}
            >
              <Text style={themedStyles.pauseToggleText}>{isPaused ? '▶ RESUME' : '❚❚ PAUSE'}</Text>
            </Pressable>
          </View>

          {/* Segmented Progress Bar */}
          <View style={themedStyles.segmentedProgressBar}>
            {routine.exercises.map((_, i) => (
              <View
                key={i}
                style={[
                  themedStyles.segment,
                  i <= currentIndex ? themedStyles.segmentFilled : themedStyles.segmentEmpty,
                ]}
              />
            ))}
          </View>

          {isPaused && (
            <View style={themedStyles.pausedBanner}>
              <Text style={themedStyles.pausedBannerText}>❚❚ SYSTEM PAUSED — TAP RESUME TO CONTINUE</Text>
            </View>
          )}

          <ScrollView contentContainerStyle={themedStyles.activeScroll} showsVerticalScrollIndicator={false}>
            {/* Exercise Movement Graphic */}
            <View style={themedStyles.illustrationWrapper}>
              <ExerciseIllustration
                type={currentExercise.illustrationKey}
                size={230}
                isActive={!isPaused}
              />
            </View>

            {/* Exercise Name and Instruction */}
            <View style={themedStyles.exerciseInfoCard}>
              <Text style={themedStyles.exerciseTitle}>{currentExercise.name}</Text>
              <Text style={themedStyles.exerciseTip}>{currentExercise.tips}</Text>

              {/* Muscles Activated */}
              <View style={themedStyles.activeMusclesRow}>
                {currentExercise.targetMuscles.map((m) => (
                  <View key={m} style={themedStyles.activeMuscleTag}>
                    <Text style={themedStyles.activeMuscleTagText}>⚔️ {m}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Exercise Interaction Control Center */}
            <View style={themedStyles.actionCenter}>
              {isTimed ? (
                <View style={themedStyles.timerCenter}>
                  <Text style={themedStyles.largeTimerVal}>{exerciseTimeRemaining}</Text>
                  <Text style={themedStyles.largeTimerUnit}>SECONDS REMAINING</Text>
                  <View style={themedStyles.timerQuickRow}>
                    <Pressable
                      style={themedStyles.quickAddBtn}
                      onPress={() => setExerciseTimeRemaining((t) => t + 10)}
                    >
                      <Text style={themedStyles.quickAddBtnText}>+10s</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={themedStyles.repCenter}>
                  <Text style={themedStyles.repTargetLabel}>TARGET REPETITIONS</Text>
                  <View style={themedStyles.repControlRow}>
                    <Pressable
                      style={themedStyles.repAdjBtn}
                      onPress={() => setRepCount((r) => Math.max(1, r - 1))}
                    >
                      <Text style={themedStyles.repAdjBtnText}>−</Text>
                    </Pressable>
                    <Text style={themedStyles.largeRepVal}>{repCount}</Text>
                    <Pressable
                      style={themedStyles.repAdjBtn}
                      onPress={() => setRepCount((r) => r + 1)}
                    >
                      <Text style={themedStyles.repAdjBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Bottom Action Controls */}
          <View style={themedStyles.activeBottomBar}>
            <Pressable style={themedStyles.skipExerciseBtn} onPress={skipCurrentExercise}>
              <Text style={themedStyles.skipExerciseBtnText}>SKIP ➔</Text>
            </Pressable>
            <Pressable style={themedStyles.completeSetBtn} onPress={handleExerciseFinished}>
              <Text style={themedStyles.completeSetBtnText}>
                {isTimed ? 'FINISH EARLY ➔' : 'COMPLETE SET ➔'}
              </Text>
            </Pressable>
          </View>

          {/* Safe Exit Confirmation Modal */}
          <Modal visible={showExitModal} transparent animationType="fade">
            <View style={themedStyles.modalBackdrop}>
              <View style={themedStyles.exitCard}>
                <Text style={themedStyles.exitAlertTitle}>ABANDON DUNGEON RAID?</Text>
                <Text style={themedStyles.exitAlertDesc}>
                  Your active streak and exercise progression in this session will not be saved.
                </Text>

                <View style={themedStyles.exitActions}>
                  <Pressable
                    style={themedStyles.resumeDungeonBtn}
                    onPress={() => setShowExitModal(false)}
                  >
                    <Text style={themedStyles.resumeDungeonBtnText}>RESUME WORKOUT</Text>
                  </Pressable>
                  <Pressable style={themedStyles.abandonBtn} onPress={confirmExit}>
                    <Text style={themedStyles.abandonBtnText}>ABANDON MISSION</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    );
  }

  // ==========================================
  // PHASE 4: COMPLETION VICTORY SCREEN
  // ==========================================
  return (
    <View style={[themedStyles.root, embedded && themedStyles.embeddedRoot]}>
      <SafeAreaView style={[themedStyles.safe, embedded && themedStyles.embeddedSafe]} edges={embedded ? [] : ['top', 'bottom']}>
        <View style={themedStyles.completedContainer}>
          {/* Victory Header */}
          <View style={themedStyles.victoryHeader}>
            <View style={themedStyles.clearBadge}>
              <Text style={themedStyles.clearBadgeText}>GATE CONQUERED</Text>
            </View>
            <Text style={themedStyles.victoryTitle}>DUNGEON CLEARED!</Text>
            <Text style={themedStyles.victorySub}>
              Physical limits shattered. System has recorded your biometric exertion.
            </Text>
          </View>

          {/* Stats Rewards Card */}
          <View style={themedStyles.victoryRewardCard}>
            <Text style={themedStyles.rewardCardHeader}>SYSTEM REWARDS ACCREDITED</Text>

            <View style={themedStyles.rewardBigRow}>
              <View style={themedStyles.rewardBigBox}>
                <Text style={themedStyles.rewardBigNum}>+{rewardSummary?.xpEarned || routine.xpReward}</Text>
                <Text style={themedStyles.rewardBigLabel}>XP EARNED</Text>
              </View>
              <View style={themedStyles.rewardBigBox}>
                <Text style={[themedStyles.rewardBigNum, { color: theme.error }]}> 
                  +{rewardSummary?.statBonus || routine.statBonus}
                </Text>
                <Text style={themedStyles.rewardBigLabel}>
                  {rewardSummary?.statRaised || 'STRENGTH'}
                </Text>
              </View>
            </View>

            {/* Session Summary Grid */}
            <View style={themedStyles.summaryGrid}>
              <View style={themedStyles.summaryItem}>
                <Text style={themedStyles.summaryItemLabel}>TOTAL TIME</Text>
                <Text style={themedStyles.summaryItemVal}>{formatTime(totalSecondsElapsed)}</Text>
              </View>
              <View style={themedStyles.summaryItem}>
                <Text style={themedStyles.summaryItemLabel}>MOVEMENTS</Text>
                <Text style={themedStyles.summaryItemVal}>
                  {completedExercisesCount} / {routine.exercises.length}
                </Text>
              </View>
              <View style={themedStyles.summaryItem}>
                <Text style={themedStyles.summaryItemLabel}>DIFFICULTY</Text>
                <Text style={themedStyles.summaryItemVal}>{routine.difficulty}</Text>
              </View>
            </View>
          </View>

          {/* Clear & Return Button */}
          <Pressable
            style={themedStyles.finishBtn}
            onPress={returnAfterCompletion}
          >
            <Text style={themedStyles.finishBtnText}>CLAIM REWARDS & RETURN TO HUD ➔</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#040b14',
  },
  embeddedRoot: { flex: 0, width: '100%' },
  embeddedSafe: { flex: 0 },
  embeddedBottomCtaBar: { position: 'relative', bottom: undefined },
  safe: {
    flex: 1,
  },
  centerRoot: {
    flex: 1,
    backgroundColor: '#040b14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#00f3ff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  cancelRequestBtn: { alignSelf: 'center', marginTop: 12, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#38536a' },
  cancelRequestText: { color: '#8fa8bc', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  landingContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 14,
  },
  streakCard: {
    backgroundColor: '#081423',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1d3b59',
    padding: 16,
  },
  streakEyebrow: { color: '#dce8f3', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  streakCount: { color: '#f5f8fb', fontSize: 19, fontWeight: '800', marginTop: 14 },
  streakCaption: { color: '#7f9bb3', fontSize: 12, marginTop: 4 },
  activityStrip: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 18 },
  activityDay: { flex: 1, alignItems: 'center', gap: 7 },
  activityDayLabel: { color: '#69839a', fontSize: 10, fontWeight: '700' },
  activityTodayLabel: { color: '#00f3ff' },
  activityDot: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: '#263a4e', backgroundColor: '#101d2a', alignItems: 'center', justifyContent: 'center' },
  activityDotComplete: { borderColor: '#22c99a', backgroundColor: 'rgba(34, 201, 154, 0.18)' },
  activityDotToday: { borderColor: '#00cbd4', backgroundColor: 'rgba(0, 203, 212, 0.08)' },
  activityDotText: { color: '#7890a5', fontSize: 15, fontWeight: '900' },
  activityDotTextComplete: { color: '#42e0b2' },
  activityFootnote: { color: '#617b91', fontSize: 10, lineHeight: 15, marginTop: 13 },
  landingPlanCard: { backgroundColor: '#071626', borderRadius: 14, borderWidth: 1, borderColor: '#163b5e', padding: 16 },
  landingPlanTitle: { color: '#e9f4fc', fontSize: 13, fontWeight: '900', letterSpacing: 0.7 },
  landingPlanCopy: { color: '#7895ae', fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 14 },
  planError: { color: '#ff8094', fontSize: 12, lineHeight: 18, marginVertical: 10 },
  disabledAction: { opacity: 0.55 },
  retryPlanBtn: { alignSelf: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#536c82' },
  retryPlanText: { color: '#8fa8bc', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  restDayTitle: {
    color: '#00f3ff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 12,
  },
  restDayCopy: {
    color: '#8aa6be',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 420,
    paddingHorizontal: 24,
    marginBottom: 10,
  },

  // PREPARATION STYLES
  prepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#0e1c2a',
    borderWidth: 1,
    borderColor: '#1d3b59',
  },
  backButtonText: {
    color: '#89a7c2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  rankPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#1b1338',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#9d4edd',
  },
  rankPillText: {
    color: '#c084fc',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  prepContent: {
    paddingHorizontal: 18,
    paddingBottom: 100,
  },
  missionCard: {
    backgroundColor: '#081423',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#183857',
    padding: 18,
    marginTop: 8,
  },
  missionSysTag: {
    color: '#00f3ff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  missionTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  missionGoal: {
    color: '#8aa6be',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 16,
  },
  planNotice: {
    color: '#e5b96b',
    fontSize: 11,
    lineHeight: 16,
    marginTop: -8,
    marginBottom: 16,
  },
  prepMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  prepMetricBox: {
    flex: 1,
    backgroundColor: '#0c1d30',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1b3f64',
    alignItems: 'center',
  },
  prepMetricLabel: {
    color: '#557d9e',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  prepMetricVal: {
    color: '#00f3ff',
    fontSize: 13,
    fontWeight: '900',
  },
  prepMetricValSmall: {
    color: '#e0effe',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  rewardPreviewRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  rewardChip: {
    backgroundColor: '#06101c',
    borderWidth: 1,
    borderColor: '#00f3ff',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  rewardChipText: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sequenceHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  sequenceTitle: {
    color: '#e0effe',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sequenceSub: {
    color: '#6086a6',
    fontSize: 11,
    marginTop: 2,
  },
  exerciseSequenceList: {
    gap: 10,
  },
  exerciseSequenceItem: {
    flexDirection: 'row',
    backgroundColor: '#091524',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#173452',
    padding: 12,
    alignItems: 'center',
  },
  exSeqNumber: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#0f2740',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exSeqNumberText: {
    color: '#00f3ff',
    fontSize: 14,
    fontWeight: '900',
  },
  exSeqInfo: {
    flex: 1,
  },
  exSeqName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  exSeqTarget: {
    color: '#7fa4c4',
    fontSize: 11,
    marginTop: 3,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  muscleTag: {
    backgroundColor: '#0e2338',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  muscleTagText: {
    color: '#4990c6',
    fontSize: 9,
    fontWeight: '700',
  },
  bottomCtaBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#040b14',
    borderTopWidth: 1,
    borderTopColor: '#16314c',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 10,
  },
  startWorkoutFlex: { flex: 1 },
  adjustPlanBtn: { borderWidth: 1, borderColor: '#1b5570', backgroundColor: '#0b2031', paddingHorizontal: 14, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  adjustPlanBtnText: { color: '#72dce3', fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  startWorkoutBtn: {
    backgroundColor: '#00f3ff',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#00f3ff',
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  startWorkoutBtnText: {
    color: '#02111d',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  // ACTIVE WORKOUT STYLES
  activeTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  exitIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0d1c2c',
    borderWidth: 1,
    borderColor: '#1a3754',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitIconText: {
    color: '#8aa9c4',
    fontSize: 14,
    fontWeight: '900',
  },
  exerciseCounter: {
    alignItems: 'center',
  },
  counterText: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  stopwatchText: {
    color: '#8eaec9',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
  },
  pauseToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0d1c2c',
    borderWidth: 1,
    borderColor: '#1a3754',
  },
  pauseToggleText: {
    color: '#ffd700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  segmentedProgressBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  segmentFilled: {
    backgroundColor: '#00f3ff',
  },
  segmentEmpty: {
    backgroundColor: '#112940',
  },
  pausedBanner: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#ffd700',
    marginHorizontal: 16,
    marginVertical: 4,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  pausedBannerText: {
    color: '#ffd700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  activeScroll: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  illustrationWrapper: {
    marginTop: 10,
    marginBottom: 8,
  },
  exerciseInfoCard: {
    width: '100%',
    backgroundColor: '#081423',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#173654',
    padding: 16,
    alignItems: 'center',
  },
  exerciseTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  exerciseTip: {
    color: '#89a8c4',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  activeMusclesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  activeMuscleTag: {
    backgroundColor: '#0f2a44',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activeMuscleTagText: {
    color: '#5eb3f6',
    fontSize: 10,
    fontWeight: '800',
  },
  actionCenter: {
    width: '100%',
    marginTop: 16,
    alignItems: 'center',
  },
  timerCenter: {
    alignItems: 'center',
  },
  largeTimerVal: {
    color: '#00f3ff',
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 70,
  },
  largeTimerUnit: {
    color: '#5e8ba8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 4,
  },
  timerQuickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  quickAddBtn: {
    backgroundColor: '#0f2438',
    borderWidth: 1,
    borderColor: '#1b456e',
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  quickAddBtnText: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '800',
  },
  repCenter: {
    alignItems: 'center',
  },
  repTargetLabel: {
    color: '#648dae',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  repControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  repAdjBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0c2034',
    borderWidth: 1,
    borderColor: '#19426b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repAdjBtnText: {
    color: '#00f3ff',
    fontSize: 22,
    fontWeight: '800',
  },
  largeRepVal: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '900',
    minWidth: 80,
    textAlign: 'center',
  },
  activeBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#040b14',
    borderTopWidth: 1,
    borderTopColor: '#16314c',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 12,
  },
  skipExerciseBtn: {
    flex: 1,
    backgroundColor: '#0b1c2e',
    borderWidth: 1,
    borderColor: '#1d4268',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  skipExerciseBtnText: {
    color: '#7fa4c4',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  completeSetBtn: {
    flex: 2,
    backgroundColor: '#00f3ff',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  completeSetBtnText: {
    color: '#02111d',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  // REST SCREEN STYLES
  restCardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  restBadge: {
    backgroundColor: '#1b1236',
    borderWidth: 1,
    borderColor: '#9d4edd',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  restBadgeText: {
    color: '#c084fc',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  restHeaderTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
  },
  restSub: {
    color: '#7ea4c4',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  restTimerCircle: {
    alignItems: 'center',
    marginVertical: 12,
  },
  restTimerNumber: {
    color: '#00f3ff',
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 80,
  },
  restTimerUnit: {
    color: '#557f9f',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  nextPreviewBox: {
    width: '100%',
    backgroundColor: '#091524',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#163654',
    padding: 14,
    alignItems: 'center',
    marginVertical: 16,
  },
  nextPreviewTag: {
    color: '#648dae',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  nextPreviewName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  nextPreviewTarget: {
    color: '#00f3ff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  restButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  addTimeBtn: {
    flex: 1,
    backgroundColor: '#0c1e30',
    borderWidth: 1,
    borderColor: '#1c446c',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  addTimeBtnText: {
    color: '#89a8c4',
    fontSize: 12,
    fontWeight: '900',
  },
  skipRestBtn: {
    flex: 1,
    backgroundColor: '#00f3ff',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  skipRestBtnText: {
    color: '#02111d',
    fontSize: 12,
    fontWeight: '900',
  },

  // EXIT MODAL STYLES
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 12, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  adjustModalScroll: { flexGrow: 1, justifyContent: 'center', padding: 18 },
  adjustModalCard: { width: '100%', maxWidth: 540, alignSelf: 'center', backgroundColor: '#081423', borderWidth: 1, borderColor: '#1b4767', borderRadius: 16, padding: 18 },
  adjustModalTitle: { color: '#f4fbff', fontSize: 17, fontWeight: '900', letterSpacing: 0.6 },
  adjustModalCopy: { color: '#7895ae', fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 16 },
  adjustLabel: { color: '#6687a2', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 7 },
  adjustDurationInput: { color: '#eaf7ff', backgroundColor: '#0c1d30', borderWidth: 1, borderColor: '#1b3e5a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  adjustOptionGroup: { marginBottom: 14 },
  adjustChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  adjustChoice: { borderWidth: 1, borderColor: '#1a3a55', backgroundColor: '#0b1b2a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  adjustChoiceActive: { borderColor: '#00cbd4', backgroundColor: '#0d2c3b' },
  adjustChoiceText: { color: '#8aa5bb', fontSize: 11, fontWeight: '700' },
  adjustChoiceTextActive: { color: '#5ce3e8' },
  cancelAdjustBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  cancelAdjustText: { color: '#7790a5', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  exitCard: {
    width: '100%',
    backgroundColor: '#081423',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ff5376',
    padding: 22,
    alignItems: 'center',
  },
  exitAlertTitle: {
    color: '#ff5376',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  exitAlertDesc: {
    color: '#93b1cb',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  exitActions: {
    width: '100%',
    gap: 10,
  },
  resumeDungeonBtn: {
    backgroundColor: '#00f3ff',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
  },
  resumeDungeonBtnText: {
    color: '#02111d',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  abandonBtn: {
    backgroundColor: '#1b1319',
    borderWidth: 1,
    borderColor: '#ff5376',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
  },
  abandonBtnText: {
    color: '#ff5376',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // COMPLETION STYLES
  completedContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingVertical: 24,
  },
  victoryHeader: {
    alignItems: 'center',
    marginTop: 20,
  },
  clearBadge: {
    backgroundColor: '#00f3ff22',
    borderWidth: 1,
    borderColor: '#00f3ff',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 10,
  },
  clearBadgeText: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  victoryTitle: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1,
  },
  victorySub: {
    color: '#89a9c6',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
  },
  victoryRewardCard: {
    backgroundColor: '#081423',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#193f66',
    padding: 20,
  },
  rewardCardHeader: {
    color: '#6590b2',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 16,
  },
  rewardBigRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  rewardBigBox: {
    flex: 1,
    backgroundColor: '#0c1f34',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1b4570',
    paddingVertical: 16,
    alignItems: 'center',
  },
  rewardBigNum: {
    color: '#00f3ff',
    fontSize: 32,
    fontWeight: '900',
  },
  rewardBigLabel: {
    color: '#6691b4',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#153350',
    paddingTop: 16,
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryItemLabel: {
    color: '#557e9f',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryItemVal: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  finishBtn: {
    backgroundColor: '#00f3ff',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#00f3ff',
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  finishBtnText: {
    color: '#02111d',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
