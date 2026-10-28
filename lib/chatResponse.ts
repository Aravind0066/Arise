const MAX_CHAT_REPLY_CHARACTERS = 4000;
const HIDDEN_INVALID_REPLY = 'This saved Hunter AI response could not be displayed because it contained invalid output.';

function extractQwenFinalSegment(value: string): string | null {
  const content = value.trim();
  if (content.startsWith('<think>')) {
    const end = content.indexOf('</think>');
    if (end < 0) return null;
    return content.slice(end + '</think>'.length).trim() || null;
  }
  // Some Qwen thinking-only model templates emit the closing marker without an opening marker.
  if (content.startsWith('</think>')) return content.slice('</think>'.length).trim() || null;
  if (content.includes('<think>') || content.includes('</think>')) return null;
  return content;
}

function unwrapTextFence(value: string): string {
  const match = value.match(/^```(?:text|markdown|json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : value;
}

function unwrapReplyObject(value: string): string | null | undefined {
  if (!/^[\[{]/.test(value.trim())) return undefined;
  try {
    const parsed = JSON.parse(value.trim());
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const reply = typeof parsed.reply === 'string' ? parsed.reply : parsed.data?.reply;
      return typeof reply === 'string' ? reply : null;
    }
    return null;
  } catch {
    return null;
  }
}

function containsPromptOrReasoningLeak(value: string): boolean {
  return /(?:^|\n)\s*(?:analysis|reasoning|chain of thought|internal reasoning)\s*[:\-]/i.test(value) ||
    /(?:^|\n)\s*(?:conversation history:|user message:|system prompt:|return only the final|respond in a helpful, concise|never claim knowledge about|do not award xp)/i.test(value) ||
    /^(?:we need to (?:answer|respond|reply)|(?:okay,?\s+)?the user (?:said|asks|is asking)|the prompt (?:says|asks|requires)|let me think through this|i should respond)/i.test(value.trim());
}

/** Return only safe user-facing text; null means the provider output should be rejected. */
export function normalizeChatReply(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const qwenFinal = extractQwenFinalSegment(raw);
  if (!qwenFinal) return null;
  const unfenced = unwrapTextFence(qwenFinal);
  const unwrapped = unwrapReplyObject(unfenced);
  if (unwrapped === null) return null;
  const text = (unwrapped ?? unfenced).trim();
  if (!text || text.length > MAX_CHAT_REPLY_CHARACTERS || containsPromptOrReasoningLeak(text)) return null;
  return text;
}

export function sanitizeStoredAssistantReply(raw: string): string {
  return normalizeChatReply(raw) ?? HIDDEN_INVALID_REPLY;
}
