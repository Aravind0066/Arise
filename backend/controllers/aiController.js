const aiProvider = require('../services/aiProvider');
const { workoutSchema } = require('../utils/outputSchemas');

function getWorkoutGenerationTimeoutMs() {
  const configured = Number(process.env.OLLAMA_GENERATION_TIMEOUT_MS);
  return Number.isInteger(configured) && configured >= 15000 && configured <= 180000
    ? configured
    : 180000;
}

/**
 * POST /api/ai/generate
 * Expected body: { prompt: string }
 */
async function generate(req, res) {
  const { prompt, responseFormat } = req.body || {};
  // Input validation
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Prompt is required and must be a non‑empty string.' });
  }
  if (prompt.length > 4000) {
    return res
      .status(400)
      .json({ success: false, error: 'Prompt exceeds maximum length of 4000 characters.' });
  }

  const controller = new AbortController();
  const abortIfClientDisconnected = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on?.('close', abortIfClientDisconnected);
  try {
    let result;
    try {
      result = await aiProvider.generateResponse(prompt, {
        timeout: getWorkoutGenerationTimeoutMs(),
        signal: controller.signal,
        responseMode: responseFormat === 'workout' ? 'json' : undefined,
        format: responseFormat === 'workout' ? workoutSchema : undefined,
        feature: responseFormat === 'workout' ? 'workout' : 'generation',
      });
    } catch {
      if (controller.signal.aborted) return;
      return res.status(502).json({ success: false, error: 'Ollama inference failed unexpectedly. Check provider availability and retry.', errorType: 'OLLAMA_PROVIDER_ERROR' });
    }
    if (controller.signal.aborted) return;
    if (result.success) {
      return res.json({ success: true, data: result.data, provider: result.provider, model: result.model });
    }
    // Service reported an error (e.g., missing key, timeout, rate limit)
    const errorType = result.errorType || 'OLLAMA_PROVIDER_ERROR';
    return res.status(aiProvider.responseStatusFor(errorType)).json({
      success: false,
      error: result.error,
      errorType,
    });
  } catch (err) {
    // Unexpected error – do not leak stack trace
    return res.status(502).json({ success: false, error: 'Ollama inference failed unexpectedly.', errorType: 'OLLAMA_PROVIDER_ERROR' });
  } finally {
    res.off?.('close', abortIfClientDisconnected);
  }
}

module.exports = { generate };
