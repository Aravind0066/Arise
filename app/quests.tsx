import React, { useCallback, useState } from 'react';
import {
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
import { generateQuests, getWeaknessRecommendations } from '../lib/api';
import {
  addHunterQuests,
  completeHunterQuest,
  getHunterHistory,
  getHunterProfile,
  getHunterQuests,
  getHunterStats,
  recordStudyCompletion,
} from '../lib/hunterStorage';
import { HunterQuest, StatType, WeaknessRecommendation } from '../lib/hunterTypes';

const CATEGORIES = ['ALL', 'FITNESS', 'STUDY', 'DISCIPLINE', 'HEALTH', 'MINDFULNESS'] as const;

export default function QuestsScreen() {
  const router = useRouter();
  const [quests, setQuests] = useState<HunterQuest[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [message, setMessage] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  // AI input states
  const [goal, setGoal] = useState('');
  const [aiCat, setAiCat] = useState<'Fitness' | 'Study' | 'Discipline' | 'Health' | 'Mindfulness'>('Study');
  const [aiMinutes, setAiMinutes] = useState('45');
  const [aiDifficulty, setAiDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');

  // Custom Quest Modal
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customXp, setCustomXp] = useState('50');
  const [customStat, setCustomStat] = useState<StatType>('discipline');

  // Interactive Verification Modal (For non-fitness quests)
  const [selectedQuestForAction, setSelectedQuestForAction] = useState<HunterQuest | null>(null);
  const [verificationNote, setVerificationNote] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Weakness recommendations state
  const [recommendations, setRecommendations] = useState<WeaknessRecommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState('');
  const [recFallback, setRecFallback] = useState(false);
  const [skippedRecs, setSkippedRecs] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    const q = await getHunterQuests();
    setQuests(q);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleQuestAction = (quest: HunterQuest) => {
    if (quest.status === 'completed') return;

    if (quest.category.toUpperCase() === 'FITNESS') {
      // Navigate to dedicated workout preparation & execution flow
      router.push({
        pathname: '/workout',
        params: {
          questId: quest._id,
          workoutTitle: quest.title,
        },
      });
      return;
    }

    // For other categories, open dedicated interactive verification modal
    setSelectedQuestForAction(quest);
    setVerificationNote('');
  };

  const handleVerifyModalSubmit = async () => {
    if (!selectedQuestForAction || isVerifying) return;
    setIsVerifying(true);

    try {
      if (selectedQuestForAction.category === 'Study') {
        const res = await recordStudyCompletion({
          topic: selectedQuestForAction.title,
          durationMinutes: 45,
          questId: selectedQuestForAction._id,
          xpReward: selectedQuestForAction.xpReward,
        });
        setMessage(`STUDY DIRECTIVE VERIFIED: +${selectedQuestForAction.xpReward} XP · KNOWLEDGE +4`);
      } else {
        const res = await completeHunterQuest(selectedQuestForAction._id);
        setMessage(`DIRECTIVE VERIFIED: +${res.quest.xpReward} XP · ${res.quest.targetStat.toUpperCase()} +${res.quest.statBonus}`);
      }

      setQuests((prev) =>
        prev.map((q) =>
          q._id === selectedQuestForAction._id ? { ...q, status: 'completed' } : q
        )
      );
      setSelectedQuestForAction(null);
      setTimeout(() => setMessage(''), 4500);
    } catch (err: any) {
      setMessage(err.message || 'Verification failed');
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchRecommendations = async () => {
    setRecLoading(true);
    setRecError('');
    setRecFallback(false);
    try {
      const profile = await getHunterProfile();
      const stats = await getHunterStats();
      const history = await getHunterHistory();

      const goals: string[] = [];
      if (profile?.primaryGoal) goals.push(profile.primaryGoal);
      if (profile?.studyFocus) goals.push(profile.studyFocus);
      if (goals.length === 0) goals.push('General self-improvement');

      const statsRecord: Record<string, number> = {
        strength: stats.strength,
        knowledge: stats.knowledge,
        discipline: stats.discipline,
        health: stats.health,
        mindfulness: stats.mindfulness,
      };

      const completedTitles = history.map((h) => h.title);

      const payload = {
        goals,
        stats: statsRecord,
        completedQuests: completedTitles,
        skippedQuests: skippedRecs,
        difficulty: profile?.fitnessLevel ?? 'Intermediate',
      };

      const res = await getWeaknessRecommendations(payload);

      if (!res.success || !res.data) {
        setRecError(res.error ?? 'No recommendations returned.');
        return;
      }

      setRecommendations(res.data);
      setRecFallback(res.fallback === true);
    } catch (err: any) {
      setRecError(err.message || 'Failed to load recommendations.');
    } finally {
      setRecLoading(false);
    }
  };

  const handleAcceptRec = async (rec: WeaknessRecommendation) => {
    const currentQuests = await getHunterQuests();
    const titleUpper = rec.title.toUpperCase();
    const duplicate = currentQuests.some((q) => q.title.toUpperCase() === titleUpper);
    if (duplicate) {
      setMessage('DIRECTIVE ALREADY IN HUD');
      setTimeout(() => setMessage(''), 3000);
      setRecommendations((prev) => prev.filter((r) => r.title !== rec.title));
      return;
    }

    let category: HunterQuest['category'] = 'General';
    const catLower = (rec.category || '').toLowerCase();
    if (catLower.includes('fit') || catLower.includes('strength')) category = 'Fitness';
    else if (catLower.includes('study') || catLower.includes('know')) category = 'Study';
    else if (catLower.includes('mind')) category = 'Mindfulness';
    else if (catLower.includes('health')) category = 'Health';
    else if (catLower.includes('disc')) category = 'Discipline';

    let targetStat: StatType = 'discipline';
    if (category === 'Fitness') targetStat = 'strength';
    else if (category === 'Study') targetStat = 'knowledge';
    else if (category === 'Health') targetStat = 'health';
    else if (category === 'Mindfulness') targetStat = 'mindfulness';

    const newQuest: HunterQuest = {
      _id: `weakness_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: titleUpper,
      description: rec.description,
      category,
      targetStat,
      statBonus: 3,
      xpReward: rec.suggestedReward,
      deadline: rec.deadline,
      generatedBy: 'ai',
      status: 'active',
    };

    const updated = await addHunterQuests([newQuest]);
    setQuests(updated);
    setRecommendations((prev) => prev.filter((r) => r.title !== rec.title));
    setMessage('WEAKNESS DIRECTIVE INJECTED INTO HUD');
    setTimeout(() => setMessage(''), 4000);
  };

  const handleSkipRec = (rec: WeaknessRecommendation) => {
    setSkippedRecs((prev) => [...prev, rec.title]);
    setRecommendations((prev) => prev.filter((r) => r.title !== rec.title));
  };

  const handleGenerateAi = async () => {
    if (!goal.trim()) {
      setMessage('Specify an objective or target domain first.');
      return;
    }
    setLoadingAi(true);
    setMessage('');
    try {
      const result = await generateQuests({
        goal: goal.trim(),
        category: aiCat,
        availableMinutes: Number(aiMinutes) || 45,
        difficulty: aiDifficulty,
      });

      const updated = await addHunterQuests(result.data);
      setQuests(updated);
      setGoal('');
      setMessage(`3 SYSTEM DIRECTIVES SPAWNED INTO MATRIX`);
      setTimeout(() => setMessage(''), 5000);
    } catch (error: any) {
      setMessage(error.message || 'Generation failed');
    } finally {
      setLoadingAi(false);
    }
  };

  const handleCreateCustom = async () => {
    if (!customTitle.trim()) return;

    let targetCat: any = 'Discipline';
    if (customStat === 'strength') targetCat = 'Fitness';
    else if (customStat === 'knowledge') targetCat = 'Study';
    else if (customStat === 'health') targetCat = 'Health';
    else if (customStat === 'mindfulness') targetCat = 'Mindfulness';

    const newQuest: HunterQuest = {
      _id: `custom_${Date.now()}`,
      title: customTitle.trim().toUpperCase(),
      description: customDesc.trim() || 'Hunter self-assigned directive.',
      category: targetCat,
      targetStat: customStat,
      statBonus: 3,
      xpReward: Number(customXp) || 40,
      deadline: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
      generatedBy: 'user',
      status: 'active',
    };

    const updated = await addHunterQuests([newQuest]);
    setQuests(updated);
    setShowCustomModal(false);
    setCustomTitle('');
    setCustomDesc('');
    setMessage('CUSTOM DIRECTIVE INJECTED INTO HUD');
    setTimeout(() => setMessage(''), 4000);
  };

  const filteredQuests = quests.filter((q) => {
    if (selectedCat === 'ALL') return true;
    return q.category.toUpperCase() === selectedCat;
  });

  const getCategoryTheme = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'FITNESS':
        return { color: '#ff5376', icon: '⚔️', label: 'WORKOUT RAID', action: 'ENTER WORKOUT PREP ➔' };
      case 'STUDY':
        return { color: '#6de7ff', icon: '📜', label: 'STUDY SESSION', action: 'START STUDY BLOCK ➔' };
      case 'MINDFULNESS':
        return { color: '#c084fc', icon: '🧘', label: 'MIND PROTOCOL', action: 'ENGAGE PROTOCOL ➔' };
      case 'HEALTH':
        return { color: '#38ef7d', icon: '💧', label: 'HEALTH MATRIX', action: 'EXECUTE MATRIX ➔' };
      default:
        return { color: '#fbb03b', icon: '🛡️', label: 'DISCIPLINE', action: 'VERIFY CHALLENGE ➔' };
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.systemTag}>SYSTEM // QUEST DIRECTIVES</Text>
              <Text style={styles.title}>ACTIVE DIRECTIVES</Text>
            </View>
            <Pressable
              style={styles.customBtn}
              onPress={() => setShowCustomModal(true)}
            >
              <Text style={styles.customBtnText}>+ CUSTOM</Text>
            </Pressable>
          </View>

          {/* AI Generator Panel (Preserved functionality, clean branding) */}
          <View style={styles.aiPanel}>
            <View style={styles.aiHeader}>
              <Text style={styles.aiBadge}>ARISE DIRECTIVE GENERATOR</Text>
              <Text style={styles.aiSubBadge}>EMBEDDED INTELLIGENCE</Text>
            </View>
            <Text style={styles.aiPromptLabel}>WHAT IS YOUR TARGET OBJECTIVE?</Text>
            <TextInput
              value={goal}
              onChangeText={setGoal}
              placeholder="e.g. Master Dynamic Programming, 5km Tempo Run, Deep Sleep"
              placeholderTextColor="#3e6382"
              style={styles.aiInput}
            />

            <View style={styles.aiOptionsRow}>
              <View style={styles.optionCol}>
                <Text style={styles.miniLabel}>DOMAIN</Text>
                <View style={styles.miniChips}>
                  {(['Study', 'Fitness', 'Discipline', 'Health'] as const).map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.miniChip, aiCat === c && styles.miniChipActive]}
                      onPress={() => setAiCat(c)}
                    >
                      <Text style={[styles.miniChipText, aiCat === c && styles.miniChipTextActive]}>
                        {c.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Pressable
              style={styles.generateBtn}
              onPress={handleGenerateAi}
              disabled={loadingAi}
            >
              <Text style={styles.generateBtnText}>
                {loadingAi ? 'CALIBRATING DIRECTIVES...' : 'SPAWN 3 DIRECTIVES ➔'}
              </Text>
            </Pressable>
          </View>

          {message ? (
            <View style={styles.toast}>
              <Text style={styles.toastText}>⚡ {message}</Text>
            </View>
          ) : null}

          {/* Weakness-Based Recommendations */}
          <View style={styles.recPanel}>
            <View style={styles.recHeader}>
              <View>
                <Text style={styles.recTag}>SYSTEM // WEAKNESS ANALYSIS</Text>
                <Text style={styles.recTitle}>RECOMMENDED DIRECTIVES</Text>
              </View>
              <Pressable
                style={styles.recRefreshBtn}
                onPress={fetchRecommendations}
                disabled={recLoading}
              >
                <Text style={styles.recRefreshBtnText}>
                  {recLoading ? '...' : '⟳ SCAN'}
                </Text>
              </Pressable>
            </View>

            {recFallback && (
              <View style={styles.recFallbackBadge}>
                <Text style={styles.recFallbackText}>⚠ OFFLINE MODE — EMBEDDED ENGINE ACTIVE</Text>
              </View>
            )}

            {recLoading && (
              <View style={styles.recStateBox}>
                <Text style={styles.recStateText}>ANALYZING WEAKNESS MATRIX...</Text>
              </View>
            )}

            {!recLoading && recError !== '' && (
              <View style={styles.recStateBox}>
                <Text style={styles.recErrorText}>{recError}</Text>
                <Pressable style={styles.recRetryBtn} onPress={fetchRecommendations}>
                  <Text style={styles.recRetryBtnText}>RETRY ⟳</Text>
                </Pressable>
              </View>
            )}

            {!recLoading && recError === '' && recommendations.length === 0 && (
              <View style={styles.recStateBox}>
                <Text style={styles.recStateText}>
                  Tap SCAN to generate weakness-based directives from your profile.
                </Text>
              </View>
            )}

            {!recLoading && recommendations.map((rec, idx) => (
              <View key={`${rec.title}_${idx}`} style={styles.recCard}>
                <View style={styles.recCardHeader}>
                  <View style={styles.recCatBadge}>
                    <Text style={styles.recCatBadgeText}>{rec.category.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.recXpText}>+{rec.suggestedReward} XP</Text>
                </View>
                <Text style={styles.recCardTitle}>{rec.title}</Text>
                <Text style={styles.recCardDesc}>{rec.description}</Text>
                <Text style={styles.recDuration}>⏱ {rec.estimatedDuration} MIN · {rec.difficulty.toUpperCase()}</Text>
                <View style={styles.recActions}>
                  <Pressable style={styles.recSkipBtn} onPress={() => handleSkipRec(rec)}>
                    <Text style={styles.recSkipBtnText}>SKIP</Text>
                  </Pressable>
                  <Pressable style={styles.recAcceptBtn} onPress={() => handleAcceptRec(rec)}>
                    <Text style={styles.recAcceptBtnText}>ACCEPT DIRECTIVE ➔</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          {/* Category Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[styles.filterChip, selectedCat === cat && styles.filterChipActive]}
                onPress={() => setSelectedCat(cat)}
              >
                <Text style={[styles.filterText, selectedCat === cat && styles.filterTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Quests List */}
          <View style={styles.list}>
            {filteredQuests.map((quest) => {
              const isCompleted = quest.status === 'completed';
              const theme = getCategoryTheme(quest.category);

              return (
                <View
                  key={quest._id}
                  style={[
                    styles.questCard,
                    { borderLeftColor: theme.color, borderLeftWidth: 4 },
                    isCompleted && styles.questCardCompleted,
                  ]}
                >
                  <View style={styles.questHeader}>
                    <View style={[styles.catBadge, { backgroundColor: `${theme.color}22`, borderColor: theme.color }]}>
                      <Text style={[styles.catBadgeText, { color: theme.color }]}>
                        {theme.icon} {quest.category.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.xpBadge}>
                      <Text style={styles.xpBadgeText}>+{quest.xpReward} XP</Text>
                    </View>
                  </View>

                  <Text style={[styles.questTitle, isCompleted && styles.questTitleDone]}>
                    {quest.title}
                  </Text>
                  <Text style={styles.questDesc}>{quest.description}</Text>

                  <View style={styles.questFooter}>
                    <Text style={styles.statImpact}>
                      Target: +{quest.statBonus} {quest.targetStat?.toUpperCase()}
                    </Text>

                    {isCompleted ? (
                      <View style={styles.completedTag}>
                        <Text style={styles.completedTagText}>✓ VERIFIED & SEALED</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={[styles.actionBtn, { borderColor: theme.color }]}
                        onPress={() => handleQuestAction(quest)}
                      >
                        <Text style={[styles.actionBtnText, { color: theme.color }]}>
                          {theme.action}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}

            {filteredQuests.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No directives found for {selectedCat}. Use the Generator above to spawn new quests!
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Custom Quest Creation Modal */}
        <Modal visible={showCustomModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>CREATE CUSTOM DIRECTIVE</Text>
              <Text style={styles.modalSub}>
                Inject a personal mission into your HunterOS HUD.
              </Text>

              <Text style={styles.miniLabel}>DIRECTIVE NAME</Text>
              <TextInput
                value={customTitle}
                onChangeText={setCustomTitle}
                placeholder="e.g. READ 30 PAGES OF OPERATING SYSTEMS"
                placeholderTextColor="#3e6382"
                style={styles.modalInput}
              />

              <Text style={styles.miniLabel}>DESCRIPTION / VERIFICATION CRITERIA</Text>
              <TextInput
                value={customDesc}
                onChangeText={setCustomDesc}
                placeholder="Specific action required to prove completion."
                placeholderTextColor="#3e6382"
                style={styles.modalInput}
              />

              <View style={styles.statRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>XP REWARD</Text>
                  <TextInput
                    value={customXp}
                    onChangeText={setCustomXp}
                    keyboardType="number-pad"
                    style={styles.modalInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>TARGET STAT</Text>
                  <View style={styles.statChips}>
                    {(['strength', 'knowledge', 'discipline', 'health', 'mindfulness'] as const).map((s) => (
                      <Pressable
                        key={s}
                        style={[styles.statChip, customStat === s && styles.statChipActive]}
                        onPress={() => setCustomStat(s)}
                      >
                        <Text style={[styles.statChipText, customStat === s && styles.statChipTextActive]}>
                          {s.slice(0, 3).toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.modalBtns}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setShowCustomModal(false)}
                >
                  <Text style={styles.cancelBtnText}>CANCEL</Text>
                </Pressable>
                <Pressable style={styles.confirmBtn} onPress={handleCreateCustom}>
                  <Text style={styles.confirmBtnText}>INJECT DIRECTIVE</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Dedicated Activity Verification Modal for Study / Mindfulness / Discipline */}
        <Modal
          visible={selectedQuestForAction !== null}
          transparent
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.actionModalCard}>
              <View style={styles.actionModalHeader}>
                <Text style={styles.actionModalTag}>
                  SYSTEM // {selectedQuestForAction?.category.toUpperCase()} PROTOCOL
                </Text>
                <Text style={styles.actionModalTitle}>{selectedQuestForAction?.title}</Text>
                <Text style={styles.actionModalDesc}>{selectedQuestForAction?.description}</Text>
              </View>

              <View style={styles.actionCriteriaBox}>
                <Text style={styles.actionCriteriaLabel}>VERIFICATION & LOGGING</Text>
                <Text style={styles.actionCriteriaText}>
                  {selectedQuestForAction?.category === 'Study'
                    ? 'State the key algorithm, system concept, or problem solved:'
                    : selectedQuestForAction?.category === 'Mindfulness'
                    ? 'Record your core reflection or state of mindfulness:'
                    : 'Confirm completion of this discipline protocol:'}
                </Text>
                <TextInput
                  value={verificationNote}
                  onChangeText={setVerificationNote}
                  placeholder="e.g. Mastered binary search invariant, zero distractions maintained..."
                  placeholderTextColor="#3e6382"
                  multiline
                  style={styles.actionModalInput}
                />
              </View>

              <View style={styles.rewardAccreditationRow}>
                <Text style={styles.rewardAccreditText}>
                  Accreditation: +{selectedQuestForAction?.xpReward} XP · +{selectedQuestForAction?.statBonus}{' '}
                  {selectedQuestForAction?.targetStat.toUpperCase()}
                </Text>
              </View>

              <View style={styles.modalBtns}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setSelectedQuestForAction(null)}
                >
                  <Text style={styles.cancelBtnText}>DISMISS</Text>
                </Pressable>
                <Pressable
                  style={styles.confirmBtn}
                  onPress={handleVerifyModalSubmit}
                  disabled={isVerifying}
                >
                  <Text style={styles.confirmBtnText}>
                    {isVerifying ? 'VERIFYING...' : 'CONFIRM & SEAL DIRECTIVE ➔'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <BottomNavigation active="quests" />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  customBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#0f2438',
    borderWidth: 1,
    borderColor: '#194970',
  },
  customBtnText: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  aiPanel: {
    backgroundColor: '#071626',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#163b5e',
    padding: 16,
    marginBottom: 16,
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiBadge: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  aiSubBadge: {
    color: '#527c9f',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  aiPromptLabel: {
    color: '#7fa2be',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  aiInput: {
    backgroundColor: '#0c1f33',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#19446e',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    marginBottom: 12,
  },
  aiOptionsRow: {
    marginBottom: 14,
  },
  optionCol: {
    flex: 1,
  },
  miniChips: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  miniChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#0d2238',
    borderWidth: 1,
    borderColor: '#183c61',
  },
  miniChipActive: {
    backgroundColor: '#00f3ff22',
    borderColor: '#00f3ff',
  },
  miniChipText: {
    color: '#658cae',
    fontSize: 9,
    fontWeight: '800',
  },
  miniChipTextActive: {
    color: '#00f3ff',
    fontWeight: '900',
  },
  generateBtn: {
    backgroundColor: '#00f3ff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  generateBtnText: {
    color: '#02111d',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  toast: {
    backgroundColor: '#0b233a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00f3ff',
    padding: 10,
    marginBottom: 14,
  },
  toastText: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  filterRow: {
    gap: 8,
    paddingBottom: 14,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
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
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  filterTextActive: {
    color: '#02111d',
  },
  list: {
    gap: 12,
  },
  questCard: {
    backgroundColor: '#081423',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#173654',
    padding: 16,
  },
  questCardCompleted: {
    opacity: 0.5,
    backgroundColor: '#050d18',
  },
  questHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  catBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  xpBadge: {
    backgroundColor: '#0f2740',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  xpBadgeText: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '900',
  },
  questTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    marginBottom: 6,
  },
  questTitleDone: {
    textDecorationLine: 'line-through',
    color: '#557591',
  },
  questDesc: {
    color: '#7b9cb8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  questFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#122c47',
    paddingTop: 10,
  },
  statImpact: {
    color: '#5883a4',
    fontSize: 10,
    fontWeight: '800',
  },
  completedTag: {
    backgroundColor: '#0e2b1f',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  completedTagText: {
    color: '#38ef7d',
    fontSize: 10,
    fontWeight: '900',
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#081728',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#4e7392',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 12, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#071626',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#194570',
    padding: 20,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  modalSub: {
    color: '#6e93b2',
    fontSize: 11,
    marginBottom: 14,
  },
  miniLabel: {
    color: '#547f9f',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  modalInput: {
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
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statChips: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  statChip: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#0d2238',
    borderWidth: 1,
    borderColor: '#183c61',
  },
  statChipActive: {
    backgroundColor: '#00f3ff22',
    borderColor: '#00f3ff',
  },
  statChipText: {
    color: '#658cae',
    fontSize: 8,
    fontWeight: '800',
  },
  statChipTextActive: {
    color: '#00f3ff',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
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

  // Dedicated Action Modal
  actionModalCard: {
    width: '100%',
    backgroundColor: '#071626',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#00f3ff',
    padding: 20,
  },
  actionModalHeader: {
    marginBottom: 14,
  },
  actionModalTag: {
    color: '#00f3ff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  actionModalTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  actionModalDesc: {
    color: '#7c9cb6',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  actionCriteriaBox: {
    backgroundColor: '#0a1d30',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#173f67',
    padding: 12,
    marginBottom: 12,
  },
  actionCriteriaLabel: {
    color: '#6290b2',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  actionCriteriaText: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  actionModalInput: {
    backgroundColor: '#071524',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#16385a',
    padding: 10,
    color: '#ffffff',
    fontSize: 12,
    minHeight: 60,
  },
  rewardAccreditationRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  rewardAccreditText: {
    color: '#ffd700',
    fontSize: 11,
    fontWeight: '800',
  },
  // Weakness Recommendations
  recPanel: {
    backgroundColor: '#06121f',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1a3d62',
    padding: 14,
    marginBottom: 16,
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recTag: {
    color: '#fbb03b',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  recTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  recRefreshBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0e2035',
    borderWidth: 1,
    borderColor: '#fbb03b',
  },
  recRefreshBtnText: {
    color: '#fbb03b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  recFallbackBadge: {
    backgroundColor: '#1a1000',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fbb03b',
    padding: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  recFallbackText: {
    color: '#fbb03b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  recStateBox: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  recStateText: {
    color: '#4e7392',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
  recErrorText: {
    color: '#ff5376',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
  recRetryBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff5376',
    backgroundColor: '#1a050a',
  },
  recRetryBtnText: {
    color: '#ff5376',
    fontSize: 10,
    fontWeight: '900',
  },
  recCard: {
    backgroundColor: '#081628',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fbb03b44',
    borderLeftWidth: 4,
    borderLeftColor: '#fbb03b',
    padding: 12,
    marginBottom: 8,
  },
  recCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  recCatBadge: {
    backgroundColor: '#fbb03b22',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#fbb03b',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  recCatBadgeText: {
    color: '#fbb03b',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  recXpText: {
    color: '#fbb03b',
    fontSize: 11,
    fontWeight: '900',
  },
  recCardTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginBottom: 4,
  },
  recCardDesc: {
    color: '#7b9cb8',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  recDuration: {
    color: '#547f9f',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  recActions: {
    flexDirection: 'row',
    gap: 8,
  },
  recSkipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#2a4a68',
    backgroundColor: '#0a1d30',
  },
  recSkipBtnText: {
    color: '#4e7392',
    fontSize: 10,
    fontWeight: '900',
  },
  recAcceptBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 7,
    backgroundColor: '#fbb03b',
    alignItems: 'center',
  },
  recAcceptBtnText: {
    color: '#0a0800',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
