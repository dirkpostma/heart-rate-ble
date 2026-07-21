import {
  DarkTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DemoSurface } from './src/components/DemoSurface';
import { InfoButton } from './src/components/InfoButton';
import { UpdateBanner } from './src/components/UpdateBanner';
import { AboutScreen } from './src/screens/AboutScreen';
import { ConnectHelpScreen } from './src/screens/ConnectHelpScreen';
import { LiveScreen } from './src/screens/LiveScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { colors } from './src/theme';

export type RootStackParamList = {
  Scan: undefined;
  Live: undefined;
  About: undefined;
  ConnectHelp: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Match the app's dark surface so the native header and card backgrounds
// don't flash the default light chrome.
const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {/* UpdateBanner and DemoSurface stay mounted outside the navigator so
          they persist across screen transitions. */}
      <UpdateBanner />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          initialRouteName="Scan"
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.accent,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
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
