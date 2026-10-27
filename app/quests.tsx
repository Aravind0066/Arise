import { useAppearance, useThemedStyles } from '../lib/AppearanceContext';
import React, { useCallback, useRef, useState } from 'react';
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
  const { theme } = useAppearance();
  const themedStyles = useThemedStyles(styles);
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
  const [recHasScanned, setRecHasScanned] = useState(false);
  const [skippedRecs, setSkippedRecs] = useState<string[]>([]);
  const hasAutoScanned = useRef(false);

  const fetchRecommendations = useCallback(async () => {
    setRecLoading(true);
    setRecError('');
    setRecFallback(false);
    setRecommendations([]);
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
      const currentQuests = await getHunterQuests();
      const recentQuests = [
        ...currentQuests.map((q) => ({ _id: q._id, status: q.status })),
        ...history.slice(0, 5).map((h) => ({ _id: h._id, status: 'completed' })),
      ];

      const preferredCategories = [
        profile?.primaryGoal?.toLowerCase().includes('fitness') ? 'Fitness' : 'Study',
        'Discipline',
      ];

      const payload = {
        goals,
        stats: statsRecord,
        recentQuests,
        availableMinutes: 45,
        preferredCategories,
        completedQuests: completedTitles,
        skippedQuests: skippedRecs,
        difficulty: profile?.fitnessLevel ?? 'Intermediate',
      };

      const res = await getWeaknessRecommendations(payload);
      const recList = res.recommendations ?? res.data;

      if (!res.success || !Array.isArray(recList)) {
        setRecError(res.error ?? 'No recommendations returned.');
        setRecHasScanned(true);
        return;
      }

      setRecommendations(recList);
      setRecFallback(res.fallback === true);
      setRecHasScanned(true);
    } catch (err: any) {
      setRecError(err.message || 'Failed to load recommendations.');
      setRecHasScanned(true);
    } finally {
      setRecLoading(false);
    }
  }, [skippedRecs]);

  const loadData = useCallback(async () => {
    const q = await getHunterQuests();
    setQuests(q);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      if (!hasAutoScanned.current) {
        hasAutoScanned.current = true;
        fetchRecommendations();
      }
    }, [loadData, fetchRecommendations])
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



  const handleAcceptRec = async (rec: WeaknessRecommendation) => {
    try {
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
    } catch (err: any) {
      setMessage(err?.message || 'Unable to accept directive');
      setTimeout(() => setMessage(''), 4000);
    }
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
        return { color: theme.error, icon: '⚔️', label: 'WORKOUT RAID', action: 'ENTER WORKOUT PREP ➔' };
      case 'STUDY':
        return { color: theme.accent, icon: '📜', label: 'STUDY SESSION', action: 'START STUDY BLOCK ➔' };
      case 'MINDFULNESS':
        return { color: theme.purple, icon: '🧘', label: 'MIND PROTOCOL', action: 'ENGAGE PROTOCOL ➔' };
      case 'HEALTH':
        return { color: theme.success, icon: '💧', label: 'HEALTH MATRIX', action: 'EXECUTE MATRIX ➔' };
      default:
        return { color: theme.warning, icon: '🛡️', label: 'DISCIPLINE', action: 'VERIFY CHALLENGE ➔' };
    }
  };

  return (
    <View style={themedStyles.root}>
      <SafeAreaView style={themedStyles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={themedStyles.content}>
          {/* Header */}
          <View style={themedStyles.header}>
            <View>
              <Text style={themedStyles.systemTag}>SYSTEM // QUEST DIRECTIVES</Text>
              <Text style={themedStyles.title}>ACTIVE DIRECTIVES</Text>
            </View>
            <Pressable
              style={themedStyles.customBtn}
              onPress={() => setShowCustomModal(true)}
            >
              <Text style={themedStyles.customBtnText}>+ CUSTOM</Text>
            </Pressable>
          </View>

          {/* AI Generator Panel (Preserved functionality, clean branding) */}
          <View style={themedStyles.aiPanel}>
            <View style={themedStyles.aiHeader}>
              <Text style={themedStyles.aiBadge}>ARISE DIRECTIVE GENERATOR</Text>
              <Text style={themedStyles.aiSubBadge}>EMBEDDED INTELLIGENCE</Text>
            </View>
            <Text style={themedStyles.aiPromptLabel}>WHAT IS YOUR TARGET OBJECTIVE?</Text>
            <TextInput
              value={goal}
              onChangeText={setGoal}
              placeholder="e.g. Master Dynamic Programming, 5km Tempo Run, Deep Sleep"
              placeholderTextColor={theme.textSecondary}
              style={themedStyles.aiInput}
            />

            <View style={themedStyles.aiOptionsRow}>
              <View style={themedStyles.optionCol}>
                <Text style={themedStyles.miniLabel}>DOMAIN</Text>
                <View style={themedStyles.miniChips}>
                  {(['Study', 'Fitness', 'Discipline', 'Health'] as const).map((c) => (
                    <Pressable
                      key={c}
                      style={[themedStyles.miniChip, aiCat === c && themedStyles.miniChipActive]}
                      onPress={() => setAiCat(c)}
                    >
                      <Text style={[themedStyles.miniChipText, aiCat === c && themedStyles.miniChipTextActive]}>
                        {c.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Pressable
              style={themedStyles.generateBtn}
              onPress={handleGenerateAi}
              disabled={loadingAi}
            >
              <Text style={themedStyles.generateBtnText}>
                {loadingAi ? 'CALIBRATING DIRECTIVES...' : 'SPAWN 3 DIRECTIVES ➔'}
              </Text>
            </Pressable>
          </View>

          {message ? (
            <View style={themedStyles.toast}>
              <Text style={themedStyles.toastText}>⚡ {message}</Text>
            </View>
          ) : null}

          {/* Weakness-Based Recommendations */}
          <View style={themedStyles.recPanel}>
            <View style={themedStyles.recHeader}>
              <View>
                <Text style={themedStyles.recTag}>SYSTEM // WEAKNESS ANALYSIS</Text>
                <Text style={themedStyles.recTitle}>RECOMMENDED DIRECTIVES</Text>
              </View>
              <Pressable
                style={themedStyles.recRefreshBtn}
                onPress={fetchRecommendations}
                disabled={recLoading}
              >
                <Text style={themedStyles.recRefreshBtnText}>
                  {recLoading ? '...' : '⟳ SCAN'}
                </Text>
              </Pressable>
            </View>

            {recFallback && (
              <View style={themedStyles.recFallbackBadge}>
                <Text style={themedStyles.recFallbackText}>⚠ OFFLINE MODE — EMBEDDED ENGINE ACTIVE</Text>
              </View>
            )}

            {recLoading && (
              <View style={themedStyles.recStateBox}>
                <Text style={themedStyles.recStateText}>ANALYZING WEAKNESS MATRIX...</Text>
              </View>
            )}

            {!recLoading && recError !== '' && (
              <View style={themedStyles.recStateBox}>
                <Text style={themedStyles.recErrorText}>{recError}</Text>
                <Pressable style={themedStyles.recRetryBtn} onPress={fetchRecommendations}>
                  <Text style={themedStyles.recRetryBtnText}>RETRY ⟳</Text>
                </Pressable>
              </View>
            )}

            {!recLoading && recError === '' && recommendations.length === 0 && (
              <View style={themedStyles.recStateBox}>
                <Text style={themedStyles.recStateText}>
                  {recHasScanned
                    ? 'No weakness directives available. Tap SCAN to retry.'
                    : 'Tap SCAN to generate weakness-based directives from your profile.'}
                </Text>
              </View>
            )}

            {!recLoading && recError === '' && recommendations.map((rec, idx) => (
              <View key={`${rec.title}_${idx}`} style={themedStyles.recCard}>
                <View style={themedStyles.recCardHeader}>
                  <View style={themedStyles.recCatBadge}>
                    <Text style={themedStyles.recCatBadgeText}>{rec.category.toUpperCase()}</Text>
                  </View>
                  <Text style={themedStyles.recXpText}>+{rec.suggestedReward} XP</Text>
                </View>
                <Text style={themedStyles.recCardTitle}>{rec.title}</Text>
                <Text style={themedStyles.recCardDesc}>{rec.description}</Text>
                <Text style={themedStyles.recDuration}>⏱ {rec.estimatedDuration} MIN · {rec.difficulty.toUpperCase()}</Text>
                <View style={themedStyles.recActions}>
                  <Pressable style={themedStyles.recSkipBtn} onPress={() => handleSkipRec(rec)}>
                    <Text style={themedStyles.recSkipBtnText}>SKIP</Text>
                  </Pressable>
                  <Pressable style={themedStyles.recAcceptBtn} onPress={() => handleAcceptRec(rec)}>
                    <Text style={themedStyles.recAcceptBtnText}>ACCEPT DIRECTIVE ➔</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          {/* Category Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={themedStyles.filterRow}
          >
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[themedStyles.filterChip, selectedCat === cat && themedStyles.filterChipActive]}
                onPress={() => setSelectedCat(cat)}
              >
                <Text style={[themedStyles.filterText, selectedCat === cat && themedStyles.filterTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Quests List */}
          <View style={themedStyles.list}>
            {filteredQuests.map((quest) => {
              const isCompleted = quest.status === 'completed';
              const theme = getCategoryTheme(quest.category);

              return (
                <View
                  key={quest._id}
                  style={[
                    themedStyles.questCard,
                    { borderLeftColor: theme.color, borderLeftWidth: 4 },
                    isCompleted && themedStyles.questCardCompleted,
                  ]}
                >
                  <View style={themedStyles.questHeader}>
                    <View style={[themedStyles.catBadge, { backgroundColor: `${theme.color}22`, borderColor: theme.color }]}>
                      <Text style={[themedStyles.catBadgeText, { color: theme.color }]}>
                        {theme.icon} {quest.category.toUpperCase()}
                      </Text>
                    </View>
                    <View style={themedStyles.xpBadge}>
                      <Text style={themedStyles.xpBadgeText}>+{quest.xpReward} XP</Text>
                    </View>
                  </View>

                  <Text style={[themedStyles.questTitle, isCompleted && themedStyles.questTitleDone]}>
                    {quest.title}
                  </Text>
                  <Text style={themedStyles.questDesc}>{quest.description}</Text>

                  <View style={themedStyles.questFooter}>
                    <Text style={themedStyles.statImpact}>
                      Target: +{quest.statBonus} {quest.targetStat?.toUpperCase()}
                    </Text>

                    {isCompleted ? (
                      <View style={themedStyles.completedTag}>
                        <Text style={themedStyles.completedTagText}>✓ VERIFIED & SEALED</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={[themedStyles.actionBtn, { borderColor: theme.color }]}
                        onPress={() => handleQuestAction(quest)}
                      >
                        <Text style={[themedStyles.actionBtnText, { color: theme.color }]}>
                          {theme.action}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}

            {filteredQuests.length === 0 && (
              <View style={themedStyles.emptyCard}>
                <Text style={themedStyles.emptyText}>
                  No directives found for {selectedCat}. Use the Generator above to spawn new quests!
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Custom Quest Creation Modal */}
        <Modal visible={showCustomModal} transparent animationType="slide">
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.modalCard}>
              <Text style={themedStyles.modalTitle}>CREATE CUSTOM DIRECTIVE</Text>
              <Text style={themedStyles.modalSub}>
                Inject a personal mission into your HunterOS HUD.
              </Text>

              <Text style={themedStyles.miniLabel}>DIRECTIVE NAME</Text>
              <TextInput
                value={customTitle}
                onChangeText={setCustomTitle}
                placeholder="e.g. READ 30 PAGES OF OPERATING SYSTEMS"
                placeholderTextColor={theme.textSecondary}
                style={themedStyles.modalInput}
              />

              <Text style={themedStyles.miniLabel}>DESCRIPTION / VERIFICATION CRITERIA</Text>
              <TextInput
                value={customDesc}
                onChangeText={setCustomDesc}
                placeholder="Specific action required to prove completion."
                placeholderTextColor={theme.textSecondary}
                style={themedStyles.modalInput}
              />

              <View style={themedStyles.statRow}>
                <View style={{ flex: 1 }}>
                  <Text style={themedStyles.miniLabel}>XP REWARD</Text>
                  <TextInput
                    value={customXp}
                    onChangeText={setCustomXp}
                    keyboardType="number-pad"
                    style={themedStyles.modalInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={themedStyles.miniLabel}>TARGET STAT</Text>
                  <View style={themedStyles.statChips}>
                    {(['strength', 'knowledge', 'discipline', 'health', 'mindfulness'] as const).map((s) => (
                      <Pressable
                        key={s}
                        style={[themedStyles.statChip, customStat === s && themedStyles.statChipActive]}
                        onPress={() => setCustomStat(s)}
                      >
                        <Text style={[themedStyles.statChipText, customStat === s && themedStyles.statChipTextActive]}>
                          {s.slice(0, 3).toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View style={themedStyles.modalBtns}>
                <Pressable
                  style={themedStyles.cancelBtn}
                  onPress={() => setShowCustomModal(false)}
                >
                  <Text style={themedStyles.cancelBtnText}>CANCEL</Text>
                </Pressable>
                <Pressable style={themedStyles.confirmBtn} onPress={handleCreateCustom}>
                  <Text style={themedStyles.confirmBtnText}>INJECT DIRECTIVE</Text>
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
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.actionModalCard}>
              <View style={themedStyles.actionModalHeader}>
                <Text style={themedStyles.actionModalTag}>
                  SYSTEM // {selectedQuestForAction?.category.toUpperCase()} PROTOCOL
                </Text>
                <Text style={themedStyles.actionModalTitle}>{selectedQuestForAction?.title}</Text>
                <Text style={themedStyles.actionModalDesc}>{selectedQuestForAction?.description}</Text>
              </View>

              <View style={themedStyles.actionCriteriaBox}>
                <Text style={themedStyles.actionCriteriaLabel}>VERIFICATION & LOGGING</Text>
                <Text style={themedStyles.actionCriteriaText}>
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
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  style={themedStyles.actionModalInput}
                />
              </View>

              <View style={themedStyles.rewardAccreditationRow}>
                <Text style={themedStyles.rewardAccreditText}>
                  Accreditation: +{selectedQuestForAction?.xpReward} XP · +{selectedQuestForAction?.statBonus}{' '}
                  {selectedQuestForAction?.targetStat.toUpperCase()}
                </Text>
              </View>

              <View style={themedStyles.modalBtns}>
                <Pressable
                  style={themedStyles.cancelBtn}
                  onPress={() => setSelectedQuestForAction(null)}
                >
                  <Text style={themedStyles.cancelBtnText}>DISMISS</Text>
                </Pressable>
                <Pressable
                  style={themedStyles.confirmBtn}
                  onPress={handleVerifyModalSubmit}
                  disabled={isVerifying}
                >
                  <Text style={themedStyles.confirmBtnText}>
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
