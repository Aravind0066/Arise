import type { HunterQuest, StatType, ApiResponse, AiGenerateInput, AiGenerateResponse, WeaknessInput, WeaknessRecommendation, WeaknessResponse, NutritionInput, NutritionRecommendation, NutritionResponse, ChatInput, ChatResponse, ChatApiResponse } from './hunterTypes.ts';



export type Quest = {
  _id: string;
  title: string;
  description: string;
  category: string;
  xpReward: number;
  deadline: string;
  generatedBy: 'user' | 'ai' | 'system';
  status: 'active' | 'expired' | 'completed';
};

export type User = {
  _id: string;
  name: string;
  email: string;
  xp: number;
  level: number;
};

export type CompletedQuest = {
  _id: string;
  xpEarned: number;
  createdAt: string;
  questId: Quest;
};

export interface CloudHealthResponse {
  status: string;
  uptimeSeconds: number;
  timestamp: string;
  cloudService: string;
  database: string;
  aiProvider: string;
  latencyMs: number;
  isOnline: boolean;
}

export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.trim().length > 0) {
    const configuredUrl = process.env.EXPO_PUBLIC_API_URL.trim().replace(/\/+$/, '');
    return configuredUrl.endsWith('/api') ? configuredUrl : `${configuredUrl}/api`;
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:5000/api`;
  }
  return 'http://localhost:5000/api';
}

function isHtmlBody(rawText: string, contentType: string): boolean {
  const trimmed = rawText.trim().toLowerCase();
  if (contentType.includes('text/html')) return true;
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
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
        `Server returned HTML/text instead of JSON. Ensure the HunterOS backend is running and the API base URL is correct (${baseUrl}).`
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
      const errDetail = payload?.error || payload?.message || `Request failed with HTTP ${response.status}`;
      throw new Error(errDetail);
    }

    return payload as T;
  } catch (err: any) {
    if (callerSignal?.aborted) {
      const cancelled = new Error('Request cancelled.');
      cancelled.name = 'AbortError';
      throw cancelled;
    }
    if (timedOut || err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms. Unable to reach backend server at ${fullUrl}.`);
    }
    const msg = String(err?.message || '');
    if (msg.includes('Failed to fetch') || msg.includes('Network request failed') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      throw new Error(`Unable to connect to HunterOS backend at ${baseUrl}. Ensure the backend server is running.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  return requestWithTimeout<T>(path, options, 30000);
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
      uptimeSeconds: 0,
      timestamp: new Date().toISOString(),
      cloudService: 'HunterOS Core (Standby / Local First)',
      database: 'Device Local Storage (AsyncStorage)',
      aiProvider: 'Embedded HunterOS System Engine',
      latencyMs: 0,
      isOnline: false,
    };
  }
}

export function getQuests() {
  return request<{ success: boolean; data: Quest[] }>('/quests');
}

export function getUser(userId: string) {
  return request<User>(`/users/${userId}`);
}

export function createUser(name: string, email: string) {
  return request<User>('/users', {
    method: 'POST',
    body: JSON.stringify({ name, email }),
  });
}

export function getHistory(userId: string) {
  return request<{ success: boolean; data: CompletedQuest[] }>(`/completedquests/${userId}`);
}

export async function generateQuests(input: {
  goal: string;
  category: string;
  availableMinutes: number;
  difficulty: string;
}): Promise<{ success: boolean; data: HunterQuest[]; source: string }> {
  try {
    const result = await request<{ success: boolean; data: any[]; source?: string }>('/quests/generate', {
      method: 'POST',
      body: JSON.stringify(input),
    });

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
        generatedBy: 'ai',
        status: 'active',
      };
    });

    return { success: true, data: mapped, source: result.source || 'hunter-cloud-api' };
  } catch (error) {
    // Graceful offline fallback
    console.warn('Backend unavailable, generating via HunterOS local engine:', error);
    const now = Date.now();
    const fallbackQuests: HunterQuest[] = [
      {
        _id: `fallback_${now}_1`,
        title: `SHADOW RECON // ${input.goal.toUpperCase()}`,
        description: `Execute an intense, uninterrupted session addressing "${input.goal}".`,
        category: (input.category as any) || 'Study',
        targetStat: 'knowledge',
        statBonus: 4,
        xpReward: 75,
        deadline: new Date(now + 3 * 3600 * 1000).toISOString(),
        generatedBy: 'ai',
        status: 'active',
      },
      {
        _id: `fallback_${now}_2`,
        title: `SYNAPSE RECALL // ACTIVE DRILLS`,
        description: `Verify and retain concepts mastered from "${input.goal}".`,
        category: (input.category as any) || 'Study',
        targetStat: 'discipline',
        statBonus: 3,
        xpReward: 50,
        deadline: new Date(now + 5 * 3600 * 1000).toISOString(),
        generatedBy: 'ai',
        status: 'active',
      },
      {
        _id: `fallback_${now}_3`,
        title: `RECOVERY MATRIX // SYSTEM AUDIT`,
        description: `Synthesize takeaways and rehydrate after completing "${input.goal}".`,
        category: (input.category as any) || 'Study',
        targetStat: 'health',
        statBonus: 2,
        xpReward: 35,
        deadline: new Date(now + 8 * 3600 * 1000).toISOString(),
        generatedBy: 'ai',
        status: 'active',
      },
    ];

    return { success: true, data: fallbackQuests, source: 'hunteros-embedded-engine' };
  }
}

export function completeQuest(userId: string, questId: string) {
  return request<{ success: boolean; xp: number }>('/completedquests/complete', {
    method: 'POST',
    body: JSON.stringify({ userId, questId }),
  });
}

/**
 * Call Gemini AI generate endpoint.
 * @param input Prompt to send.
 */
const DEFAULT_AI_GENERATION_TIMEOUT_MS = 60000;

function getAiGenerationTimeoutMs(): number {
  const configured = Number(process.env.EXPO_PUBLIC_AI_GENERATION_TIMEOUT_MS);
  return Number.isInteger(configured) && configured >= 15000 && configured <= 120000
    ? configured
    : DEFAULT_AI_GENERATION_TIMEOUT_MS;
}

export async function generateAI(input: { prompt: string }, options: { signal?: AbortSignal; timeoutMs?: number } = {}) {
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
  return request<WeaknessResponse>('/weakness', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Nutrition recommendations */
export async function getNutritionRecommendations(payload: NutritionInput): Promise<NutritionResponse> {
  return request<NutritionResponse>('/nutrition', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Chat with AI */
export async function chatWithAI(payload: ChatInput): Promise<ChatApiResponse> {
  if (payload.message.length > 2000) {
    throw new Error('Message exceeds maximum length of 2000 characters');
  }
  return request<ChatApiResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
