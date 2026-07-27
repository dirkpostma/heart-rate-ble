import {
  ANCHORS,
  anchorPoint,
  EdgeInsets,
  nearestAnchor,
  scaleOrigin,
  Size,
} from './snapGeometry';

// The real insets the gesture layer passes (spacing.md / spacing.xl / 104).
const EDGE: EdgeInsets = { side: 16, top: 40, bottom: 104 };
const FRAME: Size = { width: 400, height: 800 };
const PILL: Size = { width: 92, height: 40 };

describe('ANCHORS', () => {
  // Issue #21: 4 corners + 4 mid-edges. The centre of the screen is
  // deliberately excluded — the surface must never sit over the middle of the
  // app UI.
  it('is the eight snap positions, with no dead-centre', () => {
    expect(ANCHORS).toHaveLength(8);
    expect(ANCHORS).not.toContainEqual({ row: 'middle', col: 'center' });
  });

  it('has no duplicates', () => {
    const keys = ANCHORS.map((a) => `${a.row}-${a.col}`);
    expect(new Set(keys).size).toBe(ANCHORS.length);
  });
});

describe('anchorPoint', () => {
  it('insets the left and top edges by the edge margins', () => {
    expect(anchorPoint({ row: 'top', col: 'left' }, FRAME, PILL, EDGE)).toEqual({
      x: EDGE.side,
      y: EDGE.top,
    });
  });

  // The bottom inset is larger than the others: it keeps the surface clear of
  // the Disconnect button and the version footer.
  it('measures the right and bottom edges from the far side, allowing for size', () => {
    expect(anchorPoint({ row: 'bottom', col: 'right' }, FRAME, PILL, EDGE)).toEqual({
      x: FRAME.width - PILL.width - EDGE.side,
      y: FRAME.height - PILL.height - EDGE.bottom,
    });
  });

  it('centres on the middle row and the centre column', () => {
    expect(anchorPoint({ row: 'middle', col: 'left' }, FRAME, PILL, EDGE).y).toBe(
      (FRAME.height - PILL.height) / 2,
    );
    expect(anchorPoint({ row: 'top', col: 'center' }, FRAME, PILL, EDGE).x).toBe(
      (FRAME.width - PILL.width) / 2,
    );
  });

  // Pill and panel share one anchor vocabulary (#28), so a taller element must
  // stay inside the frame at the same anchor.
  it('keeps a taller element inside the frame at the same anchor', () => {
    const panel: Size = { width: 288, height: 320 };
    const { x, y } = anchorPoint({ row: 'bottom', col: 'right' }, FRAME, panel, EDGE);
    expect(x + panel.width).toBeLessThanOrEqual(FRAME.width);
    expect(y + panel.height).toBeLessThanOrEqual(FRAME.height);
  });

  it('places every anchor fully inside the frame', () => {
    for (const anchor of ANCHORS) {
      const { x, y } = anchorPoint(anchor, FRAME, PILL, EDGE);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + PILL.width).toBeLessThanOrEqual(FRAME.width);
      expect(y + PILL.height).toBeLessThanOrEqual(FRAME.height);
    }
  });
});

describe('nearestAnchor', () => {
  it('returns the anchor a position is sitting exactly on', () => {
    for (const anchor of ANCHORS) {
      expect(nearestAnchor(anchorPoint(anchor, FRAME, PILL, EDGE), FRAME, PILL, EDGE)).toEqual(anchor);
    }
  });

  it('snaps a nudged position back to the same anchor', () => {
    const target = { row: 'bottom', col: 'right' } as const;
    const point = anchorPoint(target, FRAME, PILL, EDGE);
    expect(nearestAnchor({ x: point.x - 12, y: point.y - 9 }, FRAME, PILL, EDGE)).toEqual(target);
  });

  it('picks the nearer of two candidates when dragged across the screen', () => {
    const topLeft = anchorPoint({ row: 'top', col: 'left' }, FRAME, PILL, EDGE);
    expect(nearestAnchor({ x: topLeft.x + 5, y: topLeft.y + 5 }, FRAME, PILL, EDGE)).toEqual({
      row: 'top',
      col: 'left',
    });
  });

  // Whatever it returns must be a real anchor — the pill can never come to
  // rest somewhere off the list.
  it('always returns one of the eight anchors', () => {
    for (const pos of [
      { x: -500, y: -500 },
      { x: 5000, y: 5000 },
      { x: FRAME.width / 2, y: FRAME.height / 2 },
    ]) {
      expect(ANCHORS).toContainEqual(nearestAnchor(pos, FRAME, PILL, EDGE));
    }
  });
});

describe('scaleOrigin', () => {
  const size: Size = { width: 288, height: 320 };

  // The origin offset pins the anchored edge while the panel scales, so it
  // unfolds out of its snap corner instead of ballooning from its centre.
  it('offsets away from the anchored edge, by half the size', () => {
    expect(scaleOrigin({ row: 'top', col: 'left' }, size)).toEqual({
      x: -size.width / 2,
      y: -size.height / 2,
    });
    expect(scaleOrigin({ row: 'bottom', col: 'right' }, size)).toEqual({
      x: size.width / 2,
      y: size.height / 2,
    });
  });

  it('does not offset along an axis that is centred', () => {
    expect(scaleOrigin({ row: 'middle', col: 'left' }, size).y).toBe(0);
    expect(scaleOrigin({ row: 'top', col: 'center' }, size).x).toBe(0);
  });

  it('mirrors opposite corners', () => {
    const topLeft = scaleOrigin({ row: 'top', col: 'left' }, size);
    const bottomRight = scaleOrigin({ row: 'bottom', col: 'right' }, size);
    expect(topLeft).toEqual({ x: -bottomRight.x, y: -bottomRight.y });
  });
});
