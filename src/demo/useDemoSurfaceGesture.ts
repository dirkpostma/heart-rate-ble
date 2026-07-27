import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder } from 'react-native';
import { Anchor, anchorPoint, nearestAnchor, scaleOrigin, Size } from './snapGeometry';

const PILL = { width: 92, height: 40 };
// 288 + 2 * EDGE.side fills a 320 pt screen exactly — the floor for
// supported devices — while giving the 36 pt action targets room.
const PANEL_WIDTH = 288;
// Release displacement under this is a tap (opens the panel), not a drag.
const TAP_SLOP = 6;

// Where the surface was last dragged. Pill and panel share it — they are
// one object in two states (#28), so collapsing after a panel drag puts
// the pill where the panel was. In-memory only, like the demo devices
// themselves (map #15): a restart is back at bottom-right.
let sessionAnchor: Anchor = { row: 'bottom', col: 'right' };

/**
 * The drag/unfold gesture engine behind the demo surface (issues #17/#19,
 * #21, #28): pan responders for both the collapsed pill and the panel's
 * drag handle, the pill<->panel unfold animation, and the snap-to-anchor
 * layout dance. Kept separate from the panel UI (DemoSurface.tsx) and the
 * pure geometry (snapGeometry.ts) per the demo folder's decomposition.
 */
export function useDemoSurfaceGesture() {
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

  const [helpOpen, setHelpOpen] = useState(false);

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

  return {
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
  };
}
