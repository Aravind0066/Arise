import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ExerciseIllustration } from '../components/ExerciseIllustration';
import {
  getHunterProfile,
  recordWorkoutCompletion,
} from '../lib/hunterStorage';
import { Exercise, HunterProfile, WorkoutRoutine } from '../lib/hunterTypes';
import { getPersonalizedWorkout, WORKOUT_ROUTINES } from '../lib/workoutEngine';

type WorkoutPhase = 'preparation' | 'active' | 'rest' | 'completed';

export default function WorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ questId?: string; routineId?: string; workoutTitle?: string }>();

  const [profile, setProfile] = useState<HunterProfile | null>(null);
  const [routine, setRoutine] = useState<WorkoutRoutine | null>(null);
  const [phase, setPhase] = useState<WorkoutPhase>('preparation');

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

  // Completion summary data
  const [rewardSummary, setRewardSummary] = useState<{
    xpEarned: number;
    statRaised: string;
    statBonus: number;
  } | null>(null);

  // Load profile and build personalized workout
  useEffect(() => {
    (async () => {
      const p = await getHunterProfile();
      setProfile(p);
      const chosenRoutine = getPersonalizedWorkout(p, params.routineId);
      setRoutine(chosenRoutine);
    })();
  }, [params.routineId]);

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
    router.back();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!routine) {
    return (
      <View style={styles.centerRoot}>
        <Text style={styles.loadingText}>CALIBRATING WORKOUT CHAMBER...</Text>
      </View>
    );
  }

  // ==========================================
  // PHASE 1: PREPARATION SCREEN
  // ==========================================
  if (phase === 'preparation') {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* Top navigation header */}
          <View style={styles.prepHeader}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>✕ ABORT</Text>
            </Pressable>
            <View style={styles.rankPill}>
              <Text style={styles.rankPillText}>{routine.codeName}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.prepContent} showsVerticalScrollIndicator={false}>
            {/* Mission Dossier Card */}
            <View style={styles.missionCard}>
              <Text style={styles.missionSysTag}>DUNGEON PROTOCOL // PHYSICAL ASCENSION</Text>
              <Text style={styles.missionTitle}>{routine.title}</Text>
              <Text style={styles.missionGoal}>{routine.goal}</Text>

              {/* Metrics Badge Grid */}
              <View style={styles.prepMetricsGrid}>
                <View style={styles.prepMetricBox}>
                  <Text style={styles.prepMetricLabel}>EST. TIME</Text>
                  <Text style={styles.prepMetricVal}>{routine.durationMinutes} MIN</Text>
                </View>
                <View style={styles.prepMetricBox}>
                  <Text style={styles.prepMetricLabel}>EXERCISES</Text>
                  <Text style={styles.prepMetricVal}>{routine.exercises.length}</Text>
                </View>
                <View style={styles.prepMetricBox}>
                  <Text style={styles.prepMetricLabel}>EQUIPMENT</Text>
                  <Text style={styles.prepMetricValSmall}>{routine.equipment}</Text>
                </View>
                <View style={styles.prepMetricBox}>
                  <Text style={styles.prepMetricLabel}>DIFFICULTY</Text>
                  <Text style={[styles.prepMetricVal, { color: '#ff5376' }]}>
                    {routine.difficulty.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Reward preview */}
              <View style={styles.rewardPreviewRow}>
                <View style={styles.rewardChip}>
                  <Text style={styles.rewardChipText}>⚡ +{routine.xpReward} XP</Text>
                </View>
                <View style={[styles.rewardChip, { borderColor: '#ff0055' }]}>
                  <Text style={[styles.rewardChipText, { color: '#ff5376' }]}>
                    ⚔️ +{routine.statBonus} {routine.targetStat.toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.rewardChip, { borderColor: '#38ef7d' }]}>
                  <Text style={[styles.rewardChipText, { color: '#38ef7d' }]}>💧 +2 HEALTH</Text>
                </View>
              </View>
            </View>

            {/* Exercise Sequence List */}
            <View style={styles.sequenceHeader}>
              <Text style={styles.sequenceTitle}>ORDER OF BATTLE ({routine.exercises.length} MOVEMENTS)</Text>
              <Text style={styles.sequenceSub}>Sequential progression to muscular failure</Text>
            </View>

            <View style={styles.exerciseSequenceList}>
              {routine.exercises.map((ex, idx) => (
                <View key={ex.id} style={styles.exerciseSequenceItem}>
                  <View style={styles.exSeqNumber}>
                    <Text style={styles.exSeqNumberText}>0{idx + 1}</Text>
                  </View>
                  <View style={styles.exSeqInfo}>
                    <Text style={styles.exSeqName}>{ex.name}</Text>
                    <Text style={styles.exSeqTarget}>
                      {ex.type === 'timed' ? `⏱️ ${ex.durationSeconds}s Duration` : `⚔️ ${ex.targetReps} Repetitions`}
                      {' · '}Rest: {ex.restSeconds}s
                    </Text>
                    <View style={styles.tagRow}>
                      {ex.targetMuscles.map((m) => (
                        <View key={m} style={styles.muscleTag}>
                          <Text style={styles.muscleTagText}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Fixed Bottom Action CTA */}
          <View style={styles.bottomCtaBar}>
            <Pressable style={styles.startWorkoutBtn} onPress={startWorkout}>
              <Text style={styles.startWorkoutBtnText}>START WORKOUT RAID ➔</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ==========================================
  // PHASE 2: REST TRANSITION SCREEN
  // ==========================================
  if (phase === 'rest') {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.restCardContainer}>
            <View style={styles.restBadge}>
              <Text style={styles.restBadgeText}>SYSTEM // CELLULAR REHYDRATION</Text>
            </View>

            <Text style={styles.restHeaderTitle}>REST & RECOVER</Text>
            <Text style={styles.restSub}>Deep diaphragmatic breathing to clear lactic acid</Text>

            <ExerciseIllustration type="rest" size={180} isActive={true} />

            {/* Big Countdown Number */}
            <View style={styles.restTimerCircle}>
              <Text style={styles.restTimerNumber}>{restTimeRemaining}</Text>
              <Text style={styles.restTimerUnit}>SECONDS</Text>
            </View>

            {/* Next Movement Preview */}
            {nextExercise && (
              <View style={styles.nextPreviewBox}>
                <Text style={styles.nextPreviewTag}>UP NEXT</Text>
                <Text style={styles.nextPreviewName}>{nextExercise.name}</Text>
                <Text style={styles.nextPreviewTarget}>
                  {nextExercise.type === 'timed'
                    ? `${nextExercise.durationSeconds}s Timed Hold`
                    : `${nextExercise.targetReps} Reps`}
                </Text>
              </View>
            )}

            {/* Rest control buttons */}
            <View style={styles.restButtonsRow}>
              <Pressable style={styles.addTimeBtn} onPress={() => addRestTime(15)}>
                <Text style={styles.addTimeBtnText}>+15 SEC REST</Text>
              </Pressable>
              <Pressable style={styles.skipRestBtn} onPress={skipRest}>
                <Text style={styles.skipRestBtnText}>SKIP REST ➔</Text>
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
      <View style={styles.root}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* Top Active Bar */}
          <View style={styles.activeTopBar}>
            <Pressable style={styles.exitIconBtn} onPress={() => setShowExitModal(true)}>
              <Text style={styles.exitIconText}>✕</Text>
            </Pressable>

            <View style={styles.exerciseCounter}>
              <Text style={styles.counterText}>
                EXERCISE {currentIndex + 1} OF {totalExercises}
              </Text>
              <Text style={styles.stopwatchText}>⏱ {formatTime(totalSecondsElapsed)}</Text>
            </View>

            <Pressable
              style={styles.pauseToggleBtn}
              onPress={() => setIsPaused((prev) => !prev)}
            >
              <Text style={styles.pauseToggleText}>{isPaused ? '▶ RESUME' : '❚❚ PAUSE'}</Text>
            </Pressable>
          </View>

          {/* Segmented Progress Bar */}
          <View style={styles.segmentedProgressBar}>
            {routine.exercises.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  i <= currentIndex ? styles.segmentFilled : styles.segmentEmpty,
                ]}
              />
            ))}
          </View>

          {isPaused && (
            <View style={styles.pausedBanner}>
              <Text style={styles.pausedBannerText}>❚❚ SYSTEM PAUSED — TAP RESUME TO CONTINUE</Text>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.activeScroll} showsVerticalScrollIndicator={false}>
            {/* Exercise Movement Graphic */}
            <View style={styles.illustrationWrapper}>
              <ExerciseIllustration
                type={currentExercise.illustrationKey}
                size={230}
                isActive={!isPaused}
              />
            </View>

            {/* Exercise Name and Instruction */}
            <View style={styles.exerciseInfoCard}>
              <Text style={styles.exerciseTitle}>{currentExercise.name}</Text>
              <Text style={styles.exerciseTip}>{currentExercise.tips}</Text>

              {/* Muscles Activated */}
              <View style={styles.activeMusclesRow}>
                {currentExercise.targetMuscles.map((m) => (
                  <View key={m} style={styles.activeMuscleTag}>
                    <Text style={styles.activeMuscleTagText}>⚔️ {m}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Exercise Interaction Control Center */}
            <View style={styles.actionCenter}>
              {isTimed ? (
                <View style={styles.timerCenter}>
                  <Text style={styles.largeTimerVal}>{exerciseTimeRemaining}</Text>
                  <Text style={styles.largeTimerUnit}>SECONDS REMAINING</Text>
                  <View style={styles.timerQuickRow}>
                    <Pressable
                      style={styles.quickAddBtn}
                      onPress={() => setExerciseTimeRemaining((t) => t + 10)}
                    >
                      <Text style={styles.quickAddBtnText}>+10s</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.repCenter}>
                  <Text style={styles.repTargetLabel}>TARGET REPETITIONS</Text>
                  <View style={styles.repControlRow}>
                    <Pressable
                      style={styles.repAdjBtn}
                      onPress={() => setRepCount((r) => Math.max(1, r - 1))}
                    >
                      <Text style={styles.repAdjBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.largeRepVal}>{repCount}</Text>
                    <Pressable
                      style={styles.repAdjBtn}
                      onPress={() => setRepCount((r) => r + 1)}
                    >
                      <Text style={styles.repAdjBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Bottom Action Controls */}
          <View style={styles.activeBottomBar}>
            <Pressable style={styles.skipExerciseBtn} onPress={skipCurrentExercise}>
              <Text style={styles.skipExerciseBtnText}>SKIP ➔</Text>
            </Pressable>
            <Pressable style={styles.completeSetBtn} onPress={handleExerciseFinished}>
              <Text style={styles.completeSetBtnText}>
                {isTimed ? 'FINISH EARLY ➔' : 'COMPLETE SET ➔'}
              </Text>
            </Pressable>
          </View>

          {/* Safe Exit Confirmation Modal */}
          <Modal visible={showExitModal} transparent animationType="fade">
            <View style={styles.modalBackdrop}>
              <View style={styles.exitCard}>
                <Text style={styles.exitAlertTitle}>ABANDON DUNGEON RAID?</Text>
                <Text style={styles.exitAlertDesc}>
                  Your active streak and exercise progression in this session will not be saved.
                </Text>

                <View style={styles.exitActions}>
                  <Pressable
                    style={styles.resumeDungeonBtn}
                    onPress={() => setShowExitModal(false)}
                  >
                    <Text style={styles.resumeDungeonBtnText}>RESUME WORKOUT</Text>
                  </Pressable>
                  <Pressable style={styles.abandonBtn} onPress={confirmExit}>
                    <Text style={styles.abandonBtnText}>ABANDON MISSION</Text>
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
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.completedContainer}>
          {/* Victory Header */}
          <View style={styles.victoryHeader}>
            <View style={styles.clearBadge}>
              <Text style={styles.clearBadgeText}>GATE CONQUERED</Text>
            </View>
            <Text style={styles.victoryTitle}>DUNGEON CLEARED!</Text>
            <Text style={styles.victorySub}>
              Physical limits shattered. System has recorded your biometric exertion.
            </Text>
          </View>

          {/* Stats Rewards Card */}
          <View style={styles.victoryRewardCard}>
            <Text style={styles.rewardCardHeader}>SYSTEM REWARDS ACCREDITED</Text>

            <View style={styles.rewardBigRow}>
              <View style={styles.rewardBigBox}>
                <Text style={styles.rewardBigNum}>+{rewardSummary?.xpEarned || routine.xpReward}</Text>
                <Text style={styles.rewardBigLabel}>XP EARNED</Text>
              </View>
              <View style={styles.rewardBigBox}>
                <Text style={[styles.rewardBigNum, { color: '#ff5376' }]}>
                  +{rewardSummary?.statBonus || routine.statBonus}
                </Text>
                <Text style={styles.rewardBigLabel}>
                  {rewardSummary?.statRaised || 'STRENGTH'}
                </Text>
              </View>
            </View>

            {/* Session Summary Grid */}
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>TOTAL TIME</Text>
                <Text style={styles.summaryItemVal}>{formatTime(totalSecondsElapsed)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>MOVEMENTS</Text>
                <Text style={styles.summaryItemVal}>
                  {completedExercisesCount} / {routine.exercises.length}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>DIFFICULTY</Text>
                <Text style={styles.summaryItemVal}>{routine.difficulty}</Text>
              </View>
            </View>
          </View>

          {/* Clear & Return Button */}
          <Pressable
            style={styles.finishBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.finishBtnText}>CLAIM REWARDS & RETURN TO HUD ➔</Text>
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
  },
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
