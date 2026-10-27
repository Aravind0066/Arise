// Nutrition recommendation controller
// Exposes POST /api/nutrition
// Uses Gemini service for AI generation with deterministic fallback.

const geminiService = require('../services/geminiService');

/**
 * Expected body (all fields optional, but at least one must be present):
 * {
 *   fitnessGoal?: string,
 *   dietaryPreferences?: string[],
 *   allergies?: string[],
 *   restrictions?: string[],
 *   budget?: number, // approximate per‑meal budget in local currency
 *   availableIngredients?: string[],
 *   mealType?: string, // e.g., breakfast, lunch, dinner, snack
 *   prepTimeMinutes?: number
 * }
 */
async function generateNutritionRecommendations(req, res) {
  const {
    fitnessGoal,
    dietaryPreferences,
    allergies,
    restrictions,
    budget,
    availableIngredients,
    mealType,
    prepTimeMinutes,
    preparationTime,
  } = req.body || {};

  const effectivePrepMinutes = prepTimeMinutes !== undefined ? prepTimeMinutes : preparationTime;

  // At least one of the optional fields must be supplied
  if (
    (fitnessGoal === undefined || fitnessGoal === null || String(fitnessGoal).trim().length === 0) &&
    (!dietaryPreferences || dietaryPreferences.length === 0) &&
    (!allergies || allergies.length === 0) &&
    (!restrictions || restrictions.length === 0) &&
    budget === undefined &&
    (!availableIngredients || availableIngredients.length === 0) &&
    mealType === undefined &&
    effectivePrepMinutes === undefined
  ) {
    return res.status(400).json({
      success: false,
      error: 'At least one nutrition input field must be provided.',
    });
  }

  // Build prompt for Gemini
  const promptLines = [];
  promptLines.push('You are the HunterOS nutrition recommendation AI. Provide practical meal suggestions respecting the constraints supplied.');
  if (fitnessGoal) promptLines.push(`Fitness goal: ${fitnessGoal}`);
  if (dietaryPreferences && dietaryPreferences.length) promptLines.push(`Dietary preferences: ${dietaryPreferences.join(', ')}`);
  if (allergies && allergies.length) promptLines.push(`Allergies (must be excluded): ${allergies.join(', ')}`);
  if (restrictions && restrictions.length) promptLines.push(`Dietary restrictions (must be followed): ${restrictions.join(', ')}`);
  if (budget !== undefined) promptLines.push(`Budget per meal (approximate): ${budget}`);
  if (availableIngredients && availableIngredients.length) promptLines.push(`Available ingredients: ${availableIngredients.join(', ')}`);
  if (mealType) promptLines.push(`Meal type: ${mealType}`);
  if (effectivePrepMinutes !== undefined) promptLines.push(`Maximum preparation time (minutes): ${effectivePrepMinutes}`);
  promptLines.push('Return a JSON array. Each item must contain:');
  promptLines.push('- name (string)');
  promptLines.push('- ingredients (array of strings)');
  promptLines.push('- portions (string, approximate)');
  promptLines.push('- steps (array of strings)');
  promptLines.push('- nutrition (object with optional approximate calorie and protein ranges)');
  promptLines.push('- note (string, optional) – if this suggestion is a fallback, include a clear label.');

  const prompt = promptLines.join('\n');

  let recommendations = null;
  let usedFallback = false;

  if (process.env.GEMINI_API_KEY) {
    const result = await geminiService.generateResponse(prompt);
    if (result.success) {
      const raw = result.data;
      if (Array.isArray(raw)) {
        recommendations = raw;
      } else if (raw && typeof raw === 'object') {
        recommendations = Array.isArray(raw.recommendations)
          ? raw.recommendations
          : (Array.isArray(raw.meals) ? raw.meals : (Array.isArray(raw.data) ? raw.data : null));
      }
    } else {
      console.warn('Gemini nutrition error:', result.error);
    }
  }

  // Normalizer / validation helper for a single recommendation
  const normalizeRec = (rec) => {
    if (!rec || typeof rec !== 'object') return null;
    const name = typeof rec.name === 'string' && rec.name.trim().length > 0 ? rec.name.trim() : null;
    const ingredients = Array.isArray(rec.ingredients) && rec.ingredients.length > 0
      ? rec.ingredients.map(i => String(i).trim()).filter(Boolean)
      : null;
    const portions = typeof rec.portions === 'string' && rec.portions.trim().length > 0
      ? rec.portions.trim()
      : '1 serving';
    const steps = Array.isArray(rec.steps) && rec.steps.length > 0
      ? rec.steps.map(s => String(s).trim()).filter(Boolean)
      : null;
    if (!name || !ingredients || !steps) return null;
    const rawNutrition = (typeof rec.nutrition === 'object' && rec.nutrition !== null) ? rec.nutrition : {};
    const normalizeNutritionValue = (value) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 80) return value.trim();
      return undefined;
    };
    const nutrition = {
      calories: normalizeNutritionValue(rawNutrition.calories),
      protein: normalizeNutritionValue(rawNutrition.protein),
      approximateCalories: normalizeNutritionValue(rawNutrition.approximateCalories),
      approximateProtein: normalizeNutritionValue(rawNutrition.approximateProtein),
      note: typeof rawNutrition.note === 'string' ? rawNutrition.note.trim().slice(0, 200) : undefined,
    };
    Object.keys(nutrition).forEach((key) => nutrition[key] === undefined && delete nutrition[key]);
    return {
      name,
      ingredients,
      portions,
      steps,
      nutrition,
      note: typeof rec.note === 'string' ? rec.note : undefined,
    };
  };

  let validLiveRecs = null;
  if (Array.isArray(recommendations)) {
    const parsed = recommendations.map(normalizeRec);
    if (parsed.every(r => r !== null) && parsed.length > 0) {
      validLiveRecs = parsed;
    }
  }

  if (validLiveRecs) {
    recommendations = validLiveRecs;
    usedFallback = false;
  } else {
    usedFallback = true;
    // Simple deterministic fallback: generate up to 2 meals based on available data
    const base = fitnessGoal ? fitnessGoal.split(' ')[0] : 'Meal';
    const pref = (dietaryPreferences && dietaryPreferences[0]) || 'General';
    const time = effectivePrepMinutes || 30;
    const now = new Date();
    recommendations = [
      {
        name: `${base.toUpperCase()} POWER SALAD`,
        ingredients: ['mixed greens', 'cherry tomatoes', 'cucumber', 'olive oil', 'lemon juice'],
        portions: '1 bowl',
        steps: ['Combine all ingredients in a bowl.', 'Dress with olive oil and lemon juice.', 'Toss and serve.'],
        nutrition: { approximateCalories: '250-300', approximateProtein: '10-15g' },
        note: 'Fallback suggestion – adjust ingredients to respect allergies/restrictions.',
      },
      {
        name: `${base.toUpperCase()} QUICK OMELET`,
        ingredients: ['2 eggs', 'spinach', 'feta cheese', 'pepper'],
        portions: '1 serving',
        steps: ['Beat eggs.', 'Cook spinach briefly.', 'Add eggs and cheese, fold when set.', 'Season and serve.'],
        nutrition: { approximateCalories: '200-250', approximateProtein: '15-20g' },
        note: 'Fallback suggestion – adjust to avoid allergens.',
      },
    ];
  }

  return res.json({
    success: true,
    fallback: usedFallback,
    recommendations,
    data: recommendations,
  });
}

module.exports = { generateNutritionRecommendations };
