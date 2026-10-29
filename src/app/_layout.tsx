import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../components/ui';
import { StoreProvider } from '../lib/store';

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          headerBackTitle: 'Zurück',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Strafenkatalog' }} />
        <Stack.Screen name="group/[groupId]/rule" options={{ presentation: 'modal', title: 'Regel' }} />
      </Stack>
    </StoreProvider>
  );
}
