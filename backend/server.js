const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = require("./config/db");

const userRoutes = require("./routes/userRoutes");
const questRoutes = require("./routes/questRoutes");
const completedQuestRoutes = require("./routes/completedQuestRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.get("/", (req, res) => {
    res.json({
        status: "success",
        system: "HunterOS // ARISE System Core",
        version: "2.0.0",
        message: "HunterOS Cloud API Gateway is Active",
        cloudProvider: "AWS App Runner Ready",
        endpoints: {
            health: "/api/health",
            quests: "/api/quests",
            generateQuests: "/api/quests/generate",
            users: "/api/users",
            completedQuests: "/api/completedquests",
        },
    });
});

app.get("/api/health", (req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    res.json({
        status: "healthy",
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        cloudService: "AWS App Runner / CloudWatch Monitored",
        database: isDbConnected ? "connected" : "local-first-gateway",
        aiProvider: process.env.GEMINI_API_KEY ? "Gemini LLM Connected" : "Intelligent Fallback Engine Active",
    });
});

app.use("/api/users", userRoutes);
app.use("/api/quests", questRoutes);
app.use("/api/completedquests", completedQuestRoutes);
app.use("/api/recommendations", recommendationRoutes);

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`[HunterOS Core] Server running on port ${port}`);
    console.log(`[HunterOS Core] System status: http://localhost:${port}/api/health`);
});
