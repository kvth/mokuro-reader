/**
 * Is the client point (x, y) over a character of `root`'s text?
 *
 * The same test Yomitan applies before it looks anything up: the point lies
 * in the client rect of a non-whitespace character. A tap that fails it is
 * one Yomitan ignores, so the reader may give it a meaning of its own (a
 * bubble's translation switch) without the two ever answering the same tap.
 *
 * Rects come from layout, which `visibility: hidden` text still has, so this
 * works while the OCR text is not shown. Letter-spacing counts as part of a
 * character, as it does for Yomitan.
 */
export function isPointOnText(root: Node, x: number, y: number): boolean {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? '';
    for (let i = 0; i < text.length; ) {
      const size = (text.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
      if (!/\s/.test(text[i])) {
        range.setStart(node, i);
        range.setEnd(node, i + size);
        for (const rect of range.getClientRects()) {
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return true;
          }
        }
      }
      i += size;
    }
  }
  return false;
}
