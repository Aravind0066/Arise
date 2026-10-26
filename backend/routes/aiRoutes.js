const express = require('express');
const { generate } = require('../controllers/aiController');

const router = express.Router();

// POST /api/ai/generate
router.post('/generate', generate);

module.exports = router;
