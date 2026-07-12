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
import { demoMonitor, useHeartRate } from '../store/appStore';
import { colors, spacing } from '../theme';

const PILL = { width: 54, height: 24 };
const PANEL_WIDTH = 264;
// Bottom inset keeps the default position clear of the Disconnect
// button and version footer. Top must clear the iOS Notification Center
// pull-down: with the 12 pt hitSlop a grab can start that far above the
// dot, and at 16 pt the system gesture claimed the drag (#26).
const EDGE = { side: spacing.md, top: spacing.xl, bottom: 104 };
// Release displacement under this is a tap (opens the panel), not a drag.
const TAP_SLOP = 6;

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
  const [open, setOpen] = useState(false);
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
    // onPanelLayout places it.
    if (current && size) pan.setValue(anchorPoint(sessionAnchor, current, size));
    setOpen(true);
  };

  const collapse = () => {
    const current = frameRef.current;
    if (current) pan.setValue(anchorPoint(sessionAnchor, current, PILL));
    setOpen(false);
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
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {frame !== null && !open && (
        <Animated.View
          style={[styles.pill, { transform: pan.getTranslateTransform() }]}
          hitSlop={12}
          {...pillResponder.panHandlers}
        >
          <Text style={styles.pillText}>DEMO</Text>
        </Animated.View>
      )}
      {frame !== null && open && (
        <Animated.View
          style={[
            styles.panel,
            panelSize === null && styles.panelUnmeasured,
            { transform: pan.getTranslateTransform() },
          ]}
          onLayout={onPanelLayout}
        >
          <View style={styles.header}>
            <View style={styles.dragHandle} {...headerResponder.panHandlers}>
              <Text style={styles.title}>Demo devices</Text>
            </View>
            <Pressable style={styles.collapseBtn} hitSlop={8} onPress={collapse}>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { color: colors.textDim, fontSize: 10, fontWeight: '600', letterSpacing: 1 },
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
  dragHandle: { flex: 1, height: 28, justifyContent: 'center', marginVertical: -6 },
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
