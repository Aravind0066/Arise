const CompletedQuest = require("../models/completedQuest");
const Quest = require("../models/Quest");
const User = require("../models/User");
const { getQuestStatus } = require("./questController");
const mongoose = require("mongoose");


const completeQuest = async (req, res) => {
    try {

        const { userId, questId } = req.body;
        if (!userId || !questId) {
            return res.status(400).json({ success: false, message: "userId and questId are required" });
        }
        if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(questId)) {
            return res.status(400).json({ success: false, message: "userId and questId must be valid IDs" });
        }

        const user = await User.findById(userId);

        const quest = await Quest.findById(questId);

        if (!user || !quest) {
            return res.status(404).json({
                success: false,
                message: "User or Quest not found"
            });
        }

        if (getQuestStatus(quest) === "expired") {
            return res.status(409).json({
                success: false,
                message: "Quest deadline has passed",
                status: "expired",
            });
        }

        const alreadyCompleted = await CompletedQuest.findOne({
            userId,
            questId
        });

        if (alreadyCompleted) {
            return res.status(400).json({
                success: false,
                message: "Quest already completed"
            });
        }

        const completedQuest = await CompletedQuest.create({
            userId,
            questId,
            xpEarned: quest.xpReward
        });

        user.xp += quest.xpReward;
        user.level = Math.floor(user.xp / 500) + 1;

        await user.save();

        res.status(201).json({
            success: true,
            completedQuest,
            xp: user.xp,
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Quest already completed" });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


const getCompletedQuests = async (req, res) => {

    try {

        const completedQuests = await CompletedQuest.find({
            userId: req.params.userId
        }).populate("questId");

        res.status(200).json({
            success: true,
            data: completedQuests
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

module.exports = {
    completeQuest,
    getCompletedQuests
};