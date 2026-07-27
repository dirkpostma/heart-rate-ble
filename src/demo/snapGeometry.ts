import { spacing } from '../ds';

// Bottom inset keeps the default position clear of the Disconnect
// button and version footer. Top must clear the iOS Notification Center
// pull-down: with the 12 pt hitSlop a grab can start that far above the
// dot, and at 16 pt the system gesture claimed the drag (#26).
export const EDGE = { side: spacing.md, top: spacing.xl, bottom: 104 };

export type AnchorRow = 'top' | 'middle' | 'bottom';
export type AnchorCol = 'left' | 'center' | 'right';
export interface Anchor {
  row: AnchorRow;
  col: AnchorCol;
}
export interface Size {
  width: number;
  height: number;
}

// The snap positions of issue #21: 4 corners + 4 mid-edges.
export const ANCHORS: Anchor[] = (['top', 'middle', 'bottom'] as const).flatMap((row) =>
  (['left', 'center', 'right'] as const)
    .filter((col) => !(row === 'middle' && col === 'center'))
    .map((col) => ({ row, col })),
);

/**
 * Top-left corner of an element of `size` snapped to `anchor`. Elements
 * center themselves on the middle row / center column, so the pill and
 * the variable-height panel share one anchor vocabulary.
 */
export function anchorPoint(
  { row, col }: Anchor,
  frame: Size,
  size: Size,
): { x: number; y: number } {
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
export function scaleOrigin({ row, col }: Anchor, size: Size): { x: number; y: number } {
  const x = col === 'left' ? -size.width / 2 : col === 'right' ? size.width / 2 : 0;
  const y = row === 'top' ? -size.height / 2 : row === 'bottom' ? size.height / 2 : 0;
  return { x, y };
}

export function nearestAnchor(pos: { x: number; y: number }, frame: Size, size: Size): Anchor {
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
