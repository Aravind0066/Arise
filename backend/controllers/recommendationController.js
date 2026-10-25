const Quest = require("../models/Quest");
const Recommendation = require("../models/Recommendation");

const MAX_RECOMMENDATIONS = 3;
const MAX_XP = 1000;

const parseModelJson = (text) => {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : parsed.recommendations;
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

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      success: false,
      message: "AI recommendations are not configured. Set GEMINI_API_KEY on the backend.",
    });
  }

  try {
    const prompt = [
      "You are a practical productivity quest planner.",
      `Create exactly 3 quests for the goal: ${goal}`,
      `Category: ${category}. Difficulty: ${difficulty}. Available time: ${minutes} minutes.`,
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
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      }
    );

    if (!response.ok) {
      const providerError = await response.text();
      console.error("Gemini request failed:", providerError);
      return res.status(502).json({ success: false, message: "The AI provider rejected the request" });
    }

    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    const recommendations = parseModelJson(text || "");

    if (!Array.isArray(recommendations) || recommendations.length !== MAX_RECOMMENDATIONS) {
      return res.status(502).json({ success: false, message: "The AI returned an invalid recommendation format" });
    }

    const now = Date.now();
    const quests = recommendations.map((item, index) => {
      const duration = Number(item.durationMinutes);
      const xpReward = Number(item.xpReward);
      if (!item.title || !item.description || !Number.isFinite(duration) || duration < 5 || duration > 240 ||
        !Number.isFinite(xpReward) || xpReward < 1 || xpReward > MAX_XP) {
        throw new Error(`Invalid quest at recommendation ${index + 1}`);
      }
      return {
        title: String(item.title).trim(),
        description: String(item.description).trim(),
        category: String(category).trim(),
        xpReward: Math.round(xpReward),
        deadline: new Date(now + duration * 60 * 1000),
        generatedBy: "ai",
      };
    });

    const savedQuests = await Quest.create(quests);
    const recommendation = await Recommendation.create({
      goal,
      category,
      availableMinutes: minutes,
      difficulty,
      questIds: savedQuests.map((quest) => quest._id),
    });

    res.status(201).json({ success: true, recommendationId: recommendation._id, data: savedQuests });
  } catch (error) {
    if (error instanceof SyntaxError || error.message.startsWith("Invalid quest")) {
      return res.status(502).json({ success: false, message: "The AI returned invalid quest data" });
    }
    console.error("Recommendation generation failed:", error);
    res.status(500).json({ success: false, message: "Unable to generate recommendations" });
  }
};

module.exports = { generateRecommendations };
