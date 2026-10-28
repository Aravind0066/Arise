export type InternetStatus = 'online' | 'offline' | 'unknown';

export function normalizeInternetStatus(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): InternetStatus {
  if (state.isConnected === false || state.isInternetReachable === false) return 'offline';
  if (state.isInternetReachable === true) return 'online';
  return 'unknown';
}

export async function runIfOnline<T>(
  refresh: () => Promise<InternetStatus>,
  action: () => Promise<T>,
): Promise<{ started: false } | { started: true; value: T }> {
  if (await refresh() === 'offline') return { started: false };
  return { started: true, value: await action() };
}

export function classifyOnlineRequestFailure(error: unknown, status: InternetStatus): 'offline' | 'backend' | 'ai' {
  if (error && typeof error === 'object' && 'kind' in error && error.kind === 'ai') return 'ai';
  if (error && typeof error === 'object' && 'kind' in error && error.kind === 'backend') return 'backend';
  if (status === 'offline') return 'offline';
  return 'backend';
}

export function onlineRequestErrorMessage(
  error: unknown,
  status: InternetStatus,
): string {
  const kind = classifyOnlineRequestFailure(error, status);
  if (kind === 'offline') {
    return 'You are offline. Connect to the internet to use Hunter AI and get personalized recommendations.';
  }
  if (kind === 'ai') {
    return error instanceof Error && error.message ? error.message : 'Hunter AI is temporarily unavailable. Please try again later.';
  }
  const message = error instanceof Error && error.message ? error.message : 'HunterOS backend is unavailable.';
  const diagnostic = error && typeof error === 'object' && 'diagnostic' in error && typeof error.diagnostic === 'string'
    ? error.diagnostic
    : '';
  return typeof __DEV__ !== 'undefined' && __DEV__ && diagnostic
    ? `${message}\n${diagnostic}`
    : message;
}
