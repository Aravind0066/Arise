const mongoose = require("mongoose");
const Quest = require("../models/Quest");
const CompletedQuest = require("../models/completedQuest");

// In-memory fallback quests for local / offline demo
let inMemoryQuests = [
    {
        _id: "quest_default_1",
        title: "MORNING SYSTEM // SUNLIGHT PROTOCOL",
        description: "Expose eyes/skin to 10 minutes of direct morning sunlight. Boosts cortisol rhythm & dopamine.",
        category: "Health",
        xpReward: 25,
        deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        generatedBy: "system",
        status: "active",
    },
    {
        _id: "quest_default_2",
        title: "HYDRATION PROTOCOL // 3L WATER MATRIX",
        description: "Maintain optimal cellular hydration. Complete first 1L before noon.",
        category: "Health",
        xpReward: 30,
        deadline: new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString(),
        generatedBy: "system",
        status: "active",
    },
    {
        _id: "quest_default_3",
        title: "SHADOW RECON // DEEP WORK STUDY (90 MIN)",
        description: "Zero phone distractions. Enter flow state on your hardest subject or problem set.",
        category: "Knowledge",
        xpReward: 80,
        deadline: new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString(),
        generatedBy: "system",
        status: "active",
    },
    {
        _id: "quest_default_4",
        title: "STRENGTH TRAINING // PROGRESSIVE OVERLOAD",
        description: "Complete resistance training workout. Push to mechanical failure on final sets.",
        category: "Fitness",
        xpReward: 70,
        deadline: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
        generatedBy: "system",
        status: "active",
    },
    {
        _id: "quest_default_5",
        title: "SOVEREIGN DISCIPLINE // NO REELS DETOX",
        description: "Keep social media shorts & reels under 10 minutes total today. Zero doom scrolling.",
        category: "Discipline",
        xpReward: 40,
        deadline: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
        generatedBy: "system",
        status: "active",
    },
];

const getQuestStatus = (quest, completedQuestIds = new Set()) => {
    if (completedQuestIds.has(String(quest._id))) {
        return "completed";
    }

    const deadline = new Date(quest.deadline).getTime();
    return Number.isNaN(deadline) || deadline < Date.now() ? "expired" : "active";
};

const withStatus = (quest, completedQuestIds) => {
    const raw = typeof quest.toObject === "function" ? quest.toObject() : quest;
    return {
        ...raw,
        status: getQuestStatus(raw, completedQuestIds),
    };
};

const createQuest = async (req, res) => {
    try {
        const { title, description, category, xpReward, deadline, generatedBy } = req.body;
        if (!title || !description || !category || !deadline || !Number.isFinite(Number(xpReward))) {
            return res.status(400).json({ success: false, message: "title, description, category, xpReward and deadline are required" });
        }

        if (Number.isNaN(new Date(deadline).getTime())) {
            return res.status(400).json({ success: false, message: "Deadline must be a valid date" });
        }

        if (mongoose.connection.readyState === 1) {
            const quest = await Quest.create({
                title,
                description,
                category,
                xpReward: Number(xpReward),
                deadline,
                generatedBy,
            });

            return res.status(201).json({
                success: true,
                data: quest,
            });
        }

        const newQuest = {
            _id: `quest_local_${Date.now()}`,
            title,
            description,
            category,
            xpReward: Number(xpReward),
            deadline: new Date(deadline).toISOString(),
            generatedBy: generatedBy || "user",
            status: "active",
        };
        inMemoryQuests.unshift(newQuest);

        res.status(201).json({
            success: true,
            data: newQuest,
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
        if (mongoose.connection.readyState === 1) {
            const completedQuestIds = req.query.userId
                ? new Set((await CompletedQuest.find({ userId: req.query.userId }).select("questId")).map(({ questId }) => String(questId)))
                : new Set();
            const quests = await Quest.find().sort({ deadline: 1 });

            return res.status(200).json({
                success: true,
                data: quests.map((quest) => withStatus(quest, completedQuestIds)),
            });
        }

        res.status(200).json({
            success: true,
            data: inMemoryQuests.map((quest) => withStatus(quest)),
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getQuestById = async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const quest = await Quest.findById(req.params.id);
            if (!quest) {
                return res.status(404).json({
                    success: false,
                    message: "Quest not found",
                });
            }
            
            const completed = req.query.userId
                ? await CompletedQuest.exists({ userId: req.query.userId, questId: quest._id })
                : null;
            return res.status(200).json({
                success: true,
                data: withStatus(quest, completed ? new Set([String(quest._id)]) : new Set()),
            });
        }

        const found = inMemoryQuests.find(q => String(q._id) === String(req.params.id));
        if (!found) {
            return res.status(404).json({ success: false, message: "Quest not found" });
        }
        res.status(200).json({ success: true, data: withStatus(found) });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const updateQuest = async (req, res) => {
    try {
        const updates = { ...req.body };
        if (updates.deadline && Number.isNaN(new Date(updates.deadline).getTime())) {
            return res.status(400).json({ success: false, message: "Deadline must be a valid date" });
        }

        if (mongoose.connection.readyState === 1) {
            const quest = await Quest.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
            if (!quest) {
                return res.status(404).json({
                    success: false,
                    message: "Quest not found",
                });
            }

            return res.status(200).json({
                success: true,
                data: quest,
            });
        }

        const index = inMemoryQuests.findIndex(q => String(q._id) === String(req.params.id));
        if (index === -1) {
            return res.status(404).json({ success: false, message: "Quest not found" });
        }
        inMemoryQuests[index] = { ...inMemoryQuests[index], ...updates };
        res.status(200).json({ success: true, data: inMemoryQuests[index] });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const deleteQuest = async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const quest = await Quest.findByIdAndDelete(req.params.id);
            if (!quest) {
                return res.status(404).json({
                    success: false,
                    message: "Quest not Found",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Quest deleted successfully",
            });
        }

        inMemoryQuests = inMemoryQuests.filter(q => String(q._id) !== String(req.params.id));
        res.status(200).json({ success: true, message: "Quest deleted successfully" });

    } catch (error) {
        res.status(500).json({
            success: false,
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
