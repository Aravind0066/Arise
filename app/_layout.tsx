import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { AppearanceProvider, useAppearance } from "../lib/AppearanceContext";
import { ConnectivityProvider } from "../lib/ConnectivityContext";

(globalThis as typeof globalThis & { __HUNTEROS_EXPO_HOST_URI__?: string }).__HUNTEROS_EXPO_HOST_URI__ = Constants.expoConfig?.hostUri;

function AppStatusBar() {
  const { theme } = useAppearance();
  return <StatusBar style={theme.statusBar} backgroundColor={theme.background} />;
}

export default function RootLayout() {
  return (
    <AppearanceProvider>
      <ConnectivityProvider>
        <AppStatusBar />
        <Stack screenOptions={{ headerShown: false }} />
      </ConnectivityProvider>
    </AppearanceProvider>
  );
}
