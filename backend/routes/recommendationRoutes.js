const express = require("express");
const { generateRecommendations } = require("../controllers/recommendationController");

const router = express.Router();

router.post("/generate", generateRecommendations);

module.exports = router;
