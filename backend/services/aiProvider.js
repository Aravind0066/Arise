const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'qwen3:4b';
const DEFAULT_TIMEOUT_MS = 120000;
const HEALTH_TIMEOUT_MS = 2500;

function getConfig() {
  return {
    baseUrl: (process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, ''),
    model: (process.env.OLLAMA_MODEL || DEFAULT_MODEL).trim(),
  };
}

function parseContent(content) {
  if (typeof content !== 'string' || !content.trim()) throw new Error('Ollama returned an empty response.');
  const cleaned = stripModelWrappers(content);
  try { return JSON.parse(cleaned); } catch { return content.trim(); }
}

function stripThinking(content) {
  return content.trim().replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function stripModelWrappers(content) {
  let cleaned = stripThinking(content);
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) cleaned = fence[1].trim();
  // Some local model builds emit a short preamble before the requested JSON.
  const start = cleaned.search(/[\[{]/);
  if (start >= 0) {
    const stack = [];
    let inString = false;
    let escaped = false;
    for (let i = start; i < cleaned.length; i += 1) {
      const char = cleaned[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{' || char === '[') stack.push(char);
      else if (char === '}' || char === ']') {
        if (stack.pop() !== (char === '}' ? '{' : '[')) return cleaned;
        if (!stack.length) return cleaned.slice(start, i + 1).trim();
      }
    }
  }
  return cleaned;
}

function describeOutputShape(value) {
  if (Array.isArray(value)) {
    return { type: 'array', length: value.length, firstItemKeys: value[0] && typeof value[0] === 'object' ? Object.keys(value[0]).slice(0, 20) : [] };
  }
  if (value && typeof value === 'object') return { type: 'object', keys: Object.keys(value).slice(0, 30) };
  return { type: typeof value, ...(typeof value === 'string' ? { characters: value.length } : {}) };
}

async function checkAvailability() {
  const { baseUrl, model } = getConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    if (!response.ok) return { status: 'ollama_unavailable', model, message: `Ollama health check failed (HTTP ${response.status}).` };
    const payload = await response.json();
    const installed = Array.isArray(payload?.models) ? payload.models.map((entry) => entry?.name).filter((name) => typeof name === 'string') : [];
    if (!installed.includes(model)) return { status: 'model_missing', model, message: `Configured Ollama model "${model}" is not installed.` };
    return { status: 'model_ready', model, message: 'Ollama is reachable and the configured model is installed; live inference has not been checked.' };
  } catch (error) {
    return {
      status: 'ollama_unavailable',
      model,
      message: error?.name === 'AbortError' ? 'Ollama health check timed out.' : 'Ollama is not reachable from the backend host.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function classifyProviderFailure(error, httpStatus) {
  const detail = String(error || '');
  if (/model .* not found|pull .* model/i.test(detail) || httpStatus === 404) return 'MODEL_NOT_FOUND';
  if (/timed out/i.test(detail)) return 'GENERATION_TIMEOUT';
  if (/not reachable|econnrefused|fetch failed/i.test(detail)) return 'OLLAMA_UNAVAILABLE';
  return 'OLLAMA_PROVIDER_ERROR';
}

function responseStatusFor(errorType) {
  if (errorType === 'GENERATION_TIMEOUT') return 504;
  if (errorType === 'OLLAMA_UNAVAILABLE' || errorType === 'MODEL_NOT_FOUND') return 503;
  return 502;
}

async function generateResponse(prompt, options = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) return { success: false, error: 'Prompt is required.' };
  const { baseUrl, model } = getConfig();
  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const wantsJson = options.responseMode === 'json' || options.format !== undefined ||
    (options.responseMode !== 'text' && /return (only )?(a )?json|json array|json object/i.test(prompt));
  const controller = new AbortController();
  let timedOut = false;
  const callerSignal = options.signal;
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);

  try {
    const messages = [];
    if (typeof options.system === 'string' && options.system.trim()) messages.push({ role: 'system', content: options.system.trim() });
    if (Array.isArray(options.historyMessages)) {
      options.historyMessages.forEach((entry) => {
        if ((entry?.role === 'user' || entry?.role === 'assistant') && typeof entry.content === 'string' && entry.content.trim()) {
          messages.push({ role: entry.role, content: entry.content });
        }
      });
    }
    messages.push({ role: 'user', content: prompt });
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        // Chat uses Ollama's documented split: message.thinking vs message.content.
        // think:false on Qwen3 can dump untagged reasoning into content.
        think: options.responseMode === 'text',
        ...(wantsJson ? { format: options.format || 'json' } : {}),
        ...(options.generationOptions ? { options: options.generationOptions } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const detail = typeof body.error === 'string' ? body.error : '';
      if (response.status === 404 || /model .* not found|pull .* model/i.test(detail)) {
        return { success: false, error: `Configured Ollama model "${model}" is not installed. Install it with: ollama pull ${model}`, errorType: 'MODEL_NOT_FOUND' };
      }
      return { success: false, error: `Ollama inference failed (HTTP ${response.status}).`, errorType: 'OLLAMA_PROVIDER_ERROR' };
    }
    const payload = await response.json();
    const content = payload?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      const thinkingOnly = typeof payload?.message?.thinking === 'string' && payload.message.thinking.trim();
      return {
        success: false,
        error: thinkingOnly
          ? 'Hunter AI used its reasoning budget before producing a user-facing answer. Retry the message.'
          : 'Ollama returned a malformed or empty response.',
        errorType: 'INVALID_PROVIDER_RESPONSE',
        retryable: Boolean(thinkingOnly),
      };
    }
    try {
      const data = options.responseMode === 'text' ? content.trim() : parseContent(content);
      if (wantsJson && typeof data === 'string') {
        return { success: false, error: 'Ollama returned text instead of the requested JSON response.', errorType: 'MALFORMED_MODEL_OUTPUT' };
      }
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[Ollama output] feature=${options.feature || 'unspecified'} mode=${options.responseMode || (wantsJson ? 'json' : 'auto')} shape=${JSON.stringify(describeOutputShape(data))} messageFields=${JSON.stringify(Object.keys(payload.message || {}))} separateThinking=${typeof payload.message?.thinking === 'string'}`);
      }
      return { success: true, data, provider: 'ollama', model };
    } catch {
      return { success: false, error: 'Ollama returned malformed JSON for the requested response structure.', errorType: 'MALFORMED_MODEL_OUTPUT' };
    }
  } catch (error) {
    if (callerSignal?.aborted) return { success: false, error: 'Ollama request cancelled.', errorType: 'REQUEST_CANCELLED' };
    if (timedOut) return { success: false, error: `Ollama request timed out after ${timeoutMs}ms.`, errorType: 'GENERATION_TIMEOUT' };
    if (error?.name === 'AbortError') return { success: false, error: 'Ollama request was aborted.', errorType: 'OLLAMA_PROVIDER_ERROR' };
    const errorType = classifyProviderFailure(error?.message, error?.status);
    if (errorType === 'OLLAMA_UNAVAILABLE') return { success: false, error: 'Ollama is not reachable from the backend host. Check OLLAMA_BASE_URL and the Ollama service.', errorType };
    return { success: false, error: 'Ollama inference failed. Check the configured model and provider logs.', errorType };
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

module.exports = { generateResponse, parseContent, stripModelWrappers, stripThinking, describeOutputShape, getConfig, checkAvailability, classifyProviderFailure, responseStatusFor, DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_TIMEOUT_MS, HEALTH_TIMEOUT_MS };
