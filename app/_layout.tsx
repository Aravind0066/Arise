import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppearanceProvider, useAppearance } from "../lib/AppearanceContext";

function AppStatusBar() {
  const { theme } = useAppearance();
  return <StatusBar style={theme.statusBar} backgroundColor={theme.background} />;
}

export default function RootLayout() {
  return (
    <AppearanceProvider>
      <AppStatusBar />
      <Stack screenOptions={{ headerShown: false }} />
    </AppearanceProvider>
  );
}
