import React, { useState } from 'react';
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
} from '../lib/hunterStorage';
import { HunterProfile, HunterStats } from '../lib/hunterTypes';
import { PentagonChart } from './PentagonChart';

interface OnboardingModalProps {
  visible: boolean;
  onComplete: (profile: HunterProfile, stats: HunterStats) => void;
}

export function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
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

  const nextFromStep1 = () => {
    if (!name.trim()) {
      setErrorMsg('Hunter designation name is required.');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const nextFromStep2 = () => {
    setStep(3);
  };

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
    setStep(4);
  };

  const finalizeAwakening = async () => {
    if (!generatedResult) return;

    const newProfile: HunterProfile = {
      _id: `hunter_${Date.now()}`,
      name: name.trim() || 'Jin-Woo',
      email: email.trim().toLowerCase() || 'hunter@system.io',
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

    onComplete(newProfile, generatedResult.stats);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.systemTag}>SYSTEM // BASELINE ASSESSMENT</Text>
            <Text style={styles.stepIndicator}>PHASE {step} OF 4</Text>
          </View>

          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

          {/* STEP 1: IDENTITY & BIOMETRICS */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>CHARACTER CREATION</Text>
              <Text style={styles.subtitle}>
                A System has manifested in your reality. Enter your baseline biological parameters.
              </Text>

              <Text style={styles.label}>HUNTER DESIGNATION (NAME)</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Sung Jin-Woo, Alex, Rohan"
                placeholderTextColor="#3e6382"
                style={styles.input}
              />

              <Text style={styles.label}>EMAIL / CODENAME (LOCAL PROFILE)</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="hunter@system.io"
                autoCapitalize="none"
                placeholderTextColor="#3e6382"
                style={styles.input}
              />

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>HEIGHT (CM)</Text>
                  <TextInput
                    value={height}
                    onChangeText={setHeight}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>WEIGHT (KG)</Text>
                  <TextInput
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>AGE</Text>
                  <TextInput
                    value={age}
                    onChangeText={setAge}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
              </View>

              <Pressable style={styles.primaryButton} onPress={nextFromStep1}>
                <Text style={styles.buttonText}>PROCEED TO CALIBRATION ➔</Text>
              </Pressable>
            </View>
          )}

          {/* STEP 2: GOALS & FITNESS */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>PRIMARY DIRECTIVES</Text>
              <Text style={styles.subtitle}>
                Define your core evolutionary goals and current physical conditioning.
              </Text>

              <Text style={styles.label}>PRIMARY MISSION OBJECTIVE</Text>
              {[
                'Strength & Aesthetic Physique',
                'Software Engineering, DSA & High GPA',
                'Monk Mode Discipline & No Distractions',
                'Total Life Transformation (Balanced Hunter)',
              ].map((goalOption) => (
                <Pressable
                  key={goalOption}
                  style={[
                    styles.optionButton,
                    primaryGoal === goalOption && styles.optionSelected,
                  ]}
                  onPress={() => setPrimaryGoal(goalOption)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      primaryGoal === goalOption && styles.optionTextSelected,
                    ]}
                  >
                    {primaryGoal === goalOption ? '▶ ' : '○ '} {goalOption}
                  </Text>
                </Pressable>
              ))}

              <Text style={[styles.label, { marginTop: 18 }]}>PHYSICAL PREPARATION LEVEL</Text>
              <View style={styles.row}>
                {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => (
                  <Pressable
                    key={lvl}
                    style={[
                      styles.chip,
                      fitnessLevel === lvl && styles.chipSelected,
                    ]}
                    onPress={() => setFitnessLevel(lvl)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        fitnessLevel === lvl && styles.chipTextSelected,
                      ]}
                    >
                      {lvl.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.label, { marginTop: 18 }]}>KNOWLEDGE DOMAIN</Text>
              <TextInput
                value={studyFocus}
                onChangeText={setStudyFocus}
                placeholder="e.g. Computer Science, Medical, Finance"
                placeholderTextColor="#3e6382"
                style={styles.input}
              />

              <View style={styles.buttonRow}>
                <Pressable style={styles.backButton} onPress={() => setStep(1)}>
                  <Text style={styles.backText}>BACK</Text>
                </Pressable>
                <Pressable style={[styles.primaryButton, { flex: 1 }]} onPress={nextFromStep2}>
                  <Text style={styles.buttonText}>NEXT ➔</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* STEP 3: VULNERABILITY & REST DAY */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>VULNERABILITY AUDIT</Text>
              <Text style={styles.subtitle}>
                The system requires transparency. Identify your primary resistance points.
              </Text>

              <Text style={styles.label}>BIGGEST OBSTACLE / SHADOW HABIT</Text>
              {[
                'Instagram Reels & Doomscrolling',
                'Procrastination & Avoidance of Hard Tasks',
                'Inconsistent Sleep & Chronic Fatigue',
                'Skipping Workouts & Poor Diet',
              ].map((opt) => (
                <Pressable
                  key={opt}
                  style={[
                    styles.optionButton,
                    weakness === opt && styles.optionSelected,
                  ]}
                  onPress={() => setWeakness(opt)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      weakness === opt && styles.optionTextSelected,
                    ]}
                  >
                    {weakness === opt ? '▶ ' : '○ '} {opt}
                  </Text>
                </Pressable>
              ))}

              <Text style={[styles.label, { marginTop: 20 }]}>
                REST DAY PROTOCOL (NO STAT DECAY PENALTY)
              </Text>
              <View style={styles.row}>
                {['Sunday', 'Saturday', 'Wednesday'].map((day) => (
                  <Pressable
                    key={day}
                    style={[styles.chip, restDay === day && styles.chipSelected]}
                    onPress={() => setRestDay(day)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        restDay === day && styles.chipTextSelected,
                      ]}
                    >
                      {day.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.buttonRow}>
                <Pressable style={styles.backButton} onPress={() => setStep(2)}>
                  <Text style={styles.backText}>BACK</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, { flex: 1 }]}
                  onPress={calculateAndShowAwakening}
                >
                  <Text style={styles.buttonText}>CALCULATE PENTAGON STATS ➔</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* STEP 4: AWAKENING SCREEN */}
          {step === 4 && generatedResult && (
            <View style={styles.stepContent}>
              <View style={styles.awakenedBadge}>
                <Text style={styles.awakenedBadgeText}>SYSTEM RECOGNITION CONFIRMED</Text>
              </View>

              <Text style={styles.titleCenter}>YOU HAVE AWAKENED</Text>
              <Text style={styles.titleAssigned}>[ {generatedResult.title} ]</Text>

              <Text style={styles.pentagonTitle}>INITIAL PENTAGON RADAR ATTRIBUTES</Text>
              <PentagonChart stats={generatedResult.stats} size={280} />

              <View style={styles.statPills}>
                <View style={styles.pill}>
                  <Text style={styles.pillLabel}>STR</Text>
                  <Text style={styles.pillVal}>{generatedResult.stats.strength}</Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillLabel}>KNW</Text>
                  <Text style={styles.pillVal}>{generatedResult.stats.knowledge}</Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillLabel}>DIS</Text>
                  <Text style={styles.pillVal}>{generatedResult.stats.discipline}</Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillLabel}>HLT</Text>
                  <Text style={styles.pillVal}>{generatedResult.stats.health}</Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillLabel}>MND</Text>
                  <Text style={styles.pillVal}>{generatedResult.stats.mindfulness}</Text>
                </View>
              </View>

              <Text style={styles.restNote}>
                Weekly Rest Protocol active on {restDay}s. Quests grant full XP.
              </Text>

              <Pressable style={styles.awakenButton} onPress={finalizeAwakening}>
                <Text style={styles.awakenButtonText}>ENTER HUNTER SYSTEM ➔</Text>
              </Pressable>
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
