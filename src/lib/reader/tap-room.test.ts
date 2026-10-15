import { describe, expect, it } from 'vitest';
import type { LineLayout } from './line-coords-layout';
import { TAP_ROOM_EM, tapRoomExtension, tapRoomGlyphSize } from './tap-room';

/** A vertical column at x, from y=0 down to `length`, glyphs `size` px. */
function column(x: number, length: number, size = 20, hidden = false): LineLayout {
  return {
    left: x,
    top: 0,
    fontSize: size,
    wrap: false,
    width: size,
    height: length,
    rotation: 0,
    letterSpacing: 0,
    inset: 0,
    hidden
  };
}

describe('tapRoomExtension', () => {
  // 20 px glyphs: wants 1.5 × 20 = 30 px free after the text's cells, which
  // end 0.25 × 20 = 5 px past the longest quad
  it('grows a box its text runs to the end of', () => {
    const lines = [column(40, 200), column(10, 120)];
    expect(tapRoomExtension(lines, true, 200, 1000)).toBeCloseTo(35);
  });

  it('leaves a box that already has room after its longest line', () => {
    const lines = [column(40, 150), column(10, 120)];
    expect(tapRoomExtension(lines, true, 200, 1000)).toBe(0);
  });

  it('only adds what is missing', () => {
    const lines = [column(40, 180)];
    // free after cells: 200 − 185 = 15 → 15 more
    expect(tapRoomExtension(lines, true, 200, 1000)).toBeCloseTo(15);
  });

  it('measures horizontal text along x', () => {
    const line: LineLayout = { ...column(0, 20), width: 300, height: 20 };
    expect(tapRoomExtension([line], false, 300, 1000)).toBeCloseTo(35);
    expect(tapRoomExtension([line], true, 20, 1000)).toBeCloseTo(35);
  });

  it('never grows the box off the page', () => {
    expect(tapRoomExtension([column(0, 200)], true, 200, 12)).toBe(12);
    expect(tapRoomExtension([column(0, 200)], true, 200, 0)).toBe(0);
  });

  it('ignores hidden duplicate lines, and needs a shown line', () => {
    const lines = [column(40, 120), column(10, 200, 20, true)];
    expect(tapRoomExtension(lines, true, 200, 1000)).toBe(0);
    expect(tapRoomExtension([column(0, 200, 20, true)], true, 200, 1000)).toBe(0);
    expect(tapRoomGlyphSize([column(0, 200, 20, true)])).toBeNull();
  });

  it("sizes the strip from the block's median glyph", () => {
    const lines = [column(0, 100, 10), column(20, 100, 30), column(40, 100, 20)];
    expect(tapRoomGlyphSize(lines)).toBe(20);
    expect(TAP_ROOM_EM).toBe(1.5);
  });
});
