import type { HunterQuest } from './hunterTypes';

export function getQuestStatusAt(quest: HunterQuest, now = Date.now()): HunterQuest['status'] {
  if (quest.status === 'completed' || quest.completedAt) return 'completed';
  const deadline = Date.parse(quest.deadline);
  return !Number.isFinite(deadline) || deadline <= now ? 'expired' : 'active';
}

export function hasMeaningfulVerification(note: string): boolean {
  return note.trim().replace(/\s+/g, ' ').length >= 8;
}
