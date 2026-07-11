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
import { ScannedDevice } from '../hooks/useHeartRateApp';
import { colors, spacing } from '../theme';

interface Props {
  devices: ScannedDevice[];
  scanning: boolean;
  scanEnabled: boolean;
  onToggleScan: (enabled: boolean) => void;
  error: string | null;
  connectingId: string | null;
  onSelect: (device: ScannedDevice) => void;
  onRescan: () => void;
}

export function ScanScreen({
  devices,
  scanning,
  scanEnabled,
  onToggleScan,
  error,
  connectingId,
  onSelect,
  onRescan,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Heart Rate BLE</Text>
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
                {item.isDemo
                  ? 'Synthetic heart rate — no hardware needed'
                  : item.stale
                    ? scanEnabled
                      ? 'Not broadcasting — reappears automatically'
                      : 'Not broadcasting — scanning is off'
                    : `RSSI ${item.rssi ?? '—'} dBm`}
              </Text>
            </View>
            {item.isDemo && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>DEMO</Text>
              </View>
            )}
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
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginTop: spacing.lg,
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
  badge: {
    backgroundColor: colors.accentDim,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
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
