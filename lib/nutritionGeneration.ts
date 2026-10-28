import type { NutritionHistoryRecord, NutritionInput } from './hunterTypes.ts';

export interface NutritionPreferences {
  availableIngredients: string;
  preparationTime: number | null;
  dietaryPreferences: string;
  fitnessGoal: string;
  budget: string;
  mealsToPlan?: 'one' | 'full-day';
}

export const DEFAULT_NUTRITION_PREFERENCES: NutritionPreferences = {
  availableIngredients: '', preparationTime: null, dietaryPreferences: '', fitnessGoal: '', budget: '',
};

export function createNutritionPreferencesStore(storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }, key: string) {
  return {
    async load(): Promise<NutritionPreferences> {
      try {
        const raw = await storage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') return { ...DEFAULT_NUTRITION_PREFERENCES, ...parsed };
      } catch { /* use empty optional inputs */ }
      return { ...DEFAULT_NUTRITION_PREFERENCES };
    },
    save(value: NutritionPreferences) { return storage.setItem(key, JSON.stringify(value)); },
  };
}

export function createNutritionHistoryStore(storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }, key: string) {
  return {
    async load(): Promise<NutritionHistoryRecord[]> {
      try {
        const raw = await storage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((record) => record && typeof record.id === 'string' && Array.isArray(record.recommendations)) : [];
      } catch { return []; }
    },
    async append(record: Omit<NutritionHistoryRecord, 'id' | 'createdAt'> & Partial<Pick<NutritionHistoryRecord, 'id' | 'createdAt'>>) {
      const history = await this.load();
      const saved: NutritionHistoryRecord = { ...record, id: record.id || `nutrition_${Date.now()}_${history.length}`, createdAt: record.createdAt || new Date().toISOString() };
      await storage.setItem(key, JSON.stringify([saved, ...history]));
      return saved;
    },
  };
}

const splitList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

export function buildNutritionGenerationInput(preferences: NutritionPreferences, profileGoal: string | undefined, history: NutritionHistoryRecord[]): NutritionInput {
  const goal = preferences.fitnessGoal.trim() || profileGoal?.trim() || undefined;
  const dietaryPreferences = splitList(preferences.dietaryPreferences);
  const availableIngredients = splitList(preferences.availableIngredients);
  const budget = Number(preferences.budget);
  const priorPlans = history.slice(0, 5).map(({ createdAt, fitnessGoal, recommendations, inputs }) => ({
    createdAt, fitnessGoal: fitnessGoal ?? inputs?.fitnessGoal,
    meals: recommendations.map(({ name }) => name),
    inputs: inputs ? { availableIngredients: inputs.availableIngredients, prepTimeMinutes: inputs.prepTimeMinutes, mealsToPlan: inputs.mealsToPlan } : undefined,
  }));
  return {
    ...(goal ? { fitnessGoal: goal } : {}),
    ...(dietaryPreferences.length ? { dietaryPreferences } : {}),
    ...(dietaryPreferences.length ? { restrictions: dietaryPreferences } : {}),
    ...(availableIngredients.length ? { availableIngredients } : {}),
    ...(preferences.preparationTime ? { prepTimeMinutes: preferences.preparationTime, preparationTime: preferences.preparationTime } : {}),
    ...(Number.isFinite(budget) && budget > 0 ? { budget } : {}),
    ...(preferences.mealsToPlan ? { mealsToPlan: preferences.mealsToPlan } : {}),
    context: {
      previousSavedPlans: priorPlans,
      foodLogs: { available: false, entries: null },
      nutritionTargets: { available: false, values: null },
    },
  };
}
