const aiProvider = require('../services/aiProvider');
const { weaknessRecommendationsSchema, extractJsonArray } = require('../utils/outputSchemas');

/**
 * POST /generate (weakness-based recommendations)
 * Expected body: {
 *   goals: string[],
 *   stats: { [key: string]: number },
 *   recentQuests: { _id: string, status: string }[],
 *   availableMinutes: number,
 *   preferredCategories: string[]
 * }
 */
async function generateWeaknessRecommendations(req, res) {
  const {
    goals,
    stats,
    recentQuests,
    availableMinutes,
    preferredCategories,
  } = req.body || {};

  // Validate or set safe defaults so recommendations always succeed reliably
  if (goals !== undefined && (!Array.isArray(goals) || goals.length === 0)) {
    return res.status(400).json({ success: false, error: 'goals must be a non-empty array of strings.' });
  }
  if (stats !== undefined && (typeof stats !== 'object' || stats === null)) {
    return res.status(400).json({ success: false, error: 'stats must be an object with numeric stats.' });
  }
  if (availableMinutes !== undefined && (typeof availableMinutes !== 'number' || availableMinutes < 5 || availableMinutes > 1440)) {
    return res.status(400).json({ success: false, error: 'availableMinutes must be a number between 5 and 1440.' });
  }

  const safeGoals = Array.isArray(goals) && goals.length > 0 ? goals : ['General self-improvement'];
  const safeStats = (typeof stats === 'object' && stats !== null) ? stats : { strength: 30, knowledge: 30, discipline: 30, health: 30, mindfulness: 30 };
  const safeRecentQuests = Array.isArray(recentQuests) ? recentQuests : [];
  const safeAvailableMinutes = typeof availableMinutes === 'number' ? availableMinutes : 45;
  const safePreferredCategories = Array.isArray(preferredCategories) && preferredCategories.length > 0 ? preferredCategories : ['Fitness', 'Study', 'Discipline'];

  // Build a concise prompt for the configured AI provider
  const prompt = [
    'You are the HunterOS quest generation AI. Based on the supplied user profile, suggest 3‑5 actionable quests.',
    `Goals: ${safeGoals.join(', ')}`,
    `Stats: ${Object.entries(safeStats).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    `Recent quests (status): ${safeRecentQuests.map(q => `${q._id}:${q.status}`).join(', ')}`,
    `Available time (minutes): ${safeAvailableMinutes}`,
    `Current UTC time for future deadline fields: ${new Date().toISOString()}`,
    `Preferred categories: ${safePreferredCategories.join(', ')}`,
    'Return only a JSON object { "recommendations": [ ... ] } matching the supplied structured-output schema. Create 3 to 5 distinct items and do not add markdown or commentary.',
    'Every item must contain:',
    '- title (string)',
    '- description (string)',
    '- category (string)',
    '- estimatedDuration (minutes, number 5‑240)',
    '- difficulty ("Beginner"|"Intermediate"|"Advanced")',
    '- deadline (ISO 8601 timestamp, future)',
    '- suggestedReward (XP number 1‑1000)',
  ].join('\n');

  let recommendations = null;
  let usedFallback = false;
  let fallbackReason;
  let result;
  try {
    result = await aiProvider.generateResponse(prompt, { responseMode: 'json', format: weaknessRecommendationsSchema, feature: 'weakness-scan' });
    if (result.success) {
      recommendations = extractJsonArray(result.data);
    } else {
      fallbackReason = result.errorType || 'OLLAMA_PROVIDER_ERROR';
    }
  } catch {
    fallbackReason = 'OLLAMA_PROVIDER_ERROR';
  }

  // Normalizer / validation helper for a single recommendation object
  const normalizeRec = (rec) => {
    if (!rec || typeof rec !== 'object') return null;
    const title = typeof rec.title === 'string' && rec.title.trim().length > 0 ? rec.title.trim() : null;
    const description = typeof rec.description === 'string' && rec.description.trim().length > 0 ? rec.description.trim() : null;
    const categoryValue = rec.category ?? rec.categoryName ?? rec.category_name;
    const category = typeof categoryValue === 'string' && categoryValue.trim().length > 0 ? categoryValue.trim() : null;
    if (!title || !description || !category) return null;

    const rawDuration = rec.estimatedDuration ?? rec.durationMinutes ?? rec.duration_minutes;
    const rawReward = rec.suggestedReward ?? rec.xpReward ?? rec.xp_reward;
    const duration = typeof rawDuration === 'number' ? rawDuration : typeof rawDuration === 'string' && /^\d+$/.test(rawDuration.trim()) ? Number(rawDuration) : NaN;
    const reward = typeof rawReward === 'number' ? rawReward : typeof rawReward === 'string' && /^\d+$/.test(rawReward.trim()) ? Number(rawReward) : NaN;
    if (!Number.isInteger(duration) || duration < 5 || duration > 240 || !Number.isInteger(reward) || reward < 1 || reward > 1000) return null;

    let diff = 'Intermediate';
    const rawDiff = String(rec.difficulty || '').toLowerCase();
    if (rawDiff.includes('begin')) diff = 'Beginner';
    else if (rawDiff.includes('adv')) diff = 'Advanced';
    else if (rawDiff.includes('inter')) diff = 'Intermediate';

    let deadline = rec.deadline ?? rec.deadlineISO ?? rec.deadline_iso;
    if (typeof deadline !== 'string' || Number.isNaN(new Date(deadline).getTime()) || new Date(deadline).getTime() <= Date.now()) {
      deadline = new Date(Date.now() + Math.max(duration * 60 * 1000, 4 * 60 * 60 * 1000)).toISOString();
    }

    return {
      title,
      description,
      category,
      estimatedDuration: Math.max(5, Math.min(240, duration)),
      difficulty: diff,
      deadline,
      suggestedReward: Math.max(1, Math.min(1000, reward)),
    };
  };

  let validLiveRecs = null;
  if (Array.isArray(recommendations) && recommendations.length >= 3 && recommendations.length <= 5) {
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
    fallbackReason ||= result?.success ? 'OUTPUT_SCHEMA_VALIDATION_FAILED' : 'OLLAMA_PROVIDER_ERROR';
    if (process.env.NODE_ENV !== 'production') {
      const shape = Array.isArray(recommendations)
        ? { type: 'array', length: recommendations.length, firstItemKeys: recommendations[0] && typeof recommendations[0] === 'object' ? Object.keys(recommendations[0]).slice(0, 20) : [] }
        : { type: recommendations === null ? 'null' : typeof recommendations, keys: recommendations && typeof recommendations === 'object' ? Object.keys(recommendations).slice(0, 20) : [] };
      console.warn(`[HunterOS validation] feature=weakness-scan result=fallback reason=${fallbackReason} shape=${JSON.stringify(shape)}`);
    }
    // Simple deterministic fallback – generate generic quests using supplied data
    const base = safeGoals[0] || 'Goal';
    const cat = safePreferredCategories[0] || 'General';
    const dur1 = Math.max(10, Math.min(Math.round(safeAvailableMinutes * 0.3), 60));
    const dur2 = Math.max(15, Math.min(Math.round(safeAvailableMinutes * 0.4), 90));
    const dur3 = Math.max(10, Math.min(Math.round(safeAvailableMinutes * 0.3), 45));
    const now = new Date();
    recommendations = [
      {
        title: `IRON WILL // ${base.toUpperCase()} DRILL`,
        description: `Progressive overload targeting ${base}.`,
        category: cat,
        estimatedDuration: dur1,
        difficulty: 'Beginner',
        deadline: new Date(now.getTime() + dur1 * 60000).toISOString(),
        suggestedReward: 60,
      },
      {
        title: `SHADOW RECON // ${base.toUpperCase()}`,
        description: `Focused session on ${base}.`,
        category: cat,
        estimatedDuration: dur2,
        difficulty: 'Intermediate',
        deadline: new Date(now.getTime() + dur2 * 60000).toISOString(),
        suggestedReward: 80,
      },
      {
        title: `RECOVERY PROTOCOL // ${base.toUpperCase()}`,
        description: `Cool‑down and reflection on ${base}.`,
        category: cat,
        estimatedDuration: dur3,
        difficulty: 'Beginner',
        deadline: new Date(now.getTime() + dur3 * 60000).toISOString(),
        suggestedReward: 40,
      },
    ];
  }

  return res.json({
    success: true,
    fallback: usedFallback,
    source: usedFallback ? 'hunteros-engine' : 'ollama-local',
    ...(usedFallback ? { fallbackReason } : {}),
    recommendations,
    data: recommendations,
  });
}

module.exports = { generateWeaknessRecommendations };
