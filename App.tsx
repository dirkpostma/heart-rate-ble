import { useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DemoSurface } from './src/components/DemoSurface';
import { UpdateBanner } from './src/components/UpdateBanner';
import { AboutScreen } from './src/screens/AboutScreen';
import { LiveScreen } from './src/screens/LiveScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { useHeartRate } from './src/store/appStore';
import { colors } from './src/theme';

export default function App() {
  const connected = useHeartRate((state) => state.connectedDevice !== null);
  const [aboutVisible, setAboutVisible] = useState(false);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" />
        <UpdateBanner />
        {aboutVisible ? (
          <AboutScreen onClose={() => setAboutVisible(false)} />
        ) : connected ? (
          <LiveScreen />
        ) : (
          <ScanScreen onAboutPress={() => setAboutVisible(true)} />
        )}
        <DemoSurface />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
