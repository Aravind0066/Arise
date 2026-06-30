const express = require("express");

const {
    createQuest,
    getQuests,
    getQuestById,
    updateQuest,
    deleteQuest,
} = require("../controllers/questController");

const router = express.Router();

router.post("/", createQuest);

router.get("/", getQuests);

router.get("/:id", getQuestById);

router.put("/:id", updateQuest);

router.delete("/:id", deleteQuest);

module.exports = router;