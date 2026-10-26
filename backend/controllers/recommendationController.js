const mongoose = require("mongoose");
const Quest = require("../models/Quest");
const Recommendation = require("../models/Recommendation");

const MAX_RECOMMENDATIONS = 3;
const MAX_XP = 1000;

const parseModelJson = (text) => {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : parsed.recommendations;
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

  if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = [
        "You are the HunterOS System — a Solo Leveling style HUD AI that issues RPG quests.",
        `Create exactly 3 quests for the goal: ${goal}`,
        `Category: ${category}. Difficulty: ${difficulty}. Available time: ${minutes} minutes.`,
        "Use epic System terminology (e.g., IRON PROTOCOL, SHADOW RECON, SYNAPSE ENCRYPTION).",
        "Return only a JSON array. Each item must have title, description, xpReward (1-1000), and durationMinutes (5-240).",
      ].join("\n");

      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
          }),
        }
      );

      if (response.ok) {
        const payload = await response.json();
        const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
        recommendations = parseModelJson(text || "");
      } else {
        console.warn("Gemini API call non-200. Falling back to HunterOS System Generator.");
      }
    } catch (err) {
      console.warn("Gemini call error. Falling back to HunterOS System Generator:", err.message);
    }
  }

  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    recommendations = generateFallbackQuests(goal, category, minutes, difficulty);
  }

  try {
    const now = Date.now();
    const isDbConnected = mongoose.connection.readyState === 1;

    const quests = recommendations.slice(0, MAX_RECOMMENDATIONS).map((item, index) => {
      const duration = Number(item.durationMinutes) || 30;
      const xpReward = Math.min(MAX_XP, Math.max(10, Number(item.xpReward) || 50));
      return {
        _id: isDbConnected ? undefined : `ai_${now}_${index + 1}`,
        title: String(item.title).trim(),
        description: String(item.description).trim(),
        category: String(category).trim(),
        xpReward: Math.round(xpReward),
        deadline: new Date(now + duration * 60 * 1000),
        generatedBy: "ai",
      };
    });

    if (isDbConnected) {
      const savedQuests = await Quest.create(quests);
      const recommendation = await Recommendation.create({
        goal,
        category,
        availableMinutes: minutes,
        difficulty,
        questIds: savedQuests.map((quest) => quest._id),
      });

      return res.status(201).json({
        success: true,
        source: process.env.GEMINI_API_KEY ? "gemini-cloud" : "hunteros-engine",
        recommendationId: recommendation._id,
        data: savedQuests,
      });
    }

    // Local-first / In-memory Gateway mode (Cloud ready, no external DB needed)
    return res.status(200).json({
      success: true,
      source: process.env.GEMINI_API_KEY ? "gemini-cloud" : "hunteros-engine",
      mode: "local-first-gateway",
      data: quests.map((q, i) => ({
        ...q,
        _id: q._id || `quest_ai_${now}_${i + 1}`,
        status: "active",
      })),
    });
  } catch (error) {
    console.error("Recommendation generation failed:", error);
    res.status(500).json({ success: false, message: "Unable to generate recommendations" });
  }
};

module.exports = { generateRecommendations };

