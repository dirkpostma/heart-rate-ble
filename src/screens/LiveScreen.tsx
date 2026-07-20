import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RootStackParamList } from '../../App';
import { ConnectionState } from '../ble/HeartRateMonitor';
import { PulsingHeart } from '../components/PulsingHeart';
import { useHeartRate } from '../store/appStore';
import { colors, spacing } from '../theme';

// 'disconnected' while this screen is still showing means the monitor
// reported the drop (user-initiated disconnects navigate away): the
// lost end state of #30.
const STATE_LABEL: Record<ConnectionState, string> = {
  disconnected: 'Connection lost',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
};

// Garmin broadcast can stop sending without dropping the BLE link, so
// silence — not just disconnection — must surface in the UI.
const STALE_AFTER_MS = 5000;

type Props = NativeStackScreenProps<RootStackParamList, 'Live'>;

export function LiveScreen({ navigation }: Props) {
  const deviceName = useHeartRate((state) => state.connectedDevice?.name ?? '');
  const connectionState = useHeartRate((state) => state.connectionState);
  const sample = useHeartRate((state) => state.sample);
  const disconnect = useHeartRate((state) => state.disconnect);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Surface the connected device as the native header title.
  useEffect(() => {
    navigation.setOptions({ title: deviceName });
  }, [navigation, deviceName]);

  // Disconnecting is user-initiated navigation back to Scan (distinct from
  // "no auto-pop" — that rule is about not reacting to store state; this is
  // a button press). Tear down the link, then return to the device list.
  const onDisconnect = () => {
    disconnect();
    navigation.popTo('Scan');
  };

  const lost = connectionState === 'disconnected';
  const stale =
    connectionState === 'connected' && sample !== null && now - sample.timestamp > STALE_AFTER_MS;
  const bpm = !stale && sample && sample.bpm > 0 ? sample.bpm : null;
  const acquiring = connectionState === 'connected' && !stale && bpm === null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.stateRow}>
          <View
            style={[
              styles.stateDot,
              {
                backgroundColor:
                  connectionState === 'connected' && !stale ? colors.success : colors.warning,
              },
            ]}
          />
          <Text style={styles.stateText}>
            {stale ? 'Connected — no signal' : STATE_LABEL[connectionState]}
          </Text>
        </View>
      </View>

      <View style={styles.center}>
        <PulsingHeart bpm={connectionState === 'connected' ? bpm : null} />
        <Text style={[styles.bpm, lost && styles.bpmLost]}>{bpm ?? '—'}</Text>
        <Text style={styles.bpmUnit}>
          {acquiring ? 'acquiring signal…' : lost ? 'last reading' : 'beats per minute'}
        </Text>
        {lost && (
          <Text style={styles.contactHint}>
            Connection lost — the device is no longer reachable
          </Text>
        )}
        {stale && (
          <Text style={styles.contactHint}>
            Signal lost — is the watch still broadcasting heart rate?
          </Text>
        )}
        {!stale && !lost && sample?.sensorContact === false && (
          <Text style={styles.contactHint}>No sensor contact — check the strap or watch fit</Text>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.disconnect, pressed && styles.disconnectPressed]}
        onPress={onDisconnect}
      >
        <Text style={styles.disconnectText}>{lost ? 'Back to devices' : 'Disconnect'}</Text>
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
  bpmLost: {
    color: colors.textDim,
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
