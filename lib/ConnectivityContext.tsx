import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { normalizeInternetStatus, type InternetStatus } from './connectivityRules';
import { useEffect, useState } from 'react';

interface ConnectivityContextValue {
  status: InternetStatus;
  refresh: () => Promise<InternetStatus>;
}

const ConnectivityContext = createContext<ConnectivityContextValue>({
  status: 'unknown',
  refresh: async () => 'unknown',
});

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<InternetStatus>('unknown');

  useEffect(() => {
    let mounted = true;
    const applyState = (state: NetInfoState) => {
      if (mounted) setStatus(normalizeInternetStatus(state));
    };

    if (Platform.OS !== 'web') NetInfo.configure({ useNativeReachability: false });
    void NetInfo.fetch().then(applyState).catch(() => undefined);
    const unsubscribeNetwork = NetInfo.addEventListener(applyState);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void NetInfo.refresh().then(applyState).catch(() => undefined);
    });

    return () => {
      mounted = false;
      unsubscribeNetwork();
      appStateSubscription.remove();
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const state = await NetInfo.refresh();
      const nextStatus = normalizeInternetStatus(state);
      setStatus(nextStatus);
      return nextStatus;
    } catch {
      return status;
    }
  }, [status]);

  const value = useMemo(() => ({ status, refresh }), [status, refresh]);
  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useInternetConnectivity() {
  return useContext(ConnectivityContext);
}
