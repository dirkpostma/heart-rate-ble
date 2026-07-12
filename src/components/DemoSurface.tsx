import { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DemoProfile, PROFILE_LABEL } from '../ble/DemoHeartRateMonitor';
import { demoMonitor, useHeartRate } from '../store/appStore';
import { colors, spacing } from '../theme';

/**
 * The demo control surface (issues #17/#19): a faint dot in the corner
 * of every screen — release builds included — that expands into a
 * compact panel for summoning and controlling virtual devices, small
 * enough that the app stays visible while you drive the mocks.
 */
export function DemoSurface() {
  const devices = useSyncExternalStore(
    (onChange) => demoMonitor.onDevicesChanged(onChange),
    () => demoMonitor.getDevices(),
  );
  const connectedId = useHeartRate((state) => state.connectedDevice?.id ?? null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Pressable style={styles.dot} hitSlop={16} onPress={() => setOpen(true)}>
        <View style={styles.dotInner} />
      </Pressable>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Demo devices</Text>
        <Pressable style={styles.collapseBtn} hitSlop={8} onPress={() => setOpen(false)}>
          <View style={styles.chevron} />
        </Pressable>
      </View>
      {devices.map((device) => (
        <View key={device.id} style={[styles.row, !device.advertising && styles.rowDim]}>
          <View
            style={[styles.statusDot, connectedId === device.id && styles.statusDotConnected]}
          />
          <Text style={styles.name} numberOfLines={1}>
            {device.name}
          </Text>
          <View style={styles.actions}>
            <Pressable
              hitSlop={6}
              onPress={() => demoMonitor.setAdvertising(device.id, !device.advertising)}
            >
              <Text style={[styles.icon, device.advertising && styles.iconOn]}>⏻</Text>
            </Pressable>
            <Pressable
              hitSlop={6}
              disabled={connectedId !== device.id}
              onPress={() => demoMonitor.dropConnection()}
            >
              <Text style={[styles.icon, connectedId !== device.id && styles.iconDisabled]}>
                ⚡
              </Text>
            </Pressable>
            <Pressable hitSlop={6} onPress={() => demoMonitor.dismiss(device.id)}>
              <Text style={styles.icon}>✕</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {devices.length === 0 && <Text style={styles.empty}>No demo devices</Text>}
      <View style={styles.spawnRow}>
        {(Object.keys(PROFILE_LABEL) as DemoProfile[]).map((profile) => (
          <Pressable
            key={profile}
            style={styles.spawnBtn}
            onPress={() => demoMonitor.summon(profile)}
          >
            <Text style={styles.spawnText}>＋{PROFILE_LABEL[profile]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const CORNER = { right: spacing.md, bottom: 104 };

const styles = StyleSheet.create({
  dot: { position: 'absolute', ...CORNER },
  dotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.textDim,
    opacity: 0.15,
  },
  panel: {
    position: 'absolute',
    ...CORNER,
    width: 264,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 13, fontWeight: '700' },
  // Drawn chevron instead of a text "⌄": no baseline drift against the
  // title, and a real 28 pt tap target (#24).
  collapseBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -6,
    marginRight: -6,
  },
  chevron: {
    width: 10,
    height: 10,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.textDim,
    transform: [{ rotate: '45deg' }],
    marginTop: -4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowDim: { opacity: 0.45 },
  // Rows read "status | identity | actions" (#23): a leading dot shows
  // connectedness (the live screen's state-dot language), and the action
  // icons sit behind a hairline so tappable and status-only glyphs never
  // share a visual group.
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  statusDotConnected: { backgroundColor: colors.success },
  name: { color: colors.text, fontSize: 13, flex: 1 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
  },
  icon: { color: colors.textDim, fontSize: 14, padding: 2 },
  iconOn: { color: colors.accent },
  iconDisabled: { opacity: 0.3 },
  empty: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginVertical: spacing.xs },
  spawnRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  spawnBtn: {
    flex: 1,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 5,
  },
  spawnText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
});
