import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { VersionFooter } from '../components/VersionFooter';
import { useHeartRate } from '../store/appStore';
import { colors, spacing } from '../theme';

export function ScanScreen({ onAboutPress }: { onAboutPress: () => void }) {
  const devices = useHeartRate((state) => state.devices);
  const scanning = useHeartRate((state) => state.scanning);
  const scanEnabled = useHeartRate((state) => state.scanEnabled);
  const error = useHeartRate((state) => state.error);
  const connectError = useHeartRate((state) => state.connectError);
  const connectingId = useHeartRate((state) => state.connectingId);
  const onToggleScan = useHeartRate((state) => state.setScanEnabled);
  const onSelect = useHeartRate((state) => state.connect);
  const onRescan = useHeartRate((state) => state.rescan);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Heart Rate BLE</Text>
        <Pressable
          onPress={onAboutPress}
          hitSlop={12}
          accessibilityLabel="About this app"
          style={({ pressed }) => [styles.infoButton, pressed && styles.infoButtonPressed]}
        >
          <Text style={styles.infoGlyph}>i</Text>
        </Pressable>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          {scanEnabled
            ? scanning
              ? 'Scanning for heart-rate sensors'
              : 'Waiting for Bluetooth…'
            : 'Scanning paused'}
        </Text>
        <Switch
          value={scanEnabled}
          onValueChange={onToggleScan}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor="#FFFFFF"
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {connectError && <Text style={styles.error}>{connectError}</Text>}
      <FlatList
        data={devices}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRescan} tintColor={colors.accent} />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.row,
              item.stale && styles.rowStale,
              pressed && styles.rowPressed,
            ]}
            onPress={() => onSelect(item)}
            disabled={connectingId !== null || item.stale}
          >
            <View style={styles.rowText}>
              <Text style={styles.deviceName}>{item.name}</Text>
              <Text style={styles.deviceMeta}>
                {item.stale
                  ? scanEnabled
                    ? 'Not broadcasting — reappears automatically'
                    : 'Not broadcasting — scanning is off'
                  : `RSSI ${item.rssi ?? '—'} dBm`}
              </Text>
            </View>
            {connectingId === item.id && <Text style={styles.connecting}>connecting…</Text>}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {scanEnabled
              ? 'No sensors yet. Put your watch in Broadcast Heart Rate mode and keep it close.'
              : 'Scanning is off. Flip the switch to look for sensors.'}
          </Text>
        }
      />
      <VersionFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButtonPressed: {
    opacity: 0.6,
  },
  infoGlyph: {
    color: colors.textDim,
    fontSize: 15,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  statusText: {
    color: colors.textDim,
    fontSize: 14,
  },
  error: {
    color: colors.warning,
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowStale: {
    opacity: 0.45,
  },
  rowPressed: {
    backgroundColor: colors.border,
  },
  rowText: {
    flex: 1,
  },
  deviceName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  deviceMeta: {
    color: colors.textDim,
    fontSize: 13,
    marginTop: 2,
  },
  connecting: {
    color: colors.accent,
    fontSize: 13,
  },
  empty: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 20,
  },
});
