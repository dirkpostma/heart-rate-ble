import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, RefreshControl, StyleSheet, Switch, View } from 'react-native';
import type { RootStackParamList } from '../../App';
import { VersionFooter } from '../components/VersionFooter';
import type { DiscoveredDevice } from '../ble/HeartRateMonitor';
import { Button, Card, Row, Text } from '../ds';
import { useHeartRate } from '../store/appStore';
import { spacing, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

export function ScanScreen({ navigation }: Props) {
  const theme = useTheme();
  const devices = useHeartRate((state) => state.devices);
  const scanning = useHeartRate((state) => state.scanning);
  const scanEnabled = useHeartRate((state) => state.scanEnabled);
  const error = useHeartRate((state) => state.error);
  const connectError = useHeartRate((state) => state.connectError);
  const connectingId = useHeartRate((state) => state.connectingId);
  const onToggleScan = useHeartRate((state) => state.setScanEnabled);
  const connect = useHeartRate((state) => state.connect);
  const onRescan = useHeartRate((state) => state.rescan);

  // Tapping a device is the deliberate push to Live (manual push, no
  // auto-navigation from the store). Kick off the connection, then go.
  const onSelect = (device: DiscoveredDevice) => {
    connect(device);
    navigation.navigate('Live');
  };

  return (
    // FlatList + RefreshControl can't live inside the DS Screen (ScrollView),
    // so the shell stays a themed root View — bg role, md horizontal padding
    // (issue #82: per-screen quirks stay local, never Screen props).
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.statusRow}>
        <Text color="textSecondary">
          {scanEnabled
            ? scanning
              ? 'Scanning for heart-rate sensors'
              : 'Waiting for Bluetooth…'
            : 'Scanning paused'}
        </Text>
        <Switch
          value={scanEnabled}
          onValueChange={onToggleScan}
          trackColor={{ true: theme.accent, false: theme.border }}
          thumbColor={theme.onAccent}
        />
      </View>
      {error && <Text color="danger" style={styles.error}>{error}</Text>}
      {connectError && <Text color="danger" style={styles.error}>{connectError}</Text>}
      <FlatList
        data={devices}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRescan} tintColor={theme.accent} />
        }
        renderItem={({ item }) => {
          const disabled = connectingId !== null || item.stale;
          return (
            <Card style={item.stale && styles.staleCard}>
              <Row
                label={item.name}
                variant="title"
                meta={
                  item.stale
                    ? scanEnabled
                      ? 'Not broadcasting — reappears automatically'
                      : 'Not broadcasting — scanning is off'
                    : `RSSI ${item.rssi ?? '—'} dBm`
                }
                trailing={
                  connectingId === item.id ? (
                    <Text variant="caption" color="accent">connecting…</Text>
                  ) : undefined
                }
                onPress={item.stale ? undefined : () => onSelect(item)}
                disabled={disabled}
              />
            </Card>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBlock}>
            <Text color="textSecondary" style={styles.empty}>
              {scanEnabled
                ? 'No sensors yet. Put your watch in Broadcast Heart Rate mode and keep it close.'
                : 'Scanning is off. Flip the switch to look for sensors.'}
            </Text>
          </View>
        }
      />
      {/* One always-present, prominent entry point to the connect-help
          instructions — visible whether or not a device has shown up, so the
          help page is never stranded. */}
      <View style={styles.helpLink}>
        <Button
          variant="link"
          label="Can’t find your device?"
          onPress={() => navigation.navigate('ConnectHelp')}
        />
      </View>
      <VersionFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  error: {
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  staleCard: {
    opacity: 0.45,
  },
  emptyBlock: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  empty: {
    textAlign: 'center',
    lineHeight: 20,
  },
  helpLink: {
    alignItems: 'center',
  },
});
