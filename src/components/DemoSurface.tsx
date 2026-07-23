import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DemoProfile, PROFILE_LABEL } from '../ble/DemoHeartRateMonitor';
import { navigationRef } from '../navigation';
import { demoMonitor, useHeartRate } from '../store/appStore';
import { useDevMode } from '../store/devModeStore';
import { colors, spacing } from '../theme';

const PILL = { width: 92, height: 40 };
// 288 + 2 * EDGE.side fills a 320 pt screen exactly — the floor for
// supported devices — while giving the 36 pt action targets room.
const PANEL_WIDTH = 288;
// Bottom inset keeps the default position clear of the Disconnect
// button and version footer. Top must clear the iOS Notification Center
// pull-down: with the 12 pt hitSlop a grab can start that far above the
// dot, and at 16 pt the system gesture claimed the drag (#26).
const EDGE = { side: spacing.md, top: spacing.xl, bottom: 104 };
// Release displacement under this is a tap (opens the panel), not a drag.
const TAP_SLOP = 6;

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

type AnchorRow = 'top' | 'middle' | 'bottom';
type AnchorCol = 'left' | 'center' | 'right';
interface Anchor {
  row: AnchorRow;
  col: AnchorCol;
}
interface Size {
  width: number;
  height: number;
}

// The snap positions of issue #21: 4 corners + 4 mid-edges.
const ANCHORS: Anchor[] = (['top', 'middle', 'bottom'] as const).flatMap((row) =>
  (['left', 'center', 'right'] as const)
    .filter((col) => !(row === 'middle' && col === 'center'))
    .map((col) => ({ row, col })),
);

// Where the surface was last dragged. Pill and panel share it — they are
// one object in two states (#28), so collapsing after a panel drag puts
// the pill where the panel was. In-memory only, like the demo devices
// themselves (map #15): a restart is back at bottom-right.
let sessionAnchor: Anchor = { row: 'bottom', col: 'right' };

/**
 * Top-left corner of an element of `size` snapped to `anchor`. Elements
 * center themselves on the middle row / center column, so the pill and
 * the variable-height panel share one anchor vocabulary.
 */
function anchorPoint({ row, col }: Anchor, frame: Size, size: Size): { x: number; y: number } {
  const x =
    col === 'left'
      ? EDGE.side
      : col === 'right'
        ? frame.width - size.width - EDGE.side
        : (frame.width - size.width) / 2;
  const y =
    row === 'top'
      ? EDGE.top
      : row === 'bottom'
        ? frame.height - size.height - EDGE.bottom
        : (frame.height - size.height) / 2;
  return { x, y };
}

/**
 * Offset of the panel's center from its resting position at scale 0,
 * chosen so the edge it is anchored to stays pinned: the panel unfolds
 * out of its snap corner instead of ballooning from its center.
 */
function scaleOrigin({ row, col }: Anchor, size: Size): { x: number; y: number } {
  const x = col === 'left' ? -size.width / 2 : col === 'right' ? size.width / 2 : 0;
  const y = row === 'top' ? -size.height / 2 : row === 'bottom' ? size.height / 2 : 0;
  return { x, y };
}

// The "you can drag this" affordance shared by the pill and the panel
// header. View-drawn like the chevron (#24) so it can't drift on a text
// baseline.
function DotGrip() {
  return (
    <View style={styles.grip}>
      {[0, 1, 2].map((rowIndex) => (
        <View key={rowIndex} style={styles.gripRow}>
          <View style={styles.gripDot} />
          <View style={styles.gripDot} />
        </View>
      ))}
    </View>
  );
}

function nearestAnchor(pos: { x: number; y: number }, frame: Size, size: Size): Anchor {
  let best = ANCHORS[0];
  let bestDistance = Infinity;
  for (const anchor of ANCHORS) {
    const point = anchorPoint(anchor, frame, size);
    const distance = (point.x - pos.x) ** 2 + (point.y - pos.y) ** 2;
    if (distance < bestDistance) {
      best = anchor;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The demo control surface (issues #17/#19): a small grey "DEMO" pill
 * present on every screen — release builds included — that expands into
 * a compact panel for summoning and controlling virtual devices, small
 * enough that the app stays visible while you drive the mocks. Pill and
 * panel are both draggable — the panel by its header (#28) — and snap to
 * corners and mid-edges so they can never permanently cover critical
 * UI (#21).
 */
export function DemoSurface() {
  const devices = useSyncExternalStore(
    (onChange) => demoMonitor.onDevicesChanged(onChange),
    () => demoMonitor.getDevices(),
  );
  const connectedId = useHeartRate((state) => state.connectedDevice?.id ?? null);
  const devMode = useDevMode((state) => state.enabled);
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [frame, setFrame] = useState<Size | null>(null);
  const [panelSize, setPanelSize] = useState<Size | null>(null);
  const frameRef = useRef<Size | null>(null);
  const panelSizeRef = useRef<Size | null>(null);
  const draggingRef = useRef(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const posRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const subscription = pan.addListener((value) => {
      posRef.current = value;
    });
    return () => pan.removeListener(subscription);
  }, [pan]);

  // Unfold progress: 0 = pill, 1 = panel. Animated alongside pan so the
  // two states read as one object changing shape (#28) rather than a
  // dialog replacing a button.
  const openAnim = useRef(new Animated.Value(0)).current;
  const [animOrigin, setAnimOrigin] = useState({ x: 0, y: 0 });
  const [closing, setClosing] = useState(false);
  const pendingOpenAnimRef = useRef(false);

  const animateOpen = () => {
    Animated.spring(openAnim, { toValue: 1, friction: 7, useNativeDriver: false }).start();
  };

  const snapTo = (next: Anchor, target: Size, size: Size) => {
    sessionAnchor = next;
    Animated.spring(pan, {
      toValue: anchorPoint(next, target, size),
      friction: 6,
      useNativeDriver: false,
    }).start();
  };

  const grab = () => {
    draggingRef.current = true;
    pan.setOffset(posRef.current);
    pan.setValue({ x: 0, y: 0 });
  };

  const settle = (size: Size) => {
    draggingRef.current = false;
    pan.flattenOffset();
    const current = frameRef.current;
    if (current) snapTo(nearestAnchor(posRef.current, current, size), current, size);
  };

  const settlePanel = () => settle(panelSizeRef.current ?? { width: PANEL_WIDTH, height: 0 });

  const openPanel = () => {
    draggingRef.current = false;
    pan.flattenOffset();
    const current = frameRef.current;
    const size = panelSizeRef.current;
    // First open has no measured size yet: the panel renders hidden and
    // onPanelLayout places it, then starts the unfold.
    if (current && size) {
      pan.setValue(anchorPoint(sessionAnchor, current, size));
      setAnimOrigin(scaleOrigin(sessionAnchor, size));
      animateOpen();
    } else {
      pendingOpenAnimRef.current = true;
    }
    setOpen(true);
  };

  const collapse = () => {
    if (closing) return;
    const size = panelSizeRef.current;
    if (size) setAnimOrigin(scaleOrigin(sessionAnchor, size));
    setClosing(true);
    Animated.spring(openAnim, {
      toValue: 0,
      friction: 7,
      // A refold that overshoots would swing through negative scale.
      overshootClamping: true,
      useNativeDriver: false,
    }).start(() => {
      setClosing(false);
      setOpen(false);
      // Help is read-once: reopening the panel returns to the compact
      // working layout, not a wall of text.
      setHelpOpen(false);
      const current = frameRef.current;
      if (current) pan.setValue(anchorPoint(sessionAnchor, current, PILL));
    });
  };

  const pillResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: grab,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_event, gesture) => {
        if (Math.abs(gesture.dx) < TAP_SLOP && Math.abs(gesture.dy) < TAP_SLOP) {
          openPanel();
          return;
        }
        settle(PILL);
      },
      onPanResponderTerminate: () => settle(PILL),
    }),
  ).current;

  const headerResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: grab,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => settlePanel(),
      onPanResponderTerminate: () => settlePanel(),
    }),
  ).current;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const next = { width, height };
    frameRef.current = next;
    setFrame(next);
    const size = open ? (panelSizeRef.current ?? PILL) : PILL;
    pan.setValue(anchorPoint(sessionAnchor, next, size));
  };

  const onPanelLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const size = { width, height };
    panelSizeRef.current = size;
    setPanelSize(size);
    // Keep the panel pinned to its anchor as rows come and go (a
    // bottom-anchored panel grows upward); a drag in progress owns the
    // position instead.
    const current = frameRef.current;
    if (current && !draggingRef.current) {
      pan.setValue(anchorPoint(sessionAnchor, current, size));
    }
    if (pendingOpenAnimRef.current) {
      pendingOpenAnimRef.current = false;
      setAnimOrigin(scaleOrigin(sessionAnchor, size));
      animateOpen();
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {frame !== null && !open && (
        <Animated.View
          style={[styles.pill, { transform: pan.getTranslateTransform() }]}
          hitSlop={12}
          {...pillResponder.panHandlers}
        >
          <DotGrip />
          <Text style={styles.pillText}>DEMO</Text>
          {devices.length > 0 && (
            <View
              style={[
                styles.pillDot,
                devices.some((device) => device.id === connectedId) && styles.statusDotConnected,
              ]}
            />
          )}
        </Animated.View>
      )}
      {frame !== null && open && (
        <Animated.View
          style={[
            styles.panel,
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
              <DotGrip />
              <Text style={styles.title}>Demo devices</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.helpBtn, pressed && styles.pressed]}
              hitSlop={8}
              onPress={() => setHelpOpen((current) => !current)}
            >
              <Text style={[styles.helpGlyph, helpOpen && styles.helpGlyphOn]}>?</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.collapseBtn, pressed && styles.pressed]}
              hitSlop={8}
              onPress={collapse}
            >
              <View style={styles.chevron} />
            </Pressable>
          </View>
          {helpOpen && (
            <View style={styles.help}>
              {HELP_ROWS.map(({ glyph, text }) => (
                <View key={glyph} style={styles.helpRow}>
                  <Text style={styles.helpGlyphCol}>{glyph}</Text>
                  <Text style={styles.helpText}>{text}</Text>
                </View>
              ))}
            </View>
          )}
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
                  hitSlop={4}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                  onPress={() => demoMonitor.setAdvertising(device.id, !device.advertising)}
                >
                  <Text style={[styles.icon, device.advertising && styles.iconOn]}>⏻</Text>
                </Pressable>
                <Pressable
                  hitSlop={4}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                  disabled={connectedId !== device.id}
                  onPress={() => demoMonitor.dropConnection()}
                >
                  <Text style={[styles.icon, connectedId !== device.id && styles.iconDisabled]}>
                    ⚡
                  </Text>
                </Pressable>
                <Pressable
                  hitSlop={4}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                  onPress={() => demoMonitor.dismiss(device.id)}
                >
                  <Text style={styles.icon}>✕</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {devices.length === 0 && (
            <Text style={styles.empty}>No demo devices — add one below ↓</Text>
          )}
          <View style={styles.spawnRow}>
            {(Object.keys(PROFILE_LABEL) as DemoProfile[]).map((profile) => (
              <Pressable
                key={profile}
                style={({ pressed }) => [styles.spawnBtn, pressed && styles.pressed]}
                onPress={() => demoMonitor.summon(profile)}
              >
                <Text style={styles.spawnText}>＋{PROFILE_LABEL[profile]}</Text>
              </Pressable>
            ))}
          </View>
          {/* Dev-mode affordance (#88): hidden until the About-footer easter
              egg flips dev mode on. Opens the on-device Storybook route. */}
          {devMode && (
            <Pressable
              style={({ pressed }) => [styles.devRow, pressed && styles.pressed]}
              onPress={() => {
                collapse();
                if (navigationRef.isReady()) navigationRef.navigate('Storybook');
              }}
            >
              <Text style={styles.devRowText}>Storybook →</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // A labeled pill instead of the former ring-and-core: the word says
  // what the control is (#27) while its neutral greys keep it
  // subordinate to the app UI.
  pill: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: PILL.width,
    height: PILL.height,
    borderRadius: PILL.height / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.textDim,
    opacity: 0.75,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pillText: { color: colors.textDim, fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  // Mirrors the panel rows' status dot: green while a demo device is
  // connected, dim grey while devices merely exist, absent when none —
  // a collapsed pill still reports what the mocks are doing.
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textDim },
  // View-drawn like the chevron (#24): text glyphs drift on their
  // baseline and render inconsistently across platform fonts.
  grip: { gap: 3 },
  gripRow: { flexDirection: 'row', gap: 3 },
  gripDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textDim },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: PANEL_WIDTH,
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
  title: { color: colors.text, fontSize: 13, fontWeight: '700' },
  // Help opener lives in the title strip like the chevron (#33): a
  // sibling Pressable outside the drag handle, so it can never become a
  // second drag-gesture claimant (#28).
  helpBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -6,
  },
  helpGlyph: { color: colors.textDim, fontSize: 16, fontWeight: '700' },
  helpGlyphOn: { color: colors.accent },
  help: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    gap: 6,
  },
  helpRow: { flexDirection: 'row', gap: spacing.sm },
  helpGlyphCol: { color: colors.textDim, fontSize: 12, width: 16, textAlign: 'center', lineHeight: 15 },
  helpText: { color: colors.textDim, fontSize: 11, lineHeight: 15, flex: 1 },
  // Drawn chevron instead of a text "⌄": no baseline drift against the
  // title, and a real 28 pt tap target (#24).
  collapseBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
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
  // 36 pt boxes + 4 pt hitSlop ≈ Apple's 44 pt target; the glyph stays
  // modest so the panel keeps its compact hierarchy.
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { color: colors.textDim, fontSize: 17 },
  iconOn: { color: colors.accent },
  iconDisabled: { opacity: 0.3 },
  pressed: { backgroundColor: colors.border },
  empty: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginVertical: spacing.xs },
  spawnRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  spawnBtn: {
    flex: 1,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 10,
  },
  spawnText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  // Set off from the demo-device controls above by a hairline: it drives
  // the app, not the mocks.
  devRow: {
    marginTop: 2,
    paddingTop: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  devRowText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
});
