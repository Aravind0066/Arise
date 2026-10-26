const express = require('express');
const { generateWeaknessRecommendations } = require('../controllers/weaknessRecommendationController');

const router = express.Router();

// POST /api/weakness
router.post('/', generateWeaknessRecommendations);

module.exports = router;
