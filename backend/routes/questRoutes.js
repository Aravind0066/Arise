const express = require("express");

const {
    createQuest,
    getQuests,
    getQuestById,
    updateQuest,
    deleteQuest,
} = require("../controllers/questController");
const { generateRecommendations } = require("../controllers/recommendationController");

const router = express.Router();

router.post("/", createQuest);
router.post("/generate", generateRecommendations);

router.get("/", getQuests);

router.get("/:id", getQuestById);

router.put("/:id", updateQuest);

router.delete("/:id", deleteQuest);

module.exports = router;