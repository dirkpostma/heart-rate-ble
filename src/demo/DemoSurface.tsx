import { useSyncExternalStore } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { getDemoMonitor } from '../app/demoMonitor';
import { usePreferences } from '../app/preferences';
import { useHeartRate } from '../app/useHeartRate';
import { DemoProfile, PROFILE_LABEL } from '../ble/DemoHeartRateMonitor';
import { radius, shadowFloating, spacing, Text, useTheme } from '../ds';
import { useDemoSurfaceGesture } from './useDemoSurfaceGesture';

// The glossary the #20 device pass found missing (#33). Each action line
// names the on-screen consequence, not just the mechanics — the demo
// exists to show those behaviors off, so the help must say what to watch
// for. Strings like "Reconnecting…" quote the live screen verbatim.
const HELP_ROWS = [
  {
    glyph: '⏻',
    text: 'Stop or resume advertising. Stopped, the row dims here and the scan list greys the device out after ~3 s; resumed, it recovers.',
  },
  {
    glyph: '⚡',
    text: 'Drop the connection once (enabled while connected). The live screen shows Reconnecting… and picks the device back up in ~3 s.',
  },
  {
    glyph: '✕',
    text: 'Remove the device. If it was connected, the live screen ends in Connection lost.',
  },
  {
    glyph: '●',
    text: 'Green means connected.',
  },
  {
    glyph: '⠿',
    text: 'Drag the grip — or the DEMO pill — to move this panel; it snaps to corners and edges.',
  },
  {
    glyph: '＋',
    text: 'Summon a virtual sensor: Resting wanders 55–75 bpm, Workout 95–175 bpm, Dropout goes silent for 5 s in every 25 so timeouts and recovery demo themselves.',
  },
];

// The "you can drag this" affordance shared by the pill and the panel
// header. View-drawn like the chevron (#24) so it can't drift on a text
// baseline.
function DotGrip({ color }: { color: string }) {
  return (
    <View style={styles.grip}>
      {[0, 1, 2].map((rowIndex) => (
        <View key={rowIndex} style={styles.gripRow}>
          <View style={[styles.gripDot, { backgroundColor: color }]} />
          <View style={[styles.gripDot, { backgroundColor: color }]} />
        </View>
      ))}
    </View>
  );
}

/**
 * The demo control surface (issues #17/#19): a small grey "DEMO" pill that
 * expands into a compact panel for summoning and controlling virtual devices,
 * small enough that the app stays visible while you drive the mocks. Pill and
 * panel are both draggable — the panel by its header (#28) — and snap to
 * corners and mid-edges so they can never permanently cover critical UI (#21).
 *
 * Gated by the persisted demo-mode preference (#177): default off, so the
 * pill is absent until the user enables it on About. Storybook moved to
 * About's Developer section (#180/#182) — no longer a row here.
 */
export function DemoSurface() {
  const theme = useTheme();
  const demoModeEnabled = usePreferences((state) => state.demoModeEnabled);
  const demoMonitor = getDemoMonitor();
  const devices = useSyncExternalStore(
    (onChange) => demoMonitor.onDevicesChanged(onChange),
    () => demoMonitor.getDevices(),
  );
  const connectedId = useHeartRate((state) => state.connectedDevice?.id ?? null);

  const {
    PILL,
    PANEL_WIDTH,
    open,
    frame,
    panelSize,
    pan,
    openAnim,
    animOrigin,
    closing,
    helpOpen,
    setHelpOpen,
    pillResponder,
    headerResponder,
    onLayout,
    onPanelLayout,
    collapse,
  } = useDemoSurfaceGesture();

  // The one pressed-feedback fill, shared by every Pressable in the panel —
  // the pre-migration `styles.pressed` rule, now a theme-resolved role.
  const pressedBg = { backgroundColor: theme.pressed };

  // Preference off: render nothing. Teardown of summoned devices is the
  // falling-edge subscriber in composeApp (#179), not this unmount.
  if (!demoModeEnabled) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {frame !== null && !open && (
        <Animated.View
          style={[
            styles.pill,
            { width: PILL.width, height: PILL.height, borderRadius: PILL.height / 2 },
            { backgroundColor: theme.surface, borderColor: theme.textSecondary },
            { transform: pan.getTranslateTransform() },
          ]}
          hitSlop={12}
          {...pillResponder.panHandlers}
        >
          <DotGrip color={theme.textSecondary} />
          <RNText style={[styles.pillText, { color: theme.textSecondary }]}>DEMO</RNText>
          {devices.length > 0 && (
            <View
              style={[
                styles.pillDot,
                { backgroundColor: theme.textSecondary },
                devices.some((device) => device.id === connectedId) && {
                  backgroundColor: theme.success,
                },
              ]}
            />
          )}
        </Animated.View>
      )}
      {frame !== null && open && (
        <Animated.View
          style={[
            styles.panel,
            { width: PANEL_WIDTH },
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
              ...shadowFloating(theme),
            },
            {
              opacity: openAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
              // The origin translates pin the anchored edge while the
              // panel scales, so it unfolds out of the pill's snap
              // corner rather than from its own center.
              transform: [
                ...pan.getTranslateTransform(),
                {
                  translateX: openAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [animOrigin.x, 0],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  translateY: openAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [animOrigin.y, 0],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  scale: openAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.25, 1],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
            panelSize === null && styles.panelUnmeasured,
          ]}
          pointerEvents={closing ? 'none' : 'auto'}
          onLayout={onPanelLayout}
        >
          <View style={styles.header}>
            <View style={styles.dragHandle} {...headerResponder.panHandlers}>
              <DotGrip color={theme.textSecondary} />
              <Text variant="caption" weight="bold" color="textPrimary">
                Demo devices
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.helpBtn, pressed && pressedBg]}
              hitSlop={8}
              onPress={() => setHelpOpen((current) => !current)}
            >
              <RNText style={[styles.helpGlyph, { color: helpOpen ? theme.accent : theme.textSecondary }]}>
                ?
              </RNText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.collapseBtn,
                pressed && pressedBg,
              ]}
              hitSlop={8}
              onPress={collapse}
            >
              <View style={[styles.chevron, { borderColor: theme.textSecondary }]} />
            </Pressable>
          </View>
          {helpOpen && (
            <View style={[styles.help, { borderColor: theme.border }]}>
              {HELP_ROWS.map(({ glyph, text }) => (
                <View key={glyph} style={styles.helpRow}>
                  <RNText style={[styles.helpGlyphCol, { color: theme.textSecondary }]}>{glyph}</RNText>
                  <RNText style={[styles.helpText, { color: theme.textSecondary }]}>{text}</RNText>
                </View>
              ))}
            </View>
          )}
          {devices.map((device) => (
            <View key={device.id} style={[styles.row, !device.advertising && styles.rowDim]}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: connectedId === device.id ? theme.success : theme.border },
                ]}
              />
              <Text variant="caption" color="textPrimary" numberOfLines={1} style={styles.name}>
                {device.name}
              </Text>
              <View style={[styles.actions, { borderLeftColor: theme.border }]}>
                <Pressable
                  hitSlop={4}
                  style={({ pressed }) => [styles.iconBtn, pressed && pressedBg]}
                  onPress={() => demoMonitor.setAdvertising(device.id, !device.advertising)}
                >
                  <RNText style={[styles.icon, { color: device.advertising ? theme.accent : theme.textSecondary }]}>
                    ⏻
                  </RNText>
                </Pressable>
                <Pressable
                  hitSlop={4}
                  style={({ pressed }) => [styles.iconBtn, pressed && pressedBg]}
                  disabled={connectedId !== device.id}
                  onPress={() => demoMonitor.dropConnection()}
                >
                  <RNText
                    style={[
                      styles.icon,
                      { color: theme.textSecondary },
                      connectedId !== device.id && styles.iconDisabled,
                    ]}
                  >
                    ⚡
                  </RNText>
                </Pressable>
                <Pressable
                  hitSlop={4}
                  style={({ pressed }) => [styles.iconBtn, pressed && pressedBg]}
                  onPress={() => demoMonitor.dismiss(device.id)}
                >
                  <RNText style={[styles.icon, { color: theme.textSecondary }]}>✕</RNText>
                </Pressable>
              </View>
            </View>
          ))}
          {devices.length === 0 && (
            <Text variant="caption" color="textSecondary" style={styles.empty}>
              No demo devices — add one below ↓
            </Text>
          )}
          <View style={styles.spawnRow}>
            {(Object.keys(PROFILE_LABEL) as DemoProfile[]).map((profile) => (
              <Pressable
                key={profile}
                style={({ pressed }) => [
                  styles.spawnBtn,
                  { borderColor: theme.border },
                  pressed && pressedBg,
                ]}
                onPress={() => demoMonitor.summon(profile)}
              >
                <Text variant="caption" weight="semibold" color="accent">
                  ＋{PROFILE_LABEL[profile]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// Layout + metrics only — every color resolves inline from the active theme
// (issue #83). Spacing snaps onto the ramp: the old stray 6s become xs and the
// spawn button's 10 becomes sm (issue #84 recorded them as debt, not tokens).
const styles = StyleSheet.create({
  // A labeled pill instead of the former ring-and-core: the word says
  // what the control is (#27) while its neutral greys keep it
  // subordinate to the app UI.
  pill: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: 1,
    opacity: 0.75,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  pillText: { fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  // Mirrors the panel rows' status dot: green while a demo device is
  // connected, dim grey while devices merely exist, absent when none —
  // a collapsed pill still reports what the mocks are doing.
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  // View-drawn like the chevron (#24): text glyphs drift on their
  // baseline and render inconsistently across platform fonts.
  grip: { gap: 3 },
  gripRow: { flexDirection: 'row', gap: 3 },
  gripDot: { width: 4, height: 4, borderRadius: 2 },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  panelUnmeasured: { opacity: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // The title strip is the panel's drag handle (#28): a 28 pt grab area
  // matching the collapse button, so drags never fight the row and
  // spawn Pressables below.
  dragHandle: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: -6,
  },
  // Help opener lives in the title strip like the chevron (#33): a
  // sibling Pressable outside the drag handle, so it can never become a
  // second drag-gesture claimant (#28).
  helpBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -6,
  },
  helpGlyph: { fontSize: 16, fontWeight: '700' },
  help: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  helpRow: { flexDirection: 'row', gap: spacing.sm },
  helpGlyphCol: { fontSize: 12, width: 16, textAlign: 'center', lineHeight: 15 },
  helpText: { fontSize: 11, lineHeight: 15, flex: 1 },
  // Drawn chevron instead of a text "⌄": no baseline drift against the
  // title, and a real 28 pt tap target (#24).
  collapseBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -6,
    marginRight: -6,
  },
  chevron: {
    width: 13,
    height: 13,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginTop: -4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowDim: { opacity: 0.45 },
  // Rows read "status | identity | actions" (#23): a leading dot shows
  // connectedness (the live screen's state-dot language), and the action
  // icons sit behind a hairline so tappable and status-only glyphs never
  // share a visual group.
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  name: { flex: 1 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderLeftWidth: 1,
    paddingLeft: spacing.sm,
  },
  // 36 pt boxes + 4 pt hitSlop ≈ Apple's 44 pt target; the glyph stays
  // modest so the panel keeps its compact hierarchy.
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 17 },
  iconDisabled: { opacity: 0.3 },
  empty: { textAlign: 'center', marginVertical: spacing.xs },
  spawnRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xxs },
  spawnBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.control,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
