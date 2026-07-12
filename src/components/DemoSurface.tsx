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
interface Frame {
  width: number;
  height: number;
}

// The snap positions of issue #21: 4 corners + 4 mid-edges.
const ANCHORS: Anchor[] = (['top', 'middle', 'bottom'] as const).flatMap((row) =>
  (['left', 'center', 'right'] as const)
    .filter((col) => !(row === 'middle' && col === 'center'))
    .map((col) => ({ row, col })),
);

// Where the dot was last dragged. In-memory only, like the demo devices
// themselves (map #15): a restart is back at bottom-right.
let sessionAnchor: Anchor = { row: 'bottom', col: 'right' };

function dotPoint({ row, col }: Anchor, frame: Frame): { x: number; y: number } {
  const x =
    col === 'left'
      ? EDGE.side
      : col === 'right'
        ? frame.width - PILL.width - EDGE.side
        : (frame.width - PILL.width) / 2;
  const y =
    row === 'top'
      ? EDGE.top
      : row === 'bottom'
        ? frame.height - PILL.height - EDGE.bottom
        : (frame.height - PILL.height) / 2;
  return { x, y };
}

function nearestAnchor(pos: { x: number; y: number }, frame: Frame): Anchor {
  let best = ANCHORS[0];
  let bestDistance = Infinity;
  for (const anchor of ANCHORS) {
    const point = dotPoint(anchor, frame);
    const distance = (point.x - pos.x) ** 2 + (point.y - pos.y) ** 2;
    if (distance < bestDistance) {
      best = anchor;
      bestDistance = distance;
    }
  }
  return best;
}

/** The panel opens on the dot's edge and grows inward from it. */
function panelPlacement({ row, col }: Anchor, frame: Frame) {
  return {
    ...(col === 'left'
      ? { left: EDGE.side }
      : col === 'right'
        ? { right: EDGE.side }
        : { left: (frame.width - PANEL_WIDTH) / 2 }),
    ...(row === 'top'
      ? { top: EDGE.top }
      : row === 'middle'
        ? { top: (frame.height - PILL.height) / 2 }
        : { bottom: EDGE.bottom }),
  };
}

/**
 * The demo control surface (issues #17/#19): a small grey "DEMO" pill
 * present on every screen — release builds included — that expands into
 * a compact panel for summoning and controlling virtual devices, small
 * enough that the app stays visible while you drive the mocks. The pill
 * is draggable and snaps to corners and mid-edges so it can never
 * permanently cover critical UI (#21).
 */
export function DemoSurface() {
  const devices = useSyncExternalStore(
    (onChange) => demoMonitor.onDevicesChanged(onChange),
    () => demoMonitor.getDevices(),
  );
  const connectedId = useHeartRate((state) => state.connectedDevice?.id ?? null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(sessionAnchor);
  const [frame, setFrame] = useState<Frame | null>(null);
  const frameRef = useRef<Frame | null>(null);

  const pan = useRef(new Animated.ValueXY()).current;
  const posRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const subscription = pan.addListener((value) => {
      posRef.current = value;
    });
    return () => pan.removeListener(subscription);
  }, [pan]);

  const snapTo = (next: Anchor, target: Frame) => {
    sessionAnchor = next;
    setAnchor(next);
    Animated.spring(pan, {
      toValue: dotPoint(next, target),
      friction: 6,
      useNativeDriver: false,
    }).start();
  };

  const settle = () => {
    pan.flattenOffset();
    const current = frameRef.current;
    if (current) snapTo(nearestAnchor(posRef.current, current), current);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset(posRef.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_event, gesture) => {
        if (Math.abs(gesture.dx) < TAP_SLOP && Math.abs(gesture.dy) < TAP_SLOP) {
          pan.flattenOffset();
          setOpen(true);
          return;
        }
        settle();
      },
      onPanResponderTerminate: settle,
    }),
  ).current;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const next = { width, height };
    frameRef.current = next;
    setFrame(next);
    pan.setValue(dotPoint(sessionAnchor, next));
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {frame !== null && !open && (
        <Animated.View
          style={[styles.pill, { transform: pan.getTranslateTransform() }]}
          hitSlop={12}
          {...responder.panHandlers}
        >
          <Text style={styles.pillText}>DEMO</Text>
        </Animated.View>
      )}
      {frame !== null && open && renderPanel(panelPlacement(anchor, frame))}
    </View>
  );

  function renderPanel(placement: object) {
    return (
      <View style={[styles.panel, placement]}>
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
