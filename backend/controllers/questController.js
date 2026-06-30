const Quest = require("../models/Quest");


const createQuest = async (req, res) => {
    try {
        const quest = await Quest.create(req.body);

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
        const quests = await Quest.find();

        res.status(200).json({
            success: true,
            data: quests,
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

const updateQuest = async (req, res) => {
    try{
        const quest = await Quest.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
};