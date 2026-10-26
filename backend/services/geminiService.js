const { GoogleGenerativeAI } = require("@google/generative-ai");
const Ajv = require("ajv");
const ajv = new Ajv();

// Default timeout for Gemini requests (ms)
const DEFAULT_TIMEOUT_MS = 10000;

// Internal utilities for testing/mockability
const _internal = { getClient, DEFAULT_TIMEOUT_MS };


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
 * Generate a response from Gemini.
 *
 * @param {string} prompt - The text prompt to send to Gemini.
 * @param {object} [options] - Optional configuration.
 * @param {string} [options.model] - Model name (default: gemini-1.5-flash).
 * @param {number} [options.timeout] - Request timeout in ms.
 * @returns {Promise<{success:boolean, data?:any, error?:string}>}
 */
async function generateResponse(prompt, options = {}) {
  const client = _internal.getClient();
  if (!client) {
    return { success: false, error: "GEMINI_API_KEY not configured" };
  }

  const model = client.getGenerativeModel({
    model: options.model || "gemini-1.5-flash",
  });

  const controller = new AbortController();
  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await model.generateContent(prompt, { signal: controller.signal });
    clearTimeout(timeout);
    const text = result?.response?.text?.();
    if (!text) {
      return { success: false, error: "Empty response from Gemini" };
    }

    // Attempt to parse JSON; if it fails, return raw text.
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    // Placeholder for future schema validation using ajv.
    return { success: true, data: parsed };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      return { success: false, error: "Gemini request timed out" };
    }
    if (err.code === 429) {
      return { success: false, error: err.message || "Rate limit exceeded" };
    }
    return { success: false, error: err.message || "Gemini request failed" };
  }
}

module.exports = {
  generateResponse,
  _internal,
};
