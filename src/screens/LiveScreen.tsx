import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '../../App';
import { ConnectionState } from '../ble/HeartRateMonitor';
import { PulsingHeart } from '../components/PulsingHeart';
import { Button, StateDot, Text } from '../ds';
import { useHeartRate } from '../store/appStore';
import { spacing, useTheme } from '../theme';

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
  const theme = useTheme();
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

  // Leaving Live *always* tears down the link, however it happens — the
  // Disconnect button, the header back chevron, or the iOS swipe-back
  // gesture. beforeRemove is the one choke point every exit passes through,
  // so the store can never be left thinking a device is still connected
  // (which would stop scanning and leave Scan showing no new devices).
  // disconnect() is safe to call when already disconnected.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      disconnect();
    });
    return unsub;
  }, [navigation, disconnect]);

  // The button just navigates; beforeRemove owns the teardown.
  const onDisconnect = () => {
    navigation.popTo('Scan');
  };

  const lost = connectionState === 'disconnected';
  const stale =
    connectionState === 'connected' && sample !== null && now - sample.timestamp > STALE_AFTER_MS;
  const bpm = !stale && sample && sample.bpm > 0 ? sample.bpm : null;
  const acquiring = connectionState === 'connected' && !stale && bpm === null;

  const connected = connectionState === 'connected' && !stale;

  return (
    // FlatList-free screen, but the DS Screen (ScrollView) would collapse the
    // header/center/footer three-band flex layout, so the shell stays a themed
    // root View — bg role, md padding (issue #82: per-screen quirks stay local).
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <View style={styles.stateRow}>
          <StateDot color={connected ? 'success' : 'warning'} />
          <Text variant="caption" color="textSecondary">
            {stale ? 'Connected — no signal' : STATE_LABEL[connectionState]}
          </Text>
        </View>
      </View>

      <View style={styles.center}>
        <PulsingHeart bpm={connectionState === 'connected' ? bpm : null} />
        {/* The BPM readout keeps the display variant (104·200·tabular), but
            its lost-state dim is a local color override (issue #80). */}
        <Text variant="display" color={lost ? 'textSecondary' : 'textPrimary'}>
          {bpm ?? '—'}
        </Text>
        {/* "beats per minute" — caps with the dramatic ls-2 tracking that the
            DS caps modifier (fixed 0.5) can't reach, so ls stays local (#80). */}
        <Text variant="body" caps color="textSecondary" style={styles.bpmUnit}>
          {acquiring ? 'acquiring signal…' : lost ? 'last reading' : 'beats per minute'}
        </Text>
        {lost && (
          <Text color="warning" style={styles.contactHint}>
            Connection lost — the device is no longer reachable
          </Text>
        )}
        {stale && (
          <Text color="warning" style={styles.contactHint}>
            Signal lost — is the watch still broadcasting heart rate?
          </Text>
        )}
        {!stale && !lost && sample?.sensorContact === false && (
          <Text color="warning" style={styles.contactHint}>
            No sensor contact — check the strap or watch fit
          </Text>
        )}
      </View>

      <Button
        variant="outline"
        label={lost ? 'Back to devices' : 'Disconnect'}
        onPress={onDisconnect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  // The dramatic uppercase tracking on the BPM unit — beyond the DS caps
  // modifier's fixed 0.5, so it stays a local override (issue #80).
  bpmUnit: {
    letterSpacing: 2,
  },
  contactHint: {
    marginTop: spacing.md,
  },
});
