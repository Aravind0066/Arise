const Quest = require("../models/Quest");
const CompletedQuest = require("../models/completedQuest");

const getQuestStatus = (quest, completedQuestIds = new Set()) => {
    if (completedQuestIds.has(String(quest._id))) {
        return "completed";
    }

    const deadline = new Date(quest.deadline).getTime();
    return Number.isNaN(deadline) || deadline < Date.now() ? "expired" : "active";
};

const withStatus = (quest, completedQuestIds) => ({
    ...quest.toObject(),
    status: getQuestStatus(quest, completedQuestIds),
});

const createQuest = async (req, res) => {
    try {
        const { title, description, category, xpReward, deadline, generatedBy } = req.body;
        if (!title || !description || !category || !deadline || !Number.isFinite(Number(xpReward))) {
            return res.status(400).json({ success: false, message: "title, description, category, xpReward and deadline are required" });
        }

        if (Number.isNaN(new Date(deadline).getTime())) {
            return res.status(400).json({ success: false, message: "Deadline must be a valid date" });
        }

        const quest = await Quest.create({
            title,
            description,
            category,
            xpReward: Number(xpReward),
            deadline,
            generatedBy,
        });

        res.status(201).json({
            success: true,
            data: quest,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getQuests = async (req, res) => {
    try {
        const completedQuestIds = req.query.userId
            ? new Set((await CompletedQuest.find({ userId: req.query.userId }).select("questId")).map(({ questId }) => String(questId)))
            : new Set();
        const quests = await Quest.find().sort({ deadline: 1 });

        res.status(200).json({
            success: true,
            data: quests.map((quest) => withStatus(quest)),
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message,
        });

    }
};

const getQuestById = async (req, res) => {
    try{
        const quest = await Quest.findById(req.params.id);
        if(!quest){
            return res.status(404).json({
                success: false,
                message: "Quest not found",
            });
        }
        
        const completed = req.query.userId
            ? await CompletedQuest.exists({ userId: req.query.userId, questId: quest._id })
            : null;
        res.status(200).json({
            success: true,
            data: withStatus(quest, completed ? new Set([String(quest._id)]) : new Set()),
        });

    }catch(error){
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const updateQuest = async (req, res) => {
    try{
        const updates = { ...req.body };
        if (updates.deadline && Number.isNaN(new Date(updates.deadline).getTime())) {
            return res.status(400).json({ success: false, message: "Deadline must be a valid date" });
        }
        const quest = await Quest.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        if(!quest){
            return res.status(404).json({
                success: false,
                message: "Quest not found",
            });
        }

        res.status(200).json({
            success: true,
            data: quest,
        });

    }catch(error){
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const deleteQuest = async (req, res) => {
    try{
        const quest = await Quest.findByIdAndDelete(req.params.id);
        if(!quest){
            return res.status(404).json({
                success: false,
                message: "Quest not Found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Quest deleted successfully",
        });

    }catch(error){
        res.status(500).json({
            success:false,
            message: error.message,
        });
    }
};

module.exports = {
    createQuest,
    getQuests,
    getQuestById,
    updateQuest,
    deleteQuest,
    getQuestStatus,
    withStatus,
};