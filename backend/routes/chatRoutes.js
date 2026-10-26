const express = require('express');
const { chat } = require('../controllers/chatController');

const router = express.Router();

// POST /api/chat
router.post('/', chat);

module.exports = router;
