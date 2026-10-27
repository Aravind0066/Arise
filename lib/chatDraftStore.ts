import { useSyncExternalStore } from 'react';

let chatDraft = '';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function getChatDraft() {
  return chatDraft;
}

export function setChatDraft(value: string) {
  if (chatDraft === value) return;
  chatDraft = value;
  notify();
}

export function clearChatDraftIfMatches(value: string) {
  if (chatDraft === value) setChatDraft('');
}

export function useChatDraft() {
  return useSyncExternalStore(subscribe, getChatDraft, getChatDraft);
}
