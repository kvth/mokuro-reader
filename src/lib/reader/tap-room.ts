import type { LineLayout } from './line-coords-layout';

/**
 * Room for the translation switch: a short tap on a bubble's box OFF its
 * characters switches it (TextBoxes.svelte, `isPointOnText`). An OCR box hugs
 * its ink, so a bubble whose longest line runs to the box's end has nowhere to
 * tap. Such a box is made longer at its END — downwards for vertical text, to
 * the right for horizontal — until a strip of `TAP_ROOM_EM` glyphs follows
 * the text; a box with that much room already stays as it is.
 *
 * Only the end moves: per-line text is placed relative to the box's top-left
 * corner, so the text never moves.
 */
export const TAP_ROOM_EM = 1.5;

/**
 * Where a rendered line's glyph cells end past its quad, in glyphs: the quad
 * hugs the last glyph's INK, its cell (and letter-spacing) runs a little
 * further (`glyph-insets.ts`).
 */
const CELL_OVERHANG_EM = 0.25;

/** The block's glyph size: the median size of its shown lines, or null. */
export function tapRoomGlyphSize(lines: LineLayout[]): number | null {
  const sizes = lines
    .filter((line) => !line.hidden)
    .map((line) => line.fontSize)
    .sort((a, b) => a - b);
  return sizes.length ? sizes[Math.floor(sizes.length / 2)] : null;
}

/**
 * px to add at the end of a box `boxLength` long (along the reading axis,
 * image px), so a tap strip follows its text. `roomToPageEdge` caps it: a box
 * never grows off the page.
 */
export function tapRoomExtension(
  lines: LineLayout[],
  vertical: boolean,
  boxLength: number,
  roomToPageEdge: number
): number {
  const size = tapRoomGlyphSize(lines);
  if (size === null) return 0;
  let textEnd = 0;
  for (const line of lines) {
    if (line.hidden) continue;
    textEnd = Math.max(textEnd, vertical ? line.top + line.height : line.left + line.width);
  }
  const free = boxLength - (textEnd + CELL_OVERHANG_EM * size);
  const missing = TAP_ROOM_EM * size - free;
  return Math.min(Math.max(missing, 0), Math.max(roomToPageEdge, 0));
}
