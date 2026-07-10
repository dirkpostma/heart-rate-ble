import { useCallback, useMemo } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { FakeHeartRateMonitor } from './src/ble/FakeHeartRateMonitor';
import { useHeartRateApp } from './src/hooks/useHeartRateApp';
import { LiveScreen } from './src/screens/LiveScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { colors } from './src/theme';

export default function App() {
  const fakeMonitor = useMemo(() => new FakeHeartRateMonitor(), []);
  const monitorFor = useCallback(() => fakeMonitor, [fakeMonitor]);
  const scanSources = useMemo(() => [fakeMonitor], [fakeMonitor]);
  const app = useHeartRateApp(monitorFor, scanSources);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
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
          error={app.error}
          connectingId={app.connectingId}
          onSelect={app.connect}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
