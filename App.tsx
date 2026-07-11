import { useCallback, useMemo } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BleHeartRateMonitor } from './src/ble/BleHeartRateMonitor';
import { UpdateBanner } from './src/components/UpdateBanner';
import { FakeHeartRateMonitor } from './src/ble/FakeHeartRateMonitor';
import { DiscoveredDevice } from './src/ble/HeartRateMonitor';
import { useHeartRateApp } from './src/hooks/useHeartRateApp';
import { LiveScreen } from './src/screens/LiveScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { colors } from './src/theme';

export default function App() {
  const fakeMonitor = useMemo(() => new FakeHeartRateMonitor(), []);
  const bleMonitor = useMemo(() => new BleHeartRateMonitor(), []);
  const monitorFor = useCallback(
    (device: DiscoveredDevice) => (device.isDemo ? fakeMonitor : bleMonitor),
    [fakeMonitor, bleMonitor],
  );
  const scanSources = useMemo(() => [fakeMonitor, bleMonitor], [fakeMonitor, bleMonitor]);
  const app = useHeartRateApp(monitorFor, scanSources);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" />
        <UpdateBanner />
        {app.connectedDevice ? (
          <LiveScreen
            deviceName={app.connectedDevice.name}
            connectionState={app.connectionState}
            sample={app.sample}
            onDisconnect={app.disconnect}
          />
        ) : (
          <ScanScreen
            devices={app.devices}
            scanning={app.scanning}
            scanEnabled={app.scanEnabled}
            onToggleScan={app.setScanEnabled}
            error={app.error}
            connectingId={app.connectingId}
            onSelect={app.connect}
            onRescan={app.rescan}
          />
        )}
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
