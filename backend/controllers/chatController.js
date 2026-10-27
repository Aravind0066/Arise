// Chat controller for Hunter AI
// Exposes POST /api/chat
// Uses Gemini service, provides deterministic fallback.

const geminiService = require('../services/geminiService');

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

  // Build prompt with RPG‑themed personality
  const promptLines = [];
  promptLines.push('You are Hunter, a friendly RPG‑themed AI assistant for the HunterOS app.');
  promptLines.push('You can help with quest ideas, study routines, workouts, motivation, and general nutrition questions.');
  promptLines.push('Never claim knowledge about the user’s profile, progress, or stats unless the conversation history provides it.');
  promptLines.push('Do not award XP, complete quests, or modify user data.');
  if (history && history.length) {
    promptLines.push('Conversation history:');
    history.forEach((h) => {
      const prefix = h.role === 'user' ? 'User' : 'Assistant';
      promptLines.push(`${prefix}: ${h.content}`);
    });
  }
  promptLines.push('User message:');
  promptLines.push(message);
  promptLines.push('Respond in a helpful, concise, RPG‑flavored tone.');

  const prompt = promptLines.join('\n');

  let reply = null;
  let usedFallback = false;

  if (process.env.GEMINI_API_KEY) {
    const result = await geminiService.generateResponse(prompt);
    if (result.success) {
      reply = result.data;
    } else {
      console.warn('Gemini chat error:', result.error);
    }
  }

  // Simple validation of Gemini reply
  const isValidReply = (r) => typeof r === 'string' && r.trim().length > 0;

  if (!isValidReply(reply)) {
    usedFallback = true;
    const lower = message.toLowerCase();
    if (lower.includes('study') || lower.includes('learn') || lower.includes('focus')) {
      reply = 'Hunter directive: Implement 25-minute Pomodoro focus blocks with zero notifications. Log each study block to raise your Knowledge stat.';
    } else if (lower.includes('routine') || lower.includes('workout') || lower.includes('fitness') || lower.includes('exercise')) {
      reply = 'Hunter directive: Execute 20 push-ups, 30 bodyweight squats, and a 60-second core plank to calibrate your physical matrix.';
    } else if (lower.includes('discipline') || lower.includes('habit') || lower.includes('procrastinat')) {
      reply = 'Hunter directive: Eliminate micro-distractions such as infinite scrolling. System discipline scales through consistent daily execution.';
    } else if (lower.includes('eat') || lower.includes('nutrition') || lower.includes('diet') || lower.includes('food')) {
      reply = 'Hunter directive: Consume complex carbohydrates and lean protein 45 minutes prior to dungeon entry for optimal glycogen availability.';
    } else {
      reply = 'Hunter directive received. Maintain strict focus on your active directives, daily habits, and recovery protocols to ascend ranks.';
    }
  }

  return res.json({
    success: true,
    fallback: usedFallback,
    reply,
    data: { reply, fallback: usedFallback },
  });
}

module.exports = { chat };
