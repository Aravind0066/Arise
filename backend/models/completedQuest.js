const mongoose = require("mongoose");

const completedQuestSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        questId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Quest",
            required: true
        },
        xpEarned: {
            type: Number,
            required: true
        }
    },
    
    {
        timestamps: true
    }
)

module.exports = mongoose.model("CompletedQuest", completedQuestSchema);