const { withStatus } = require("../utils/questStatus");
const aiProvider = require("../services/aiProvider");
const { generatedQuestsSchema, extractJsonArray } = require("../utils/outputSchemas");

const MAX_RECOMMENDATIONS = 3;
const MAX_XP = 1000;

const parseModelJson = (text) => {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return extractJsonArray(JSON.parse(cleaned), ['quests', 'recommendations', 'items', 'tasks', 'data']);
};

// Built-in HunterOS Solo Leveling Quest Generator for offline / fallback execution
const generateFallbackQuests = (goal, category, minutes, difficulty) => {
  const normalizedCategory = (category || "General").toLowerCase();
  const dur1 = Math.max(10, Math.min(Math.round(minutes * 0.35), 60));
  const dur2 = Math.max(15, Math.min(Math.round(minutes * 0.45), 90));
  const dur3 = Math.max(10, Math.min(Math.round(minutes * 0.20), 45));

  if (normalizedCategory.includes("fitness") || normalizedCategory.includes("strength") || normalizedCategory.includes("health")) {
    return [
      {
        title: `IRON WILL // ${goal.toUpperCase()} DRILL`,
        description: `Execute progressive overload sets targeting "${goal}". Maintain strict biomechanics.`,
        durationMinutes: dur1,
        xpReward: 60,
      },
      {
        title: `HIGH-VELOCITY CONDITIONING // PROTOCOL`,
        description: `High-focus endurance and muscle activation supporting "${goal}".`,
        durationMinutes: dur2,
        xpReward: 75,
      },
      {
        title: `POST-TRAINING CELLULAR HYDRATION & RECOVERY`,
        description: `Consume 750ml water, complete dynamic stretching, and log workout difficulty.`,
        durationMinutes: dur3,
        xpReward: 35,
      },
    ];
  }

  if (normalizedCategory.includes("study") || normalizedCategory.includes("knowledge") || normalizedCategory.includes("learning")) {
    return [
      {
        title: `SHADOW RECON // DEEP WORK: ${goal.toUpperCase()}`,
        description: `Zero notifications. Deep study block focused on: "${goal}". Take comprehensive notes.`,
        durationMinutes: dur2,
        xpReward: 85,
      },
      {
        title: `SYNAPSE ENCRYPTION // ACTIVE RECALL & DRILLS`,
        description: `Test understanding through 5 self-quiz questions or flashcards on "${goal}".`,
        durationMinutes: dur1,
        xpReward: 50,
      },
      {
        title: `KNOWLEDGE ARCHIVE // 3-POINT SYNTHESIS`,
        description: `Summarize key formulas and breakthroughs discovered during "${goal}".`,
        durationMinutes: dur3,
        xpReward: 30,
      },
    ];
  }

  if (normalizedCategory.includes("mind") || normalizedCategory.includes("discipline")) {
    return [
      {
        title: `SOVEREIGN DETOX // DOOM SCROLL LOCK`,
        description: `Zero social reels or micro-distractions for ${dur2} minutes. Focus entirely on "${goal}".`,
        durationMinutes: dur2,
        xpReward: 70,
      },
      {
        title: `NEURAL RESET // MINDFUL AUDIT`,
        description: `10 minutes box-breathing and daily introspection on "${goal}".`,
        durationMinutes: dur3,
        xpReward: 40,
      },
      {
        title: `ACTION DIRECTIVE // REINFORCEMENT`,
        description: `Execute the single highest-leverage task required for "${goal}".`,
        durationMinutes: dur1,
        xpReward: 60,
      },
    ];
  }

  return [
    {
      title: `SYSTEM DIRECTIVE // ${goal.toUpperCase()}`,
      description: `Primary objective: Execute focused session towards "${goal}".`,
      durationMinutes: dur2,
      xpReward: 70,
    },
    {
      title: `PRECISION DRILL // KNOWLEDGE ACQUISITION`,
      description: `Review metrics and verify completion of "${goal}".`,
      durationMinutes: dur1,
      xpReward: 50,
    },
    {
      title: `RECOVERY PROTOCOL // RESET`,
      description: `Rehydrate and document insights from "${goal}".`,
      durationMinutes: dur3,
      xpReward: 30,
    },
  ];
};

const generateRecommendations = async (req, res) => {
  const { goal, category = "General", availableMinutes, difficulty = "Beginner" } = req.body;
  const minutes = Number(availableMinutes);

  if (!goal || !Number.isFinite(minutes) || minutes < 5 || minutes > 1440) {
    return res.status(400).json({
      success: false,
      message: "goal and availableMinutes between 5 and 1440 are required",
    });
  }

  let recommendations = null;
  let usedFallback = false;
  let fallbackReason;

  try {
      const prompt = [
        "You are HunterOS's friendly RPG-themed directive generator.",
        `Create exactly 3 quests for the goal: ${goal}`,
        `Category: ${category}. Difficulty: ${difficulty}. Available time: ${minutes} minutes.`,
        "Use epic System terminology (e.g., IRON PROTOCOL, SHADOW RECON, SYNAPSE ENCRYPTION).",
        "Return only a JSON object { \"quests\": [ ... ] } matching the supplied structured-output schema, with exactly 3 objects. Each object needs title, description, xpReward, and durationMinutes. No markdown or commentary.",
      ].join("\n");

    const result = await aiProvider.generateResponse(prompt, { responseMode: 'json', format: generatedQuestsSchema, feature: 'quest-generate' });
      if (result.success) {
        recommendations = extractJsonArray(result.data, ['quests', 'recommendations', 'items', 'tasks', 'data']);
        if (!recommendations && typeof result.data === "string") {
          try { recommendations = extractJsonArray(parseModelJson(result.data), ['quests', 'recommendations', 'items', 'tasks', 'data']); } catch { recommendations = null; }
        }
    } else {
      fallbackReason = result.errorType || 'OLLAMA_PROVIDER_ERROR';
    }
  } catch {
    fallbackReason = 'OLLAMA_PROVIDER_ERROR';
  }

  const asInteger = (value) => {
    const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : NaN;
    return Number.isInteger(numeric) ? numeric : NaN;
  };
  if (Array.isArray(recommendations)) {
    recommendations = recommendations.map((item) => item && typeof item === 'object' ? {
      ...item,
      durationMinutes: item.durationMinutes ?? item.estimatedDuration ?? item.duration_minutes ?? item.duration ?? item.minutes,
      xpReward: item.xpReward ?? item.suggestedReward ?? item.xp_reward ?? item.xp,
    } : item);
  }
  const normalizedQuests = Array.isArray(recommendations) ? recommendations.map((item) => {
    if (!item || typeof item.title !== 'string' || !item.title.trim() || typeof item.description !== 'string' || !item.description.trim()) return null;
    const durationMinutes = asInteger(item.durationMinutes);
    const xpReward = asInteger(item.xpReward);
    if (durationMinutes < 5 || durationMinutes > 240 || xpReward < 1 || xpReward > MAX_XP) return null;
    return { ...item, durationMinutes, xpReward, title: item.title.trim(), description: item.description.trim() };
  }).filter(Boolean) : [];
  const validQuests = normalizedQuests.length >= MAX_RECOMMENDATIONS;
  if (!validQuests) {
    usedFallback = true;
    fallbackReason ||= 'OUTPUT_SCHEMA_VALIDATION_FAILED';
    if (process.env.NODE_ENV !== 'production') {
      const shape = Array.isArray(recommendations)
        ? { type: 'array', length: recommendations.length, firstItemKeys: recommendations[0] && typeof recommendations[0] === 'object' ? Object.keys(recommendations[0]).slice(0, 16) : [] }
        : { type: recommendations === null ? 'null' : typeof recommendations, keys: recommendations && typeof recommendations === 'object' ? Object.keys(recommendations).slice(0, 16) : [] };
      console.warn(`[HunterOS validation] feature=quest-generate result=fallback reason=${fallbackReason} shape=${JSON.stringify(shape)}`);
    }
    recommendations = generateFallbackQuests(goal, category, minutes, difficulty);
  } else {
    recommendations = normalizedQuests.slice(0, MAX_RECOMMENDATIONS);
  }

  try {
    const now = Date.now();

    const quests = recommendations.slice(0, MAX_RECOMMENDATIONS).map((item, index) => {
      const duration = Number(item.durationMinutes) || 30;
      const xpReward = Math.min(MAX_XP, Math.max(10, Number(item.xpReward) || 50));
      return {
        _id: `quest_ai_${now}_${index + 1}`,
        title: String(item.title).trim(),
        description: String(item.description).trim(),
        category: String(category).trim(),
        xpReward: Math.round(xpReward),
        deadline: new Date(now + duration * 60 * 1000),
        generatedBy: usedFallback ? "system" : "ai",
        fallback: usedFallback,
      };
    });

    return res.status(200).json({
      success: true,
      source: usedFallback ? "hunteros-engine" : "ollama-local",
      fallback: usedFallback,
      ...(usedFallback ? { fallbackReason } : {}),
      mode: "local-first-gateway",
      data: quests.map((quest) => withStatus(quest)),
    });
  } catch (error) {
    console.error("Recommendation generation failed:", error);
    res.status(500).json({ success: false, message: "Unable to generate recommendations" });
  }
};

module.exports = { generateRecommendations };

