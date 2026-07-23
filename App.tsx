import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DemoSurface } from './src/components/DemoSurface';
import { InfoButton } from './src/components/InfoButton';
import { UpdateBanner } from './src/components/UpdateBanner';
import { navigationRef } from './src/navigation';
import { AboutScreen } from './src/screens/AboutScreen';
import { ConnectHelpScreen } from './src/screens/ConnectHelpScreen';
import { LiveScreen } from './src/screens/LiveScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { StorybookScreen } from './src/screens/StorybookScreen';
import { useDevMode } from './src/store/devModeStore';
import { navThemes } from './src/theme';

export type RootStackParamList = {
  Scan: undefined;
  Live: undefined;
  About: undefined;
  ConnectHelp: undefined;
};

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
      <NavigationContainer ref={navigationRef} theme={navThemes[scheme ?? 'dark']}>
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
  // canvas (#101), fixing the below-the-edge story navigator (#100).
  const storybookActive = useDevMode((state) => state.storybookActive);
  return (
    <SafeAreaProvider>
      {/* style="auto" tracks the OS appearance by itself. */}
      <StatusBar style="auto" />
      {storybookActive ? <StorybookScreen /> : <AppRoot />}
    </SafeAreaProvider>
  );
}
