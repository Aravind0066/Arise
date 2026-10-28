import type { HunterQuest, StatType, ApiResponse, AiGenerateInput, AiGenerateResponse, WeaknessInput, WeaknessRecommendation, WeaknessResponse, NutritionInput, NutritionRecommendation, NutritionResponse, ChatInput, ChatResponse, ChatApiResponse } from './hunterTypes.ts';



function isNonPublicApiHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host === '0.0.0.0') return true;
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return octets[0] === 10 || octets[0] === 127 || octets[0] === 0 || octets[0] === 169 && octets[1] === 254 ||
    octets[0] === 192 && octets[1] === 168 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31;
}

export interface CloudHealthResponse {
  status: string;
  backendStatus: 'available' | 'unavailable';
  uptimeSeconds: number;
  timestamp: string;
  cloudService: string;
  database: string;
  aiProvider: { status: string; model?: string; message: string };
  latencyMs: number;
  isOnline: boolean;
}

export function getExpoDevelopmentApiBaseUrl(hostUri?: string): string | null {
  if (!hostUri) return null;
  try {
    const host = new URL(`http://${hostUri}`).hostname;
    const formattedHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
    return `http://${formattedHost}:5000/api`;
  } catch { return null; }
}

export function getApiBaseUrl(): string {
  const rawConfiguredUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
  if (process.env.NODE_ENV === 'production') {
    if (!rawConfiguredUrl) {
      throw new Error('EXPO_PUBLIC_API_URL must be set to the deployed HTTPS backend before building for production.');
    }
    let productionUrl: URL;
    try {
      productionUrl = new URL(rawConfiguredUrl);
    } catch {
      throw new Error('EXPO_PUBLIC_API_URL must be a valid public HTTPS backend URL in production.');
    }
    if (productionUrl.protocol !== 'https:' || isNonPublicApiHost(productionUrl.hostname)) {
      throw new Error('EXPO_PUBLIC_API_URL must use a public HTTPS backend URL in production; localhost and private addresses are not allowed.');
    }
  }
  if (rawConfiguredUrl) {
    const configuredUrl = rawConfiguredUrl.replace(/\/+$/, '');
    return configuredUrl.endsWith('/api') ? configuredUrl : `${configuredUrl}/api`;
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:5000/api`;
  }
  const expoHostUri = (globalThis as typeof globalThis & { __HUNTEROS_EXPO_HOST_URI__?: string }).__HUNTEROS_EXPO_HOST_URI__;
  const expoApiBaseUrl = getExpoDevelopmentApiBaseUrl(expoHostUri);
  if (expoApiBaseUrl) return expoApiBaseUrl;
  return 'http://localhost:5000/api';
}

function isHtmlBody(rawText: string, contentType: string): boolean {
  const trimmed = rawText.trim().toLowerCase();
  if (contentType.includes('text/html')) return true;
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

export class ApiRequestError extends Error {
  kind: 'backend' | 'ai';
  status?: number;
  diagnostic?: string;
  errorType?: string;

  constructor(message: string, kind: 'backend' | 'ai', status?: number, diagnostic?: string, errorType?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.kind = kind;
    this.status = status;
    this.diagnostic = diagnostic;
    this.errorType = errorType;
  }
}

/** A development-only safe endpoint display; credentials and query strings are never shown. */
export function getSafeApiBaseUrlForDiagnostics(): string {
  try {
    const url = new URL(getApiBaseUrl());
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return 'API base URL could not be resolved';
  }
}

const AI_UNAVAILABLE_MESSAGE = 'Hunter AI is temporarily unavailable. Please try again later.';

function isAiEndpoint(path: string) {
  return /(?:^|\/)(?:ai\/generate|quests\/generate|weakness|nutrition|chat)(?:\/|$)/.test(path);
}

function assertLiveAiResult<T extends { success?: boolean; fallback?: boolean }>(result: T): T {
  if (result.fallback || result.success === false) {
    throw new ApiRequestError(AI_UNAVAILABLE_MESSAGE, 'ai');
  }
  return result;
}

/**
 * Executes a network request with timeout, content-type verification, and informative errors.
 * Reads the body as text first so HTML/error pages never surface as raw JSON parse exceptions.
 */
async function requestWithTimeout<T>(path: string, options?: RequestInit, timeoutMs: number = 30000): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const callerSignal = options?.signal;
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const baseUrl = getApiBaseUrl();
  const cleanPath = path.replace(/^\/+/, '');
  const fullUrl = `${baseUrl}/${cleanPath}`;

  try {
    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    });

    const contentType = response.headers?.get?.('content-type') || '';
    const rawText = await response.text();

    if (isHtmlBody(rawText, contentType) || (contentType && !contentType.includes('application/json') && !contentType.includes('+json'))) {
      if (response.status === 404) {
        throw new Error(`Endpoint /${cleanPath} not found on server (HTTP 404). Check backend route configuration.`);
      }
      if (!response.ok) {
        throw new Error(
          `Server returned HTTP ${response.status} with non-JSON response: ${rawText.slice(0, 100).trim() || 'No details'}`
        );
      }
      throw new Error(
        'Server returned HTML/text instead of JSON. Ensure the HunterOS backend is running and the app is configured with the correct backend address.'
      );
    }

    let payload: any;
    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error(
        `Server returned invalid or malformed JSON from ${fullUrl}. Body starts with: ${rawText.slice(0, 60).trim() || '(empty)'}`
      );
    }

    if (!response.ok) {
      const errDetail = String(payload?.error || payload?.message || `Request failed with HTTP ${response.status}`);
      const providerErrorType = String(payload?.errorType || '');
      const aiProviderError = isAiEndpoint(cleanPath) && (
        ['AI_PROVIDER_UNAVAILABLE', 'MODEL_NOT_FOUND', 'GENERATION_TIMEOUT', 'OLLAMA_UNAVAILABLE', 'OLLAMA_PROVIDER_ERROR', 'INVALID_PROVIDER_RESPONSE', 'AI_RESPONSE_INVALID', 'MALFORMED_MODEL_OUTPUT', 'OUTPUT_SCHEMA_VALIDATION_FAILED'].includes(providerErrorType) || response.status === 429 ||
        /ollama|ai provider|quota|rate.?limit|api key|model unavailable|provider error/i.test(errDetail)
      );
      const specificAiError = ['MODEL_NOT_FOUND', 'GENERATION_TIMEOUT', 'OLLAMA_UNAVAILABLE', 'OLLAMA_PROVIDER_ERROR', 'INVALID_PROVIDER_RESPONSE', 'AI_RESPONSE_INVALID', 'MALFORMED_MODEL_OUTPUT', 'OUTPUT_SCHEMA_VALIDATION_FAILED'].includes(providerErrorType);
      const message = specificAiError ? errDetail : aiProviderError
        ? (/^Ollama\b/i.test(errDetail) ? errDetail : AI_UNAVAILABLE_MESSAGE)
        : errDetail;
      throw new ApiRequestError(message, aiProviderError ? 'ai' : 'backend', response.status, undefined, providerErrorType || undefined);
    }

    return payload as T;
  } catch (err: any) {
    if (callerSignal?.aborted) {
      const cancelled = new Error('Request cancelled.');
      cancelled.name = 'AbortError';
      throw cancelled;
    }
    if (timedOut || err.name === 'AbortError') {
      if (isAiEndpoint(cleanPath)) {
        throw new ApiRequestError(`AI generation timed out while waiting for the backend and Ollama (${timeoutMs / 1000}s). Check Ollama and retry.`, 'ai', 504);
      }
      throw new ApiRequestError(`HunterOS backend did not respond within ${timeoutMs / 1000} seconds. Please try again.`, 'backend');
    }
    const msg = String(err?.message || '');
    if (msg.includes('Failed to fetch') || msg.includes('Network request failed') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      const endpoint = getSafeApiBaseUrlForDiagnostics();
      const diagnostic = `API ${endpoint} · fetch error: ${msg || 'unknown connection error'}`;
      throw new ApiRequestError('Could not connect to the HunterOS backend.', 'backend', undefined, diagnostic);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  return requestWithTimeout<T>(path, options, isAiEndpoint(path) ? getAiGenerationTimeoutMs() : 30000);
}

export async function checkCloudHealth(): Promise<CloudHealthResponse> {
  const start = Date.now();
  try {
    const res = await request<Omit<CloudHealthResponse, 'latencyMs' | 'isOnline'>>('/health');
    return {
      ...res,
      latencyMs: Date.now() - start,
      isOnline: true,
    };
  } catch {
    return {
      status: 'offline',
      backendStatus: 'unavailable',
      uptimeSeconds: 0,
      timestamp: new Date().toISOString(),
      cloudService: 'HunterOS Core (Standby / Local First)',
      database: 'Device Local Storage (AsyncStorage)',
      aiProvider: { status: 'not_checked', message: 'Backend unavailable; Ollama status was not checked.' },
      latencyMs: 0,
      isOnline: false,
    };
  }
}

export async function generateQuests(input: {
  goal: string;
  category: string;
  availableMinutes: number;
  difficulty: string;
}): Promise<{ success: boolean; data: HunterQuest[]; source: string; fallback: boolean }> {
    const result = await request<{ success: boolean; data: any[]; source?: string; fallback?: boolean; fallbackReason?: string; error?: string; errorType?: string }>('/quests/generate', {
      method: 'POST',
      body: JSON.stringify(input),
    });

  if (!result.success || !Array.isArray(result.data) || result.data.length !== 3) {
    throw new ApiRequestError(result.error || 'Quest generation did not return three valid directives. Retry generation.', 'ai', undefined, undefined, result.errorType || 'OUTPUT_SCHEMA_VALIDATION_FAILED');
  }
  const fallback = result.fallback === true || result.source === 'hunteros-engine';

    const mapped: HunterQuest[] = result.data.map((q, idx) => {
      let targetStat: StatType = 'knowledge';
      const cat = (input.category || q.category || '').toLowerCase();
      if (cat.includes('fitness') || cat.includes('strength')) targetStat = 'strength';
      else if (cat.includes('health')) targetStat = 'health';
      else if (cat.includes('discipline')) targetStat = 'discipline';
      else if (cat.includes('mind')) targetStat = 'mindfulness';

      return {
        _id: q._id || `ai_quest_${Date.now()}_${idx}`,
        title: q.title,
        description: q.description,
        category: (input.category as any) || 'Study',
        targetStat,
        statBonus: Math.max(2, Math.min(6, Math.round((q.xpReward || 50) / 18))),
        xpReward: q.xpReward || 60,
        deadline: q.deadline || new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        generatedBy: fallback ? 'system' : 'ai',
        status: 'active',
        ...(fallback ? { fallback: true } : {}),
      };
    });

    return { success: true, data: mapped, source: result.source || (fallback ? 'hunteros-engine' : 'ollama-local'), fallback };
}

/**
 * Call the configured AI provider through the backend.
 * @param input Prompt to send.
 */
const DEFAULT_AI_GENERATION_TIMEOUT_MS = 180000;

function getAiGenerationTimeoutMs(): number {
  const configured = Number(process.env.EXPO_PUBLIC_AI_GENERATION_TIMEOUT_MS);
  return Number.isInteger(configured) && configured >= 15000 && configured <= 180000
    ? configured
    : DEFAULT_AI_GENERATION_TIMEOUT_MS;
}

export async function generateAI(input: { prompt: string; responseFormat?: 'workout' }, options: { signal?: AbortSignal; timeoutMs?: number } = {}) {
  if (!input.prompt || input.prompt.trim().length === 0) {
    throw new Error('Prompt must be a non‑empty string');
  }
  return requestWithTimeout<ApiResponse<unknown>>('/ai/generate', {
    method: 'POST',
    body: JSON.stringify(input),
    signal: options.signal,
  }, options.timeoutMs ?? getAiGenerationTimeoutMs());

}

/** Weakness‑based quest recommendations */
export async function getWeaknessRecommendations(payload: WeaknessInput): Promise<WeaknessResponse> {
  const result = await request<WeaknessResponse>('/weakness', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result;
}

/** Nutrition recommendations */
export async function getNutritionRecommendations(payload: NutritionInput): Promise<NutritionResponse> {
  const result = await request<NutritionResponse>('/nutrition', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return assertLiveAiResult(result);
}

/** Chat with AI */
export async function chatWithAI(payload: ChatInput): Promise<ChatApiResponse> {
  if (payload.message.length > 2000) {
    throw new Error('Message exceeds maximum length of 2000 characters');
  }
  const result = await request<ChatApiResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return assertLiveAiResult(result);
}
