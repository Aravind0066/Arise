const express = require("express");

const {
    completeQuest,
    getCompletedQuests
} = require("../controllers/completedQuestController");

const router = express.Router();


router.post("/complete", completeQuest);

router.get("/:userId", getCompletedQuests);

module.exports = router;