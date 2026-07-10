import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ConnectionState, HeartRateSample } from '../ble/HeartRateMonitor';
import { PulsingHeart } from '../components/PulsingHeart';
import { colors, spacing } from '../theme';

interface Props {
  deviceName: string;
  connectionState: ConnectionState;
  sample: HeartRateSample | null;
  onDisconnect: () => void;
}

const STATE_LABEL: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
};

export function LiveScreen({ deviceName, connectionState, sample, onDisconnect }: Props) {
  const bpm = sample && sample.bpm > 0 ? sample.bpm : null;
  const acquiring = connectionState === 'connected' && bpm === null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.deviceName}>{deviceName}</Text>
        <View style={styles.stateRow}>
          <View
            style={[
              styles.stateDot,
              { backgroundColor: connectionState === 'connected' ? colors.success : colors.warning },
            ]}
          />
          <Text style={styles.stateText}>{STATE_LABEL[connectionState]}</Text>
        </View>
      </View>

      <View style={styles.center}>
        <PulsingHeart bpm={connectionState === 'connected' ? bpm : null} />
        <Text style={styles.bpm}>{bpm ?? '—'}</Text>
        <Text style={styles.bpmUnit}>
          {acquiring ? 'acquiring signal…' : 'beats per minute'}
        </Text>
        {sample?.sensorContact === false && (
          <Text style={styles.contactHint}>No sensor contact — check the strap or watch fit</Text>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.disconnect, pressed && styles.disconnectPressed]}
        onPress={onDisconnect}
      >
        <Text style={styles.disconnectText}>Disconnect</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  deviceName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '600',
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stateText: {
    color: colors.textDim,
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  bpm: {
    color: colors.text,
    fontSize: 104,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  bpmUnit: {
    color: colors.textDim,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  contactHint: {
    color: colors.warning,
    marginTop: spacing.md,
  },
  disconnect: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  disconnectPressed: {
    backgroundColor: colors.accentDim,
  },
  disconnectText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
});
