// Nutrition recommendation controller
// Exposes POST /api/nutrition
// Uses the configured provider and returns errors for unavailable or invalid generations.

const aiProvider = require('../services/aiProvider');
const { nutritionSchema } = require('../utils/outputSchemas');

/**
 * Expected body (all fields are optional; an empty body requests a general plan):
 * {
 *   fitnessGoal?: string,
 *   dietaryPreferences?: string[],
 *   allergies?: string[],
 *   restrictions?: string[],
 *   budget?: number, // approximate per‑meal budget in local currency
 *   availableIngredients?: string[],
 *   mealType?: string, // e.g., breakfast, lunch, dinner, snack
 *   mealsToPlan?: 'one' | 'full-day',
 *   context?: object, // previously saved nutrition plans and known-data availability
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
    mealsToPlan,
    context,
    prepTimeMinutes,
    preparationTime,
  } = req.body || {};

  const effectivePrepMinutes = prepTimeMinutes !== undefined ? prepTimeMinutes : preparationTime;

// Build prompt for the configured AI provider
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
  if (mealsToPlan === 'full-day') promptLines.push('Create a full day plan with distinct practical meals; if supplied, ingredients and time limits apply to each meal.');
  else if (mealsToPlan === 'one') promptLines.push('Create one meal.');
  else promptLines.push('No meal scope was selected; use a practical single-meal suggestion as the general default.');
  if (availableIngredients?.length) promptLines.push('Use the supplied ingredients as the available pantry. Do not claim other ingredients are available; clearly label any optional substitutions.');
  else promptLines.push('No ingredients were supplied. You may propose ingredients for a recipe, but do not imply they are currently available to the user.');
  promptLines.push('Treat omitted fields as unknown and unconstrained. Use general balanced meal-planning defaults when no goal or preferences are available. Do not infer food intake, nutrition targets, allergies, or equipment. Use appropriate uncertainty for estimated nutrition; never imply laboratory precision.');
  if (context && typeof context === 'object') promptLines.push(`Saved context (JSON; use only recorded fields): ${JSON.stringify(context).slice(0, 8000)}`);
  promptLines.push('Return only a JSON array matching the supplied structured-output schema. Do not wrap it in markdown or add commentary.');
  promptLines.push('Each meal must contain these required fields:');
  promptLines.push('- name (string)');
  promptLines.push('- ingredients (array of strings with approximate quantities)');
  promptLines.push('- portions (string, approximate)');
  promptLines.push('- steps (array of strings)');
  promptLines.push('- preparationTimeMinutes (number, estimated)');
  promptLines.push('- nutrition (optional object with approximate calories, protein, carbohydrates, fat, and an uncertainty note when estimates are available; never invent unsupported values)');
  promptLines.push('- preparationTimeMinutes (estimated integer, optional), substitutions (optional array) and goalAlignment (short explanation, optional)');
  promptLines.push('- note (string, optional)');

  const prompt = promptLines.join('\n');

  let recommendations = null;
  let result;
  try { result = await aiProvider.generateResponse(prompt, { responseMode: 'json', format: nutritionSchema, feature: 'nutrition' }); }
  catch { return res.status(502).json({ success: false, error: 'Ollama inference failed unexpectedly.', errorType: 'OLLAMA_PROVIDER_ERROR' }); }
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
      const errorType = result.errorType || 'OLLAMA_PROVIDER_ERROR';
      return res.status(aiProvider.responseStatusFor(errorType)).json({ success: false, error: result.error || 'Nutrition AI is unavailable.', errorType });
    }

  // Normalizer / validation helper for a single recommendation
  const normalizeRec = (rec) => {
    if (!rec || typeof rec !== 'object') return null;
    const nameValue = rec.name ?? rec.mealName ?? rec.meal_name ?? rec.title;
    const name = typeof nameValue === 'string' && nameValue.trim().length > 0 && nameValue.trim().length <= 120 ? nameValue.trim() : null;
    const rawIngredients = rec.ingredients ?? rec.items;
    const mappedIngredients = Array.isArray(rawIngredients) && rawIngredients.length > 0 && rawIngredients.length <= 40
      ? rawIngredients.map((ingredient) => {
        if (typeof ingredient === 'string') return ingredient.trim();
        if (!ingredient || typeof ingredient !== 'object') return '';
        const itemName = ingredient.name ?? ingredient.ingredient;
        if (typeof itemName !== 'string' || !itemName.trim()) return '';
        const amount = ingredient.quantity ?? ingredient.amount;
        return amount === undefined || amount === null || String(amount).trim() === ''
          ? itemName.trim()
          : `${String(amount).trim()} ${itemName.trim()}`;
      })
      : null;
    const ingredients = mappedIngredients && mappedIngredients.every((i) => i.length > 0 && i.length <= 180) ? mappedIngredients : null;
    const rawPortions = rec.portions ?? rec.servings ?? rec.servingSize ?? rec.serving_size;
    const portions = (typeof rawPortions === 'string' || typeof rawPortions === 'number') && String(rawPortions).trim().length > 0 && String(rawPortions).trim().length <= 100 ? String(rawPortions).trim() : null;
    const rawSteps = rec.steps ?? rec.instructions;
    const steps = Array.isArray(rawSteps) && rawSteps.length > 0 && rawSteps.length <= 30 && rawSteps.every(s => typeof s === 'string' && s.trim().length > 0 && s.trim().length <= 500)
      ? rawSteps.map(s => s.trim())
      : null;
    if (!name || !ingredients || !steps) return null;
    if (!portions) return null;
    const rawNutrition = rec.nutrition ?? rec.nutritionFacts ?? rec.nutrition_facts ?? rec.macros;
    if (rawNutrition !== undefined && (!rawNutrition || typeof rawNutrition !== 'object' || Array.isArray(rawNutrition))) return null;
    const normalizeNutritionValue = (value) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 80) return value.trim();
      return undefined;
    };
    const nutrition = rawNutrition ? {
      calories: normalizeNutritionValue(rawNutrition.calories ?? rawNutrition.caloriesKcal ?? rawNutrition.calories_kcal ?? rawNutrition.kcal),
      protein: normalizeNutritionValue(rawNutrition.protein ?? rawNutrition.proteinGrams ?? rawNutrition.protein_g),
      approximateCalories: normalizeNutritionValue(rawNutrition.approximateCalories),
      approximateProtein: normalizeNutritionValue(rawNutrition.approximateProtein),
      carbohydrates: normalizeNutritionValue(rawNutrition.carbohydrates ?? rawNutrition.carbs ?? rawNutrition.carbohydratesGrams ?? rawNutrition.carbohydrates_g),
      fat: normalizeNutritionValue(rawNutrition.fat ?? rawNutrition.fatGrams ?? rawNutrition.fat_g),
      note: typeof (rawNutrition.note ?? rawNutrition.uncertainty) === 'string' ? (rawNutrition.note ?? rawNutrition.uncertainty).trim().slice(0, 200) : undefined,
    } : undefined;
    if (nutrition) Object.keys(nutrition).forEach((key) => nutrition[key] === undefined && delete nutrition[key]);
    return {
      name,
      ingredients,
      portions,
      steps,
      ...(nutrition && Object.keys(nutrition).length ? { nutrition } : {}),
      note: typeof rec.note === 'string' ? rec.note : undefined,
      preparationTimeMinutes: Number.isInteger(rec.preparationTimeMinutes ?? rec.preparation_time_minutes ?? rec.prepTimeMinutes ?? rec.prep_time_minutes) && (rec.preparationTimeMinutes ?? rec.preparation_time_minutes ?? rec.prepTimeMinutes ?? rec.prep_time_minutes) > 0 && (rec.preparationTimeMinutes ?? rec.preparation_time_minutes ?? rec.prepTimeMinutes ?? rec.prep_time_minutes) <= 360 ? (rec.preparationTimeMinutes ?? rec.preparation_time_minutes ?? rec.prepTimeMinutes ?? rec.prep_time_minutes) : undefined,
      substitutions: Array.isArray(rec.substitutions) ? rec.substitutions.map(s => String(s).trim()).filter(Boolean).slice(0, 12) : undefined,
      goalAlignment: typeof (rec.goalAlignment ?? rec.goal_alignment) === 'string' ? (rec.goalAlignment ?? rec.goal_alignment).trim().slice(0, 240) : undefined,
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
  } else {
    if (process.env.NODE_ENV !== 'production') {
      const shape = Array.isArray(recommendations)
        ? { type: 'array', length: recommendations.length, firstItemKeys: recommendations[0] && typeof recommendations[0] === 'object' ? Object.keys(recommendations[0]).slice(0, 20) : [] }
        : { type: recommendations === null ? 'null' : typeof recommendations, keys: recommendations && typeof recommendations === 'object' ? Object.keys(recommendations).slice(0, 20) : [] };
      console.warn(`[HunterOS validation] feature=nutrition result=failed shape=${JSON.stringify(shape)}`);
    }
    return res.status(502).json({ success: false, error: 'Nutrition output did not match the meal contract. Required for each meal: name, ingredients, portions or servings, and steps or instructions. Retry generation.', errorType: 'OUTPUT_SCHEMA_VALIDATION_FAILED' });
  }

  return res.json({
    success: true,
    fallback: false,
    source: 'ollama-local',
    recommendations,
    data: recommendations,
  });
}

module.exports = { generateNutritionRecommendations };
