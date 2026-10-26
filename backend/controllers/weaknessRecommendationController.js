const { generateResponse } = require('../services/geminiService');

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

  // Basic validation
  if (
    !Array.isArray(goals) || goals.length === 0 ||
    typeof stats !== 'object' || stats === null ||
    !Array.isArray(recentQuests) ||
    typeof availableMinutes !== 'number' || availableMinutes < 5 || availableMinutes > 1440 ||
    !Array.isArray(preferredCategories) || preferredCategories.length === 0
  ) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input: goals, stats, recentQuests, availableMinutes (5‑1440) and preferredCategories are required.',
    });
  }

  // Build a concise prompt for Gemini
  const prompt = [
    'You are the HunterOS quest generation AI. Based on the supplied user profile, suggest 3‑5 actionable quests.',
    `Goals: ${goals.join(', ')}`,
    `Stats: ${Object.entries(stats).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    `Recent quests (status): ${recentQuests.map(q => `${q._id}:${q.status}`).join(', ')}`,
    `Available time (minutes): ${availableMinutes}`,
    `Preferred categories: ${preferredCategories.join(', ')}`,
    'Return a JSON array. Each item must contain:',
    '- title (string)',
    '- description (string)',
    '- category (string)',
    '- estimatedDuration (minutes, number 5‑240)',
    '- difficulty ("Beginner"|"Intermediate"|"Advanced")',
    '- deadline (ISO 8601 timestamp, future)',
    '- suggestedReward (XP number 1‑1000)',
  ].join('\n');

  let recommendations = null;
  if (process.env.GEMINI_API_KEY) {
    const result = await generateResponse(prompt);
    if (result.success) {
      recommendations = result.data;
    } else {
      // Gemini call failed – will fall back below
      console.warn('Gemini recommendation error:', result.error);
    }
  }

  // Helper to validate a single recommendation object
  const isValidRec = (rec) => {
    return (
      rec &&
      typeof rec.title === 'string' && rec.title.trim().length > 0 &&
      typeof rec.description === 'string' && rec.description.trim().length > 0 &&
      typeof rec.category === 'string' && rec.category.trim().length > 0 &&
      typeof rec.estimatedDuration === 'number' && rec.estimatedDuration >= 5 && rec.estimatedDuration <= 240 &&
      ['Beginner', 'Intermediate', 'Advanced'].includes(rec.difficulty) &&
      typeof rec.deadline === 'string' && !Number.isNaN(new Date(rec.deadline).getTime()) &&
      typeof rec.suggestedReward === 'number' && rec.suggestedReward >= 1 && rec.suggestedReward <= 1000
    );
  };

  // If Gemini missing or malformed, fallback deterministic generator
  if (!Array.isArray(recommendations) || recommendations.some(r => !isValidRec(r))) {
    // Simple deterministic fallback – generate generic quests using supplied data
    const base = goals[0] || 'Goal';
    const cat = preferredCategories[0] || 'General';
    const dur1 = Math.max(10, Math.min(Math.round(availableMinutes * 0.3), 60));
    const dur2 = Math.max(15, Math.min(Math.round(availableMinutes * 0.4), 90));
    const dur3 = Math.max(10, Math.min(Math.round(availableMinutes * 0.3), 45));
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

  // Final validation before responding
  const allValid = Array.isArray(recommendations) && recommendations.every(isValidRec);
  if (!allValid) {
    return res.status(502).json({ success: false, error: 'Invalid recommendation data received from AI.' });
  }

  return res.json({ success: true, recommendations });
}

module.exports = { generateWeaknessRecommendations };
