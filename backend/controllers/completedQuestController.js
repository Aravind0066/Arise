const CompletedQuest = require("../models/completedQuest");
const Quest = require("../models/Quest");
const User = require("../models/User");
const { getQuestStatus } = require("./questController");
const mongoose = require("mongoose");

let inMemoryCompleted = [];

const completeQuest = async (req, res) => {
    try {
        const { userId, questId } = req.body;
        if (!userId || !questId) {
            return res.status(400).json({ success: false, message: "userId and questId are required" });
        }

        if (mongoose.connection.readyState === 1) {
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

            const alreadyCompleted = await CompletedQuest.findOne({ userId, questId });
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

            return res.status(201).json({
                success: true,
                completedQuest,
                xp: user.xp,
            });
        }

        // In-memory fallback
        const existing = inMemoryCompleted.find(c => c.userId === userId && c.questId._id === questId);
        if (existing) {
            return res.status(400).json({ success: false, message: "Quest already completed" });
        }

        const completedRecord = {
            _id: `cq_${Date.now()}`,
            userId,
            questId: { _id: questId, title: "Hunter Directive Completed", category: "Training", xpReward: 50 },
            xpEarned: 50,
            createdAt: new Date().toISOString(),
        };
        inMemoryCompleted.unshift(completedRecord);

        res.status(201).json({
            success: true,
            completedQuest: completedRecord,
            xp: 50,
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
        if (mongoose.connection.readyState === 1) {
            const completedQuests = await CompletedQuest.find({
                userId: req.params.userId
            }).populate("questId");

            return res.status(200).json({
                success: true,
                data: completedQuests
            });
        }

        const userQuests = inMemoryCompleted.filter(c => c.userId === req.params.userId);
        res.status(200).json({
            success: true,
            data: userQuests,
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
