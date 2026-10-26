const geminiService = require('../services/geminiService');

/**
 * POST /api/ai/generate
 * Expected body: { prompt: string }
 */
async function generate(req, res) {
  const { prompt } = req.body || {};
  // Input validation
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Prompt is required and must be a non‑empty string.' });
  }
  if (prompt.length > 4000) {
    return res
      .status(400)
      .json({ success: false, error: 'Prompt exceeds maximum length of 4000 characters.' });
  }

  try {
    const result = await geminiService.generateResponse(prompt);
    if (result.success) {
      return res.json({ success: true, data: result.data });
    }
    // Service reported an error (e.g., missing key, timeout, rate limit)
    return res.status(502).json({ success: false, error: result.error });
  } catch (err) {
    // Unexpected error – do not leak stack trace
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
}

module.exports = { generate };
