import { HunterQuest, StatType } from './hunterTypes';
import type { ApiResponse, AiGenerateInput, AiGenerateResponse, WeaknessInput, WeaknessRecommendation, WeaknessResponse, NutritionInput, NutritionRecommendation, NutritionResponse, ChatInput, ChatResponse, ChatApiResponse } from './hunterTypes';



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

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message ?? 'Request failed');
    }
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Same as `request` but allows a custom timeout (ms).
 */
async function requestWithTimeout<T>(path: string, options?: RequestInit, timeoutMs: number = 6000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message ?? 'Request failed');
    }
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
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
export async function generateAI(input: { prompt: string }) {
  if (!input.prompt || input.prompt.trim().length === 0) {
    throw new Error('Prompt must be a non‑empty string');
  }
  return requestWithTimeout<ApiResponse<{ reply: string }>>('/ai/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  }, 10000);

}

/** Weakness‑based quest recommendations */
export async function getWeaknessRecommendations(payload: WeaknessInput) {
  return request<ApiResponse<WeaknessRecommendation[]>>('/weakness', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Nutrition recommendations */
export async function getNutritionRecommendations(payload: NutritionInput) {
  return request<ApiResponse<NutritionRecommendation[]>>('/nutrition', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Chat with AI */
export async function chatWithAI(payload: ChatInput) {
  if (payload.message.length > 2000) {
    throw new Error('Message exceeds maximum length of 2000 characters');
  }
  return request<ApiResponse<ChatResponse>>('/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
