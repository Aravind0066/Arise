const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { createCorsOptions } = require("./config/cors");
const { getHealthState } = require("./config/health");
const aiProvider = require('./services/aiProvider');

const questRoutes = require("./routes/questRoutes");
const aiRoutes = require('./routes/aiRoutes');
const weaknessRoutes = require('./routes/weaknessRecommendationRoutes');
const recommendationRoutes = require("./routes/recommendationRoutes");
const nutritionRoutes = require('./routes/nutritionRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();

app.use(cors(createCorsOptions()));
app.use(express.json());

// Temporary local-development trace for verifying whether the app reaches Express.
// Log only method and path; never log query strings, headers, or request bodies.
if (process.env.NODE_ENV !== "production") {
    app.use("/api", (req, _res, next) => {
        console.info(`[HunterOS dev request] ${req.method} ${req.path}`);
        next();
    });
}

app.get("/", (req, res) => {
    res.json({
        status: "success",
        system: "HunterOS // ARISE System Core",
        version: "2.0.0",
        message: "HunterOS Cloud API Gateway is Active",
        cloudProvider: "AWS App Runner Ready",
        endpoints: {
            health: "/api/health",
            generateQuests: "/api/quests/generate",
            recommendations: "/api/recommendations/generate",
            nutrition: "/api/nutrition",
            weakness: "/api/weakness",
            ai: "/api/ai/generate",
            chat: "/api/chat",
        },
    });
});

app.get("/api/health", async (req, res) => {
    const healthState = getHealthState();
    const aiHealth = await aiProvider.checkAvailability();
    res.json({
        ...healthState,
        backendStatus: 'available',
        aiProvider: aiHealth,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        cloudService: "AWS App Runner / CloudWatch Monitored",
    });
});

app.use("/api/quests", questRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/nutrition", nutritionRoutes);
app.use("/api/weakness", weaknessRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/chat", chatRoutes);

// Catch-all JSON 404 for API routes so callers never receive raw HTML
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    });
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`[HunterOS Core] Server running on port ${port}`);
    console.log(`[HunterOS Core] System status: http://localhost:${port}/api/health`);
});
