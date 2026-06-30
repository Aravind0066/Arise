const CompletedQuest = require("../models/CompletedQuest");
const Quest = require("../models/Quest");
const User = require("../models/User");


const completeQuest = async (req, res) => {
    try {

        const { userId, questId } = req.body;

        const user = await User.findById(userId);

        const quest = await Quest.findById(questId);

        if (!user || !quest) {
            return res.status(404).json({
                success: false,
                message: "User or Quest not found"
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

        await user.save();

        res.status(201).json({
            success: true,
            completedQuest,
            xp: user.xp,
        });

    } catch (error) {

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
        });

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