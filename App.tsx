import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { UpdateBanner } from './src/components/UpdateBanner';
import { DemoSurfacePrototype } from './src/prototype/DemoSurfacePrototype';
import { LiveScreen } from './src/screens/LiveScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { useHeartRate } from './src/store/appStore';
import { colors } from './src/theme';

export default function App() {
  const connected = useHeartRate((state) => state.connectedDevice !== null);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" />
        <UpdateBanner />
        {connected ? <LiveScreen /> : <ScanScreen />}
        <DemoSurfacePrototype />
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
