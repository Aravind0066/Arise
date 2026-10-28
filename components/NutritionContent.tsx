import { useAppearance, useThemedStyles } from '../lib/AppearanceContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from './BottomNavigation';
import { getNutritionRecommendations } from '../lib/api';
import { getHunterProfile, getNutritionHistory, saveNutritionHistoryRecord, getNutritionPreferences, saveNutritionPreferences } from '../lib/hunterStorage';
import type { HunterProfile, NutritionRecommendation } from '../lib/hunterTypes';
import { buildNutritionGenerationInput, DEFAULT_NUTRITION_PREFERENCES, type NutritionPreferences } from '../lib/nutritionGeneration';
import { useInternetConnectivity } from '../lib/ConnectivityContext';
import { classifyOnlineRequestFailure, onlineRequestErrorMessage } from '../lib/connectivityRules';
import { OfflineNotice } from './OfflineNotice';

export default function NutritionContent({ embedded = false }: { embedded?: boolean }) {
  const { theme } = useAppearance();
  const themedStyles = useThemedStyles(styles);
  const router = useRouter();
  const { status: internetStatus, refresh } = useInternetConnectivity();

  const [profile, setProfile] = useState<HunterProfile | null>(null);
  const [recs, setRecs] = useState<NutritionRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState<'offline' | 'backend' | 'ai' | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [nutritionPreferences, setNutritionPreferences] = useState<NutritionPreferences>(DEFAULT_NUTRITION_PREFERENCES);
  const [nutritionPreferencesLoaded, setNutritionPreferencesLoaded] = useState(false);
  const requestInFlight = useRef(false);

  // Load profile on focus for personalisation context
  const loadProfile = useCallback(async () => {
    const p = await getHunterProfile();
    setProfile(p);
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  useEffect(() => { void getNutritionPreferences().then((saved) => { setNutritionPreferences(saved); setNutritionPreferencesLoaded(true); }); }, []);
  useEffect(() => { if (nutritionPreferencesLoaded) void saveNutritionPreferences(nutritionPreferences); }, [nutritionPreferences, nutritionPreferencesLoaded]);

  useEffect(() => {
    let cancelled = false;
    void getNutritionHistory().then((history) => {
      if (cancelled || !history.length) return;
      const latest = history[0];
      setRecs(latest.recommendations);
      setIsFallback(latest.fallback);
      setHasFetched(true);
    });
    return () => { cancelled = true; };
  }, []);

  const fetchRecommendations = async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    setError('');
    setErrorKind(null);
    setIsFallback(false);
    try {
      const [savedHistory] = await Promise.all([getNutritionHistory(), saveNutritionPreferences(nutritionPreferences)]);
      const payload = buildNutritionGenerationInput(nutritionPreferences, profile?.primaryGoal, savedHistory);

      // Call typed API wrapper
      const res = await getNutritionRecommendations(payload);

      if (!res.success) {
        setError(res.error ?? 'Failed to load nutrition guidance.');
        return;
      }

      // The nutrition endpoint returns recommendations at the top level.
      const list = res.recommendations;
      await saveNutritionHistoryRecord({
        fitnessGoal: payload.fitnessGoal,
        dietaryPreferences: payload.dietaryPreferences,
        preparationTime: payload.prepTimeMinutes,
        inputs: payload,
        fallback: res.fallback === true,
        source: res.source,
        recommendations: list,
      });
      setRecs(list);
      setIsFallback(res.fallback === true);
      setHasFetched(true);
    } catch (err: any) {
      const currentStatus = await refresh();
      const failureKind = classifyOnlineRequestFailure(err, currentStatus);
      setErrorKind(failureKind);
      setError(failureKind === 'offline' ? '' : onlineRequestErrorMessage(err, currentStatus));
      setHasFetched(true);
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  };

  const content = (
    <View style={[themedStyles.content, embedded && themedStyles.embeddedContent]}>
          {/* Header */}
          <View style={themedStyles.header}>
            {!embedded ? <Pressable style={themedStyles.backBtn} onPress={() => router.back()}>
              <Text style={themedStyles.backBtnText}>← BACK</Text>
            </Pressable> : null}
            <View style={themedStyles.headerTextBlock}>
              <Text style={themedStyles.systemTag}>Nutrition</Text>
              <Text style={themedStyles.pageTitle}>NUTRITION MATRIX</Text>
            </View>
            <Pressable style={themedStyles.historyBtn} onPress={() => router.push('/nutrition-history' as any)}>
              <Text style={themedStyles.historyBtnText}>HISTORY</Text>
            </Pressable>
            <Pressable
              style={[
                themedStyles.refreshBtn,
                loading && themedStyles.refreshBtnDisabled,
                {
                  backgroundColor: loading ? theme.surfaceAlt : theme.surface,
                  borderColor: loading ? theme.border : theme.accent,
                },
              ]}
              onPress={fetchRecommendations}
              disabled={loading}
            >
              <Text style={[themedStyles.refreshBtnText, { color: loading ? theme.textSecondary : theme.accent }]}>
                {loading ? '...' : '⟳ SCAN'}
              </Text>
            </Pressable>
          </View>

          <OfflineNotice visible={internetStatus === 'offline'} />

          {/* Overview card */}
          <View style={themedStyles.overviewCard}>
            <Text style={themedStyles.overviewTitle}>FUEL THE HUNTER</Text>
            <Text style={themedStyles.overviewBody}>
              HunterOS generates personalised meal guidance based on your registered fitness goal and available preparation time.
              Results are general dietary suggestions — not medical advice.
            </Text>
            {profile?.primaryGoal ? (
              <View style={themedStyles.contextRow}>
                <Text style={themedStyles.contextLabel}>ACTIVE GOAL</Text>
                <Text style={themedStyles.contextValue}>{profile.primaryGoal}</Text>
              </View>
            ) : null}
            {profile?.fitnessLevel ? (
              <View style={themedStyles.contextRow}>
                <Text style={themedStyles.contextLabel}>FITNESS LEVEL</Text>
                <Text style={themedStyles.contextValue}>{profile.fitnessLevel.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>

          <View style={themedStyles.overviewCard}>
            <Text style={themedStyles.overviewTitle}>OPTIONAL MEAL DETAILS</Text>
            <TextInput value={nutritionPreferences.availableIngredients} onChangeText={(availableIngredients) => setNutritionPreferences((p) => ({ ...p, availableIngredients }))} placeholder="Ingredients (optional, comma separated)" placeholderTextColor={theme.textSecondary} style={themedStyles.input} />
            <Text style={themedStyles.formLabel}>COOKING TIME · OPTIONAL</Text>
            <View style={themedStyles.choiceRow}>{[10, 20, 30].map((minutes) => <Pressable key={minutes} onPress={() => setNutritionPreferences((p) => ({ ...p, preparationTime: p.preparationTime === minutes ? null : minutes }))} style={[themedStyles.choice, nutritionPreferences.preparationTime === minutes && themedStyles.choiceActive]}><Text style={themedStyles.choiceText}>{minutes} min</Text></Pressable>)}</View>
            <TextInput value={nutritionPreferences.dietaryPreferences} onChangeText={(dietaryPreferences) => setNutritionPreferences((p) => ({ ...p, dietaryPreferences }))} placeholder="Dietary preferences or restrictions (optional)" placeholderTextColor={theme.textSecondary} style={themedStyles.input} />
            <TextInput value={nutritionPreferences.fitnessGoal} onChangeText={(fitnessGoal) => setNutritionPreferences((p) => ({ ...p, fitnessGoal }))} placeholder={`Nutrition goal (optional; profile: ${profile?.primaryGoal || 'not recorded'})`} placeholderTextColor={theme.textSecondary} style={themedStyles.input} />
            <TextInput value={nutritionPreferences.budget} onChangeText={(budget) => setNutritionPreferences((p) => ({ ...p, budget }))} placeholder="Optional budget per meal" placeholderTextColor={theme.textSecondary} keyboardType="decimal-pad" style={themedStyles.input} />
            <Text style={themedStyles.formLabel}>PLAN</Text>
            <View style={themedStyles.choiceRow}>{([{ key: undefined, label: 'No preference' }, { key: 'one', label: 'One meal' }, { key: 'full-day', label: 'Full day' }] as const).map(({ key, label }) => <Pressable key={label} onPress={() => setNutritionPreferences((p) => ({ ...p, mealsToPlan: key }))} style={[themedStyles.choice, nutritionPreferences.mealsToPlan === key && themedStyles.choiceActive]}><Text style={themedStyles.choiceText}>{label}</Text></Pressable>)}</View>
          </View>

          {/* CTA when nothing fetched yet */}
          {!hasFetched && !loading && error === '' && (
            <View style={themedStyles.emptyState}>
              <Text style={themedStyles.emptyIcon}>🥗</Text>
              <Text style={themedStyles.emptyTitle}>NUTRITION SCAN READY</Text>
              <Text style={themedStyles.emptyBody}>
                Tap SCAN to generate meal guidance tailored to your hunter profile.
              </Text>
              <Pressable
                style={[themedStyles.primaryCta, { backgroundColor: theme.buttonBackground }]}
                onPress={fetchRecommendations}
              >
                <Text style={[themedStyles.primaryCtaText, { color: theme.buttonText }]}>GENERATE NUTRITION GUIDANCE ➔</Text>
              </Pressable>
            </View>
          )}

          {/* Loading */}
          {loading && (
            <View style={themedStyles.stateBox}>
              <Text style={themedStyles.stateIcon}>⚡</Text>
              <Text style={themedStyles.stateTitle}>CALIBRATING MEAL MATRIX...</Text>
              <Text style={themedStyles.stateBody}>Querying nutrition intelligence engine.</Text>
            </View>
          )}

          {/* Error */}
          {!loading && error !== '' && (
            <View style={themedStyles.errorBox}>
              <Text style={themedStyles.errorTitle}>
                ⚠ {errorKind === 'ai' ? 'HUNTER AI TEMPORARILY UNAVAILABLE' : 'HUNTER AI SERVER UNAVAILABLE'}
              </Text>
              <Text style={themedStyles.errorBody}>{error}</Text>
              <Pressable style={themedStyles.retryBtn} onPress={fetchRecommendations}>
                <Text style={themedStyles.retryBtnText}>RETRY SCAN ⟳</Text>
              </Pressable>
            </View>
          )}

          {/* Offline / server-fallback indicators */}
          {!loading && isFallback && recs.length > 0 && (
            <View style={themedStyles.fallbackBanner}>
              <Text style={themedStyles.fallbackBannerText}>
                ⚠ SERVER FALLBACK — THESE RESULTS WERE NOT GENERATED BY LIVE HUNTER AI
              </Text>
            </View>
          )}

          {/* Recommendations */}
          {!loading && recs.length > 0 && (
            <View style={themedStyles.recSection}>
              <Text style={themedStyles.recSectionTitle}>MEAL RECOMMENDATIONS</Text>
              {recs.map((rec, idx) => {
                const calories = rec.nutrition?.calories ?? rec.nutrition?.approximateCalories;
                const protein = rec.nutrition?.protein ?? rec.nutrition?.approximateProtein;
                return (
                <View key={`${rec.name}_${idx}`} style={themedStyles.recCard}>
                  {/* Meal name */}
                  <View style={themedStyles.recCardHeader}>
                    <Text style={themedStyles.recMealName}>{rec.name}</Text>
                    <View style={themedStyles.mealTypeBadge}>
                      <Text style={themedStyles.mealTypeBadgeText}>MEAL {idx + 1}</Text>
                    </View>
                  </View>
                  {rec.preparationTimeMinutes ? <Text style={themedStyles.portionLabel}>ABOUT {rec.preparationTimeMinutes} MINUTES</Text> : null}

                  {/* Portions */}
                  <View style={themedStyles.portionRow}>
                    <Text style={themedStyles.portionLabel}>PORTIONS</Text>
                    <Text style={themedStyles.portionValue}>{rec.portions}</Text>
                  </View>

                  {/* Ingredients */}
                  <Text style={themedStyles.sectionLabel}>INGREDIENTS</Text>
                  <View style={themedStyles.ingredientsList}>
                    {rec.ingredients.map((ing, i) => (
                      <View key={i} style={themedStyles.ingredientItem}>
                        <Text style={themedStyles.ingredientBullet}>▸</Text>
                        <Text style={themedStyles.ingredientText}>{ing}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Steps */}
                  <Text style={themedStyles.sectionLabel}>PREPARATION</Text>
                  <View style={themedStyles.stepsList}>
                    {rec.steps.map((step, i) => (
                      <View key={i} style={themedStyles.stepItem}>
                        <Text style={themedStyles.stepNumber}>{i + 1}.</Text>
                        <Text style={themedStyles.stepText}>{step}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Nutrition info if present */}
                  {rec.nutrition && (
                    <View style={themedStyles.nutritionBox}>
                      <Text style={themedStyles.nutritionLabel}>APPROXIMATE NUTRITION</Text>
                      <View style={themedStyles.nutritionRow}>
                        {calories !== undefined && (
                          <View style={themedStyles.nutritionStat}>
                            <Text style={themedStyles.nutritionStatValue}>{calories}</Text>
                            <Text style={themedStyles.nutritionStatKey}>CALORIES</Text>
                          </View>
                        )}
                        {protein !== undefined && (
                          <View style={themedStyles.nutritionStat}>
                            <Text style={themedStyles.nutritionStatValue}>{protein}{typeof protein === 'number' ? 'g' : ''}</Text>
                            <Text style={themedStyles.nutritionStatKey}>PROTEIN</Text>
                          </View>
                        )}
                        {rec.nutrition.carbohydrates !== undefined ? <View style={themedStyles.nutritionStat}><Text style={themedStyles.nutritionStatValue}>{rec.nutrition.carbohydrates}</Text><Text style={themedStyles.nutritionStatKey}>CARBS</Text></View> : null}
                        {rec.nutrition.fat !== undefined ? <View style={themedStyles.nutritionStat}><Text style={themedStyles.nutritionStatValue}>{rec.nutrition.fat}</Text><Text style={themedStyles.nutritionStatKey}>FAT</Text></View> : null}
                        {rec.nutrition.note && (
                          <Text style={themedStyles.nutritionNote}>{rec.nutrition.note}</Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Note / fallback label */}
                  {rec.note ? (
                    <View style={themedStyles.recNoteBox}>
                      <Text style={themedStyles.recNoteText}>ℹ {rec.note}</Text>
                    </View>
                  ) : null}
                  {rec.goalAlignment ? <Text style={themedStyles.recNoteText}>Goal fit: {rec.goalAlignment}</Text> : null}
                  {rec.substitutions?.length ? <Text style={themedStyles.recNoteText}>Optional swaps: {rec.substitutions.join(', ')}</Text> : null}
                </View>
                );
              })}
            </View>
          )}

          {/* Empty results after fetch */}
          {!loading && hasFetched && error === '' && recs.length === 0 && (
            <View style={themedStyles.stateBox}>
              <Text style={themedStyles.stateBody}>No recommendations returned. Try scanning again.</Text>
              <Pressable style={themedStyles.retryBtn} onPress={fetchRecommendations}>
                <Text style={themedStyles.retryBtnText}>RETRY ⟳</Text>
              </Pressable>
            </View>
          )}

          {/* Disclaimer */}
          <View style={themedStyles.disclaimer}>
            <Text style={themedStyles.disclaimerText}>
              Nutrition guidance is general in nature and not a substitute for professional dietary advice. Consult a qualified nutritionist for personalised medical recommendations.
            </Text>
          </View>

    </View>
  );

  if (embedded) return content;
  return (
    <View style={themedStyles.root}>
      <SafeAreaView style={themedStyles.safe} edges={['top']}>
        <ScrollView>{content}</ScrollView>
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
    paddingBottom: 100,
  },
  embeddedContent: { paddingTop: 2, paddingBottom: 20 },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
    gap: 10,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#0b1e30',
    borderWidth: 1,
    borderColor: '#1c3d5e',
  },
  backBtnText: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerTextBlock: {
    flex: 1,
  },
  historyBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: '#1c3d5e' },
  historyBtnText: { color: '#00f3ff', fontSize: 9, fontWeight: '900' },
  systemTag: {
    color: '#00f3ff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  pageTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  refreshBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0e2035',
    borderWidth: 1,
    borderColor: '#38ef7d',
  },
  refreshBtnDisabled: {
    borderColor: '#1d4a30',
    backgroundColor: '#071810',
  },
  refreshBtnText: {
    color: '#38ef7d',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  // Overview
  overviewCard: {
    backgroundColor: '#071626',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#163b5e',
    padding: 16,
    marginBottom: 16,
  },
  overviewTitle: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  overviewBody: {
    color: '#7094b2',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  input: { color: '#d7e8f5', borderWidth: 1, borderColor: '#1c3d5e', backgroundColor: '#04111e', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, marginTop: 7, fontSize: 11 },
  formLabel: { color: '#7094b2', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 10, marginBottom: 5 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 3 },
  choice: { borderWidth: 1, borderColor: '#1c3d5e', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8 },
  choiceActive: { borderColor: '#00f3ff', backgroundColor: '#0a2639' },
  choiceText: { color: '#c8dff0', fontSize: 10, fontWeight: '800' },
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#122d47',
    paddingTop: 8,
    marginTop: 4,
  },
  contextLabel: {
    color: '#4e7392',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  contextValue: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  // Empty / CTA state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  emptyBody: {
    color: '#4e7392',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  primaryCta: {
    backgroundColor: '#38ef7d',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 6,
  },
  primaryCtaText: {
    color: '#021008',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  // Loading / generic state
  stateBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  stateIcon: {
    fontSize: 28,
  },
  stateTitle: {
    color: '#00f3ff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  stateBody: {
    color: '#4e7392',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
  // Error
  errorBox: {
    backgroundColor: '#120609',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff5376',
    padding: 16,
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  errorTitle: {
    color: '#ff5376',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  errorBody: {
    color: '#c0748a',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff5376',
    backgroundColor: '#1a050a',
  },
  retryBtnText: {
    color: '#ff5376',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  // Fallback banner
  fallbackBanner: {
    backgroundColor: '#0f0d02',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbb03b',
    padding: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  fallbackBannerText: {
    color: '#fbb03b',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  // Recommendation section
  recSection: {
    gap: 14,
    marginBottom: 16,
  },
  recSectionTitle: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  recCard: {
    backgroundColor: '#071626',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#163b5e',
    borderLeftWidth: 4,
    borderLeftColor: '#38ef7d',
    padding: 16,
  },
  recCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  recMealName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
    flex: 1,
    marginRight: 8,
  },
  mealTypeBadge: {
    backgroundColor: '#38ef7d22',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38ef7d',
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  mealTypeBadgeText: {
    color: '#38ef7d',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  portionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0b1d30',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  portionLabel: {
    color: '#4e7392',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  portionValue: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '800',
  },
  sectionLabel: {
    color: '#4e7392',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 6,
    marginTop: 4,
  },
  ingredientsList: {
    gap: 4,
    marginBottom: 12,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  ingredientBullet: {
    color: '#38ef7d',
    fontSize: 10,
    marginTop: 1,
  },
  ingredientText: {
    color: '#a8c5df',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  stepsList: {
    gap: 6,
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepNumber: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '900',
    width: 18,
    marginTop: 1,
  },
  stepText: {
    color: '#8fb8d6',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  // Nutrition info block
  nutritionBox: {
    backgroundColor: '#0b1e30',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a3c5e',
    padding: 10,
    marginBottom: 10,
  },
  nutritionLabel: {
    color: '#4e7392',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  nutritionStat: {
    alignItems: 'center',
  },
  nutritionStatValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  nutritionStatKey: {
    color: '#4e7392',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
  },
  nutritionNote: {
    color: '#6a8fa8',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  // Per-rec note
  recNoteBox: {
    backgroundColor: '#0f1e10',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#fbb03b',
    padding: 8,
  },
  recNoteText: {
    color: '#a89370',
    fontSize: 10,
    lineHeight: 15,
  },
  // Disclaimer
  disclaimer: {
    marginTop: 8,
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#102030',
  },
  disclaimerText: {
    color: '#3a5e78',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
});
