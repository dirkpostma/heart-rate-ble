import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DemoSurface } from './src/components/DemoSurface';
import { InfoButton } from './src/components/InfoButton';
import { UpdateBanner } from './src/components/UpdateBanner';
import { AboutScreen } from './src/screens/AboutScreen';
import { ConnectHelpScreen } from './src/screens/ConnectHelpScreen';
import { LiveScreen } from './src/screens/LiveScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { navThemes } from './src/theme';

export type RootStackParamList = {
  Scan: undefined;
  Live: undefined;
  About: undefined;
  ConnectHelp: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      {/* style="auto" tracks the OS appearance by itself. */}
      <StatusBar style="auto" />
      {/* UpdateBanner and DemoSurface stay mounted outside the navigator so
          they persist across screen transitions. */}
      <UpdateBanner />
      <NavigationContainer theme={navThemes[scheme ?? 'dark']}>
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
    </SafeAreaProvider>
  );
}
