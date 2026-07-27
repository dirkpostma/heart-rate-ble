import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { composeApp } from './src/app/composeApp';
import { InfoButton } from './src/app/InfoButton';
import { RootStackParamList } from './src/app/navigation';
import { UpdateBanner } from './src/app/UpdateBanner';
import { navThemes } from './src/ds';
import { DemoSurface } from './src/demo';
import { AboutScreen } from './src/screens/AboutScreen';
import { ConnectHelpScreen } from './src/screens/ConnectHelpScreen';
import { LiveScreen } from './src/screens/LiveScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { StorybookScreen } from './src/screens/StorybookScreen';
import { useDevMode } from './src/store/devModeStore';

// composeApp() builds the object graph once at module load — the same
// timing the old appStore.ts singleton had, but now an explicit call
// instead of import-time side effects buried in a store module (audit 1.3).
composeApp();

const Stack = createNativeStackNavigator<RootStackParamList>();

// The normal app: the navigator plus the UpdateBanner/DemoSurface overlays
// that float above every screen (#17). Rendered whenever Storybook isn't
// active.
function AppRoot() {
  const scheme = useColorScheme();
  return (
    <>
      {/* UpdateBanner and DemoSurface stay mounted outside the navigator so
          they persist across screen transitions. */}
      <UpdateBanner />
      <NavigationContainer theme={navThemes[scheme === 'light' ? 'light' : 'dark']}>
        {/* Header + content chrome derive entirely from the nav theme; no
            per-screen style overrides. */}
        <Stack.Navigator initialRouteName="Scan">
          <Stack.Screen
            name="Scan"
            component={ScanScreen}
            options={({ navigation }) => ({
              title: 'Heart Rate BLE',
              headerRight: () => (
                <InfoButton onPress={() => navigation.navigate('About')} />
              ),
            })}
          />
          <Stack.Screen name="Live" component={LiveScreen} options={{ title: '' }} />
          <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
          <Stack.Screen
            name="ConnectHelp"
            component={ConnectHelpScreen}
            options={{ title: 'Connect your device' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <DemoSurface />
    </>
  );
}

export default function App() {
  // Dev mode swaps the *entire* root tree between the app and the on-device
  // Storybook UI, rather than nesting Storybook as a stack route. A top-level
  // swap gives Storybook the full screen and its own navigator a reachable
  // canvas (#101).
  const storybookActive = useDevMode((state) => state.storybookActive);
  // SDK 57's expo-splash-screen auto-hide can miss on app relaunch (splash
  // stays up while the app runs underneath). Explicit hide is idempotent and
  // safe alongside auto-hide on first launch.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    // GestureHandlerRootView must be the outermost view: Storybook's on-device
    // navigator is a @gorhom/bottom-sheet, whose pan/tap gestures are only
    // routed when the true app root is a GestureHandlerRootView (#100 — the
    // navigator was unreachable without the gesture stack in the binary).
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* style="auto" tracks the OS appearance by itself. */}
      <StatusBar style="auto" />
      {/* Storybook's FullUI renders its OWN SafeAreaProvider, so mount it
          outside the app's — a nested provider makes Storybook's insets.bottom
          read 0 and collapses the story-navigator bottom bar (#100). */}
      {storybookActive ? (
        <StorybookScreen />
      ) : (
        <SafeAreaProvider>
          <AppRoot />
        </SafeAreaProvider>
      )}
    </GestureHandlerRootView>
  );
}
