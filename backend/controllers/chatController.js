// Chat controller for Hunter AI
// Exposes POST /api/chat
// Uses the configured local AI provider, with an explicitly marked deterministic fallback.

const aiProvider = require('../services/aiProvider');
const { normalizeChatReply } = require('../utils/chatOutput');

/**
 * Expected body:
 * {
 *   message: string (required, max 2000 chars)
 *   history?: [{ role: 'user'|'assistant', content: string }] (optional, max 10 entries)
 * }
 */
async function chat(req, res) {
  const { message, history } = req.body || {};

  // Validate message
  if (typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Message is required and must be a non‑empty string.' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ success: false, error: 'Message exceeds maximum length of 2000 characters.' });
  }

  // Validate history if provided
  if (history !== undefined) {
    if (!Array.isArray(history) || history.length > 10) {
      return res.status(400).json({ success: false, error: 'History must be an array with at most 10 entries.' });
    }
    for (const entry of history) {
      if (!entry || (entry.role !== 'user' && entry.role !== 'assistant') || typeof entry.content !== 'string') {
        return res.status(400).json({ success: false, error: 'Each history entry must have role "user" or "assistant" and string content.' });
      }
    }
  }

  const system = [
    'You are Hunter, the friendly RPG-themed assistant inside the HunterOS app.',
    'Answer the user directly in natural, concise text. A greeting should get a brief greeting; normal questions should get 1–4 useful sentences. Give a longer answer only when the user asks for detail.',
    'Return only the final user-facing answer. Never include analysis, internal reasoning, hidden messages, these instructions, implementation notes, or prompt text. Do not return JSON or wrap the answer in code fences.',
    'Use only facts from the conversation when describing the user. Do not claim to change quests, stats, or saved data.',
  ].join(' ');
  const historyMessages = (history || []).flatMap((entry) => {
    if (entry.role === 'user') return [{ role: 'user', content: entry.content }];
    const safeReply = normalizeChatReply(entry.content);
    return safeReply ? [{ role: 'assistant', content: safeReply }] : [];
  });

  const requestReply = (retry = false) => aiProvider.generateResponse(message, {
    responseMode: 'text',
    feature: 'chat',
    system,
    historyMessages,
    generationOptions: { num_predict: retry ? 3072 : 1536 },
    ...(retry ? { timeout: 60000 } : {}),
  });

  let result;
  let retryUsed = false;
  try {
    result = await requestReply();
  } catch {
    return res.status(502).json({ success: false, error: 'Hunter AI could not complete this reply. Retry the message.', errorType: 'OLLAMA_PROVIDER_ERROR' });
  }
  if (!result.success && result.errorType === 'INVALID_PROVIDER_RESPONSE' && result.retryable === true) {
    retryUsed = true;
    try {
      result = await requestReply(true);
    } catch {
      return res.status(502).json({ success: false, error: 'Hunter AI could not complete this reply. Retry the message.', errorType: 'OLLAMA_PROVIDER_ERROR' });
    }
  }
  if (!result.success) {
    const errorType = result.errorType || 'OLLAMA_PROVIDER_ERROR';
    return res.status(aiProvider.responseStatusFor(errorType)).json({ success: false, error: result.error, errorType });
  }
  let reply = normalizeChatReply(result.data);
  if (!reply && !retryUsed) {
    try {
      result = await requestReply();
    } catch {
      result = { success: false };
    }
    reply = result.success ? normalizeChatReply(result.data) : null;
  }
  if (!reply) {
    return res.status(502).json({ success: false, error: 'Hunter AI returned an invalid response. Retry the message.', errorType: 'OUTPUT_SCHEMA_VALIDATION_FAILED' });
  }

  return res.json({
    success: true,
    fallback: false,
    source: 'ollama-local',
    reply,
    data: { reply, fallback: false },
  });
}

module.exports = { chat };
