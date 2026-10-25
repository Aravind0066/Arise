export type Quest = {
  _id: string;
  title: string;
  description: string;
  category: string;
  xpReward: number;
  deadline: string;
  generatedBy: 'user' | 'ai';
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

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? 'Request failed');
  }
  return payload;
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

export function generateQuests(input: {
  goal: string;
  category: string;
  availableMinutes: number;
  difficulty: string;
}) {
  return request<{ success: boolean; data: Quest[] }>('/quests/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function completeQuest(userId: string, questId: string) {
  return request<{ success: boolean; xp: number }>('/completedquests/complete', {
    method: 'POST',
    body: JSON.stringify({ userId, questId }),
  });
}
