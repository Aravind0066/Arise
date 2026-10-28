const MAX_CHAT_REPLY_CHARACTERS = 4000;

function extractQwenFinalSegment(value) {
  const content = value.trim();
  if (content.startsWith('<think>')) {
    const end = content.indexOf('</think>');
    if (end < 0) return null;
    return content.slice(end + '</think>'.length).trim() || null;
  }
  if (content.startsWith('</think>')) return content.slice('</think>'.length).trim() || null;
  if (content.includes('<think>') || content.includes('</think>')) return null;
  return content;
}

function normalizeChatReply(raw) {
  if (typeof raw !== 'string') return null;
  let content = extractQwenFinalSegment(raw);
  if (!content) return null;
  const fence = content.match(/^```(?:text|markdown|json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) content = fence[1].trim();
  if (/^[\[{]/.test(content)) {
    try {
      const parsed = JSON.parse(content);
      const reply = parsed && !Array.isArray(parsed) && typeof parsed === 'object'
        ? (typeof parsed.reply === 'string' ? parsed.reply : parsed.data?.reply)
        : null;
      if (typeof reply !== 'string') return null;
      content = reply.trim();
    } catch { return null; }
  }
  if (!content || content.length > MAX_CHAT_REPLY_CHARACTERS) return null;
  if (/(?:^|\n)\s*(?:analysis|reasoning|chain of thought|internal reasoning)\s*[:\-]/i.test(content) ||
      /(?:^|\n)\s*(?:conversation history:|user message:|system prompt:|return only the final|respond in a helpful, concise|never claim knowledge about|do not award xp)/i.test(content) ||
      /^(?:we need to (?:answer|respond|reply)|(?:okay,?\s+)?the user (?:said|asks|is asking)|the prompt (?:says|asks|requires)|let me think through this|i should respond)/i.test(content)) return null;
  return content;
}

module.exports = { normalizeChatReply, MAX_CHAT_REPLY_CHARACTERS };
