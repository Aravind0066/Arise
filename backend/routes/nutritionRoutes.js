const express = require('express');
const { generateNutritionRecommendations } = require('../controllers/nutritionController');

const router = express.Router();

// POST /api/nutrition
router.post('/', generateNutritionRecommendations);

module.exports = router;
