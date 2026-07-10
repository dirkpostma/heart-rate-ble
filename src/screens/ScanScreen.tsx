import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DiscoveredDevice } from '../ble/HeartRateMonitor';
import { colors, spacing } from '../theme';

interface Props {
  devices: DiscoveredDevice[];
  scanning: boolean;
  error: string | null;
  connectingId: string | null;
  onSelect: (device: DiscoveredDevice) => void;
}

export function ScanScreen({ devices, scanning, error, connectingId, onSelect }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Heart Rate BLE</Text>
      <View style={styles.statusRow}>
        {scanning && <ActivityIndicator size="small" color={colors.accent} />}
        <Text style={styles.statusText}>
          {scanning ? 'Scanning for heart-rate sensors…' : 'Scan stopped'}
        </Text>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={devices}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => onSelect(item)}
            disabled={connectingId !== null}
          >
            <View style={styles.rowText}>
              <Text style={styles.deviceName}>{item.name}</Text>
              <Text style={styles.deviceMeta}>
                {item.isDemo ? 'Synthetic heart rate — no hardware needed' : `RSSI ${item.rssi ?? '—'} dBm`}
              </Text>
            </View>
            {item.isDemo && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>DEMO</Text>
              </View>
            )}
            {connectingId === item.id && (
              <ActivityIndicator size="small" color={colors.accent} />
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No sensors yet. Put your watch in Broadcast Heart Rate mode and keep it close.
          </Text>
        }
      />
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
    gap: spacing.sm,
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
  empty: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 20,
  },
});
