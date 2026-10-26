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
  } = req.body || {};

  // At least one of the optional fields must be supplied
  if (
    fitnessGoal === undefined &&
    (!dietaryPreferences || dietaryPreferences.length === 0) &&
    (!allergies || allergies.length === 0) &&
    (!restrictions || restrictions.length === 0) &&
    budget === undefined &&
    (!availableIngredients || availableIngredients.length === 0) &&
    mealType === undefined &&
    prepTimeMinutes === undefined
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
  if (prepTimeMinutes !== undefined) promptLines.push(`Maximum preparation time (minutes): ${prepTimeMinutes}`);
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
      recommendations = result.data;
    } else {
      console.warn('Gemini nutrition error:', result.error);
    }
  }

  // Validation helper for a single recommendation
  const isValidRec = (rec) => {
    return (
      rec &&
      typeof rec.name === 'string' && rec.name.trim().length > 0 &&
      Array.isArray(rec.ingredients) && rec.ingredients.length > 0 &&
      typeof rec.portions === 'string' && rec.portions.trim().length > 0 &&
      Array.isArray(rec.steps) && rec.steps.length > 0 &&
      (typeof rec.nutrition === 'object' && rec.nutrition !== null) &&
      // optional note is a string if present
      (rec.note === undefined || typeof rec.note === 'string')
    );
  };

  // If Gemini missing or data malformed, use deterministic fallback
  if (!Array.isArray(recommendations) || recommendations.some((r) => !isValidRec(r))) {
    usedFallback = true;
    // Simple deterministic fallback: generate up to 2 meals based on available data
    const base = fitnessGoal ? fitnessGoal.split(' ')[0] : 'Meal';
    const pref = (dietaryPreferences && dietaryPreferences[0]) || 'General';
    const time = prepTimeMinutes || 30;
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

  // Final validation before responding
  const allValid = Array.isArray(recommendations) && recommendations.every(isValidRec);
  if (!allValid) {
    return res.status(502).json({ success: false, error: 'Invalid nutrition data received from AI.' });
  }

  return res.json({ success: true, fallback: usedFallback, recommendations });
}

module.exports = { generateNutritionRecommendations };
