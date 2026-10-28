import { useAppearance, useThemedStyles } from '../lib/AppearanceContext';
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  calculateStartingAttributes,
  saveHunterProfile,
  saveHunterStats,
  unlockAchievement,
  clearOnboardingDraft,
  getOnboardingDraft,
  saveOnboardingDraft,
} from '../lib/hunterStorage';
import { HunterProfile, HunterStats } from '../lib/hunterTypes';
import { PentagonChart } from './PentagonChart';
import { getAnalysisFocusAreas, OnboardingStep } from '../lib/onboardingFlow';

interface OnboardingModalProps {
  visible: boolean;
  onComplete: (profile: HunterProfile, stats: HunterStats) => void;
}

export function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const { theme } = useAppearance();
  const themedStyles = useThemedStyles(styles);
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const hydrated = useRef(false);

  // Form states
  const [name, setName] = useState('');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('70');
  const [age, setAge] = useState('21');

  const [primaryGoal, setPrimaryGoal] = useState('Strength & Aesthetic Physique');
  const [fitnessLevel, setFitnessLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [studyFocus, setStudyFocus] = useState('Computer Science & DSA');

  const [weakness, setWeakness] = useState('Instagram Reels & Doomscrolling');
  const [restDay, setRestDay] = useState('Sunday');

  // Computed starting stats
  const [generatedResult, setGeneratedResult] = useState<{
    stats: HunterStats;
    title: string;
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!visible) return;
    hydrated.current = false;
    getOnboardingDraft().then((draft) => {
      if (draft) {
        setStep(draft.step);
        setName(draft.name);
        setHeight(draft.height);
        setWeight(draft.weight);
        setAge(draft.age);
        setPrimaryGoal(draft.primaryGoal);
        setFitnessLevel(draft.fitnessLevel);
        setStudyFocus(draft.studyFocus);
        setWeakness(draft.weakness);
        setRestDay(draft.restDay);
        if (draft.generatedResult) setGeneratedResult(draft.generatedResult);
      }
      hydrated.current = true;
    }).catch((err) => {
      console.warn('Failed to restore onboarding progress:', err);
      hydrated.current = true;
    });
  }, [visible]);

  useEffect(() => {
    if (!visible || !hydrated.current) return;
    saveOnboardingDraft({
      step,
      name,
      height,
      weight,
      age,
      primaryGoal,
      fitnessLevel,
      studyFocus,
      weakness,
      restDay,
      generatedResult: generatedResult ?? undefined,
    }).catch((err) => console.warn('Failed to save onboarding progress:', err));
  }, [
    visible, step, name, height, weight, age, primaryGoal, fitnessLevel,
    studyFocus, weakness, restDay, generatedResult,
  ]);

  const calculateAndShowAwakening = () => {
    const res = calculateStartingAttributes({
      height: Number(height) || 175,
      weight: Number(weight) || 70,
      age: Number(age) || 21,
      fitnessLevel,
      primaryGoal,
      studyFocus,
      weakness,
    });
    setGeneratedResult(res);
    setStep('analysis');
  };

  const finalizeAwakening = async () => {
    if (!generatedResult) return;

    const newProfile: HunterProfile = {
      _id: `hunter_${Date.now()}`,
      name: name.trim() || 'Jin-Woo',
      email: 'local@hunteros',
      title: generatedResult.title,
      rank: 'E-Rank',
      height: Number(height) || 175,
      weight: Number(weight) || 70,
      age: Number(age) || 21,
      primaryGoal,
      fitnessLevel,
      studyFocus,
      weakness,
      restDay,
      xp: 0,
      level: 1,
      onboarded: true,
      theme: 'system-blue',
      streakDays: 1,
      lastActiveDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await saveHunterProfile(newProfile);
    await saveHunterStats(generatedResult.stats);
    await unlockAchievement('awakening');
    await clearOnboardingDraft();

    onComplete(newProfile, generatedResult.stats);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={themedStyles.root}>
        <ScrollView contentContainerStyle={themedStyles.container}>
          {/* Header */}
          <View style={themedStyles.header}>
            <Text style={themedStyles.systemTag}>Baseline Assessment</Text>
            <Text style={themedStyles.stepIndicator}>
              PHASE {Math.max(1, ['welcome', 'baseline', 'goals', 'analysis', 'identity'].indexOf(step) + 1)} OF 5
            </Text>
          </View>

          {errorMsg ? <Text style={themedStyles.error}>{errorMsg}</Text> : null}

          {/* STEP 1: AWAKENING */}
          {step === 'welcome' && (
            <View style={themedStyles.stepContent}>
              <Text style={themedStyles.title}>THE AWAKENING</Text>
              <Text style={themedStyles.subtitle}>
                A System has manifested in your reality. Complete a short assessment to initialize your local Hunter profile.
              </Text>
              <Text style={themedStyles.restNote}>No account or login is required. Your profile and progress stay on this device.</Text>
              <Pressable style={themedStyles.primaryButton} onPress={() => setStep('baseline')}>
                <Text style={themedStyles.buttonText}>BEGIN BASELINE ASSESSMENT ➔</Text>
              </Pressable>
            </View>
          )}

          {/* STEP 2: BASELINE ASSESSMENT */}
          {step === 'baseline' && (
            <View style={themedStyles.stepContent}>
              <Text style={themedStyles.title}>BASELINE ASSESSMENT</Text>
              <Text style={themedStyles.subtitle}>Enter the biological and habit inputs used to calculate your starting attributes.</Text>
              <View style={themedStyles.row}>
                <View style={themedStyles.col}>
                  <Text style={themedStyles.label}>HEIGHT (CM)</Text>
                  <TextInput
                    value={height}
                    onChangeText={setHeight}
                    keyboardType="numeric"
                    style={themedStyles.input}
                  />
                </View>
                <View style={themedStyles.col}>
                  <Text style={themedStyles.label}>WEIGHT (KG)</Text>
                  <TextInput
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    style={themedStyles.input}
                  />
                </View>
                <View style={themedStyles.col}>
                  <Text style={themedStyles.label}>AGE</Text>
                  <TextInput
                    value={age}
                    onChangeText={setAge}
                    keyboardType="numeric"
                    style={themedStyles.input}
                  />
                </View>
              </View>
              <Text style={themedStyles.label}>BIGGEST OBSTACLE / SHADOW HABIT</Text>
              {[
                'Instagram Reels & Doomscrolling',
                'Procrastination & Avoidance of Hard Tasks',
                'Inconsistent Sleep & Chronic Fatigue',
                'Skipping Workouts & Poor Diet',
              ].map((opt) => (
                <Pressable key={opt} style={[themedStyles.optionButton, weakness === opt && themedStyles.optionSelected]} onPress={() => setWeakness(opt)}>
                  <Text style={[themedStyles.optionText, weakness === opt && themedStyles.optionTextSelected]}>{weakness === opt ? '▶ ' : '○ '}{opt}</Text>
                </Pressable>
              ))}
              <View style={themedStyles.buttonRow}>
                <Pressable style={themedStyles.backButton} onPress={() => setStep('welcome')}><Text style={themedStyles.backText}>BACK</Text></Pressable>
                <Pressable style={[themedStyles.primaryButton, { flex: 1 }]} onPress={() => setStep('goals')}><Text style={themedStyles.buttonText}>GOALS ➔</Text></Pressable>
              </View>
            </View>
          )}

          {/* STEP 3: GOALS */}
          {step === 'goals' && (
            <View style={themedStyles.stepContent}>
              <Text style={themedStyles.title}>PRIMARY DIRECTIVES</Text>
              <Text style={themedStyles.subtitle}>
                Define your core evolutionary goals and current physical conditioning.
              </Text>

              <Text style={themedStyles.label}>PRIMARY MISSION OBJECTIVE</Text>
              {[
                'Strength & Aesthetic Physique',
                'Software Engineering, DSA & High GPA',
                'Monk Mode Discipline & No Distractions',
                'Total Life Transformation (Balanced Hunter)',
              ].map((goalOption) => (
                <Pressable
                  key={goalOption}
                  style={[
                    themedStyles.optionButton,
                    primaryGoal === goalOption && themedStyles.optionSelected,
                  ]}
                  onPress={() => setPrimaryGoal(goalOption)}
                >
                  <Text
                    style={[
                      themedStyles.optionText,
                      primaryGoal === goalOption && themedStyles.optionTextSelected,
                    ]}
                  >
                    {primaryGoal === goalOption ? '▶ ' : '○ '} {goalOption}
                  </Text>
                </Pressable>
              ))}

              <Text style={[themedStyles.label, { marginTop: 18 }]}>PHYSICAL PREPARATION LEVEL</Text>
              <View style={themedStyles.row}>
                {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => (
                  <Pressable
                    key={lvl}
                    style={[
                      themedStyles.chip,
                      fitnessLevel === lvl && themedStyles.chipSelected,
                    ]}
                    onPress={() => setFitnessLevel(lvl)}
                  >
                    <Text
                      style={[
                        themedStyles.chipText,
                        fitnessLevel === lvl && themedStyles.chipTextSelected,
                      ]}
                    >
                      {lvl.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[themedStyles.label, { marginTop: 18 }]}>KNOWLEDGE DOMAIN</Text>
              <TextInput
                value={studyFocus}
                onChangeText={setStudyFocus}
                placeholder="e.g. Computer Science, Medical, Finance"
                placeholderTextColor={theme.textSecondary}
                style={themedStyles.input}
              />

              <View style={themedStyles.buttonRow}>
                <Pressable style={themedStyles.backButton} onPress={() => setStep('baseline')}>
                  <Text style={themedStyles.backText}>BACK</Text>
                </Pressable>
                <Pressable style={[themedStyles.primaryButton, { flex: 1 }]} onPress={() => {
                  const res = calculateStartingAttributes({
                    height: Number(height) || 175, weight: Number(weight) || 70, age: Number(age) || 21,
                    fitnessLevel, primaryGoal, studyFocus, weakness,
                  });
                  setGeneratedResult(res);
                  setStep('analysis');
                }}>
                  <Text style={themedStyles.buttonText}>ANALYZE MY HUNTER PROFILE ➔</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* STEP 4: ANALYSIS REVEAL */}
          {step === 'analysis' && generatedResult && (
            <View style={themedStyles.stepContent}>
              <View style={themedStyles.awakenedBadge}>
                <Text style={themedStyles.awakenedBadgeText}>SYSTEM RECOGNITION CONFIRMED</Text>
              </View>

              <Text style={themedStyles.titleCenter}>YOU HAVE AWAKENED</Text>
              <Text style={themedStyles.titleAssigned}>[ {generatedResult.title} ]</Text>

              <Text style={themedStyles.pentagonTitle}>INITIAL PENTAGON RADAR ATTRIBUTES</Text>
              <PentagonChart stats={generatedResult.stats} size={280} />

              <View style={themedStyles.statPills}>
                <View style={themedStyles.pill}>
                  <Text style={themedStyles.pillLabel}>STR</Text>
                  <Text style={themedStyles.pillVal}>{generatedResult.stats.strength}</Text>
                </View>
                <View style={themedStyles.pill}>
                  <Text style={themedStyles.pillLabel}>KNW</Text>
                  <Text style={themedStyles.pillVal}>{generatedResult.stats.knowledge}</Text>
                </View>
                <View style={themedStyles.pill}>
                  <Text style={themedStyles.pillLabel}>DIS</Text>
                  <Text style={themedStyles.pillVal}>{generatedResult.stats.discipline}</Text>
                </View>
                <View style={themedStyles.pill}>
                  <Text style={themedStyles.pillLabel}>HLT</Text>
                  <Text style={themedStyles.pillVal}>{generatedResult.stats.health}</Text>
                </View>
                <View style={themedStyles.pill}>
                  <Text style={themedStyles.pillLabel}>MND</Text>
                  <Text style={themedStyles.pillVal}>{generatedResult.stats.mindfulness}</Text>
                </View>
              </View>

              <Text style={themedStyles.restNote}>
                Weekly Rest Protocol active on {restDay}s. Quests grant full XP.
              </Text>
              <Text style={themedStyles.label}>FOCUS AREAS</Text>
              <Text style={themedStyles.restNote}>{getAnalysisFocusAreas(generatedResult.stats).map((area) => area.toUpperCase()).join(' · ')}</Text>
              <Text style={themedStyles.restNote}>Recommendations are based on your selected goal, study focus, and obstacle.</Text>
              <View style={themedStyles.buttonRow}>
                <Pressable style={themedStyles.backButton} onPress={() => setStep('goals')}><Text style={themedStyles.backText}>BACK</Text></Pressable>
                <Pressable style={[themedStyles.awakenButton, { flex: 1 }]} onPress={() => setStep('identity')}>
                  <Text style={themedStyles.awakenButtonText}>SET HUNTER IDENTITY ➔</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* STEP 5: LOCAL IDENTITY */}
          {step === 'identity' && (
            <View style={themedStyles.stepContent}>
              <Text style={themedStyles.title}>HUNTER IDENTITY</Text>
              <Text style={themedStyles.subtitle}>Choose the name or codename shown on this device. This is a local profile, not an account login.</Text>
              <Text style={themedStyles.label}>HUNTER DESIGNATION</Text>
              <TextInput value={name} onChangeText={setName} placeholder="e.g. Alex or Shadow-07" placeholderTextColor={theme.textSecondary} style={themedStyles.input} />
              <View style={themedStyles.buttonRow}>
                <Pressable style={themedStyles.backButton} onPress={() => setStep('analysis')}><Text style={themedStyles.backText}>BACK</Text></Pressable>
                <Pressable style={[themedStyles.awakenButton, { flex: 1 }]} onPress={() => {
                  if (!name.trim()) {
                    setErrorMsg('Hunter designation name is required.');
                    return;
                  }
                  setErrorMsg('');
                  finalizeAwakening();
                }}>
                  <Text style={themedStyles.awakenButtonText}>ENTER HUNTER SYSTEM ➔</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050b14',
  },
  container: {
    padding: 22,
    paddingTop: 48,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#16314c',
    paddingBottom: 12,
  },
  systemTag: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  stepIndicator: {
    color: '#7195af',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  error: {
    color: '#ff5376',
    backgroundColor: 'rgba(255, 83, 118, 0.1)',
    padding: 10,
    borderRadius: 4,
    marginBottom: 16,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#ff5376',
  },
  stepContent: {
    marginTop: 6,
  },
  title: {
    color: '#e6fbff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  titleCenter: {
    color: '#e6fbff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 6,
  },
  titleAssigned: {
    color: '#00f3ff',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  subtitle: {
    color: '#7fa3bf',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 24,
  },
  label: {
    color: '#6591b2',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#081626',
    borderWidth: 1,
    borderColor: '#1d4163',
    borderRadius: 6,
    color: '#ffffff',
    padding: 14,
    fontSize: 14,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  col: {
    flex: 1,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#183b5d',
    backgroundColor: '#081626',
    padding: 14,
    borderRadius: 6,
    marginBottom: 10,
  },
  optionSelected: {
    borderColor: '#00f3ff',
    backgroundColor: 'rgba(0, 243, 255, 0.08)',
  },
  optionText: {
    color: '#95b7d1',
    fontSize: 13,
    fontWeight: '700',
  },
  optionTextSelected: {
    color: '#00f3ff',
    fontWeight: '900',
  },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1a3e61',
    backgroundColor: '#081626',
    borderRadius: 6,
    alignItems: 'center',
  },
  chipSelected: {
    borderColor: '#00f3ff',
    backgroundColor: 'rgba(0, 243, 255, 0.1)',
  },
  chipText: {
    color: '#6e98b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  chipTextSelected: {
    color: '#00f3ff',
    fontWeight: '900',
  },
  primaryButton: {
    backgroundColor: '#00f3ff',
    padding: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonText: {
    color: '#030b14',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  backButton: {
    borderWidth: 1,
    borderColor: '#1d4163',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 6,
  },
  backText: {
    color: '#7195af',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  awakenedBadge: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#00f3ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 243, 255, 0.1)',
    marginBottom: 8,
  },
  awakenedBadgeText: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  pentagonTitle: {
    color: '#7195af',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: 10,
  },
  statPills: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  pill: {
    borderWidth: 1,
    borderColor: '#193955',
    backgroundColor: '#081626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  pillLabel: {
    color: '#5f88a9',
    fontSize: 9,
    fontWeight: '900',
  },
  pillVal: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  restNote: {
    color: '#fbb03b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  awakenButton: {
    backgroundColor: '#00f3ff',
    padding: 18,
    borderRadius: 6,
    alignItems: 'center',
  },
  awakenButtonText: {
    color: '#030b14',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
