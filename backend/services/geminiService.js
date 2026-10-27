const { GoogleGenerativeAI } = require("@google/generative-ai");
const Ajv = require("ajv");
const ajv = new Ajv();

// Default for chat/nutrition/other Gemini consumers; workout generation passes
// its own configurable timeout from aiController.
const DEFAULT_TIMEOUT_MS = 12000;

// Known-good default after Gemini 2.0 shutdown (June 2026).
const DEFAULT_MODEL = 'gemini-3.5-flash';

// Models that 404 or hang in current API — remap to DEFAULT_MODEL.
const REMAPPED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001',
  'gemini-2.5-flash',
  'gemini-3.5-flash-lite', // hangs / unavailable in practice
]);

// Internal utilities for testing/mockability
const _internal = { getClient, DEFAULT_TIMEOUT_MS, resolveModel };


/**
 * Retrieve a Gemini client using the API key from environment variables.
 * Returns null if the key is missing.
 */
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Resolve the Gemini model id, remapping shut-down / hanging aliases.
 */
function resolveModel(requested) {
  const configured = (requested || process.env.GEMINI_MODEL || '').trim();
  if (!configured || REMAPPED_MODELS.has(configured)) {
    return DEFAULT_MODEL;
  }
  return configured;
}

/**
 * Generate a response from Gemini.
 *
 * @param {string} prompt - The text prompt to send to Gemini.
 * @param {object} [options] - Optional configuration.
 * @param {string} [options.model] - Model name (default: gemini-3.5-flash).
 * @param {number} [options.timeout] - Request timeout in ms.
 * @returns {Promise<{success:boolean, data?:any, error?:string}>}
 */
async function generateResponse(prompt, options = {}) {
  const client = _internal.getClient();
  if (!client) {
    return { success: false, error: "GEMINI_API_KEY not configured" };
  }

  const selectedModel = resolveModel(options.model);

  const model = client.getGenerativeModel({
    model: selectedModel,
  });

  const controller = new AbortController();
  const callerSignal = options.signal;
  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const result = await model.generateContent(prompt, { signal: controller.signal });
    if (callerSignal?.aborted) return { success: false, error: 'Gemini request cancelled' };
    const text = result?.response?.text?.();
    if (!text) {
      return { success: false, error: "Empty response from Gemini" };
    }

    // Attempt to parse JSON; strip markdown code blocks if present; if it fails, return raw text.
    let parsed;
    try {
      const cleaned = typeof text === 'string'
        ? text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
        : text;
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = text;
    }

    // Placeholder for future schema validation using ajv.
    return { success: true, data: parsed };
  } catch (err) {
    if (callerSignal?.aborted) {
      return { success: false, error: 'Gemini request cancelled' };
    }
    if (err.name === "AbortError") {
      return { success: false, error: timedOut ? `Gemini request timed out after ${timeoutMs}ms` : 'Gemini request aborted' };
    }
    if (err.code === 429) {
      return { success: false, error: err.message || "Rate limit exceeded" };
    }
    return { success: false, error: err.message || "Gemini request failed" };
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

module.exports = {
  generateResponse,
  _internal,
};
