import { findKnownWords, type KnownWordIndex } from './known-words';

/**
 * Colours the words the user has Anki cards for (`known-words.ts`) through the
 * CSS Custom Highlight API: ranges over the existing text nodes, styled by
 * `::highlight(known-word)`. The DOM is never touched — the one-text-node-per-
 * line layout and Yomitan's scanning see exactly what they saw before. A
 * browser without the API simply colours nothing.
 */

export const KNOWN_WORD_HIGHLIGHT = 'known-word';

let highlight: Highlight | null = null;

function sharedHighlight(): Highlight | null {
  if (typeof Highlight === 'undefined' || typeof CSS === 'undefined' || !('highlights' in CSS)) {
    return null;
  }
  if (!highlight) {
    highlight = new Highlight();
    CSS.highlights.set(KNOWN_WORD_HIGHLIGHT, highlight);
  }
  return highlight;
}

/** Matches per text, per word list: page turns and re-mounts cost nothing twice. */
const memo = new WeakMap<KnownWordIndex, Map<string, [number, number][]>>();

function matchesFor(text: string, index: KnownWordIndex): [number, number][] {
  let byText = memo.get(index);
  if (!byText) {
    byText = new Map();
    memo.set(index, byText);
  }
  let found = byText.get(text);
  if (!found) {
    if (byText.size > 2000) byText.clear();
    found = findKnownWords(text, index);
    byText.set(text, found);
  }
  return found;
}

/** Ranges over `root`'s text for every known word; a word may cross line spans. */
export function knownWordRanges(root: Node, index: KnownWordIndex): Range[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  const text = nodes.map((n) => n.data).join('');
  const ranges: Range[] = [];
  let node = 0;
  let nodeStart = 0;
  // Advance to the node holding `offset` (an end may sit at a node's end).
  const locate = (offset: number, isEnd: boolean): [Text, number] => {
    while (
      node < nodes.length - 1 &&
      (isEnd ? offset > nodeStart + nodes[node].length : offset >= nodeStart + nodes[node].length)
    ) {
      nodeStart += nodes[node].length;
      node++;
    }
    return [nodes[node], offset - nodeStart];
  };
  for (const [start, end] of matchesFor(text, index)) {
    const range = document.createRange();
    range.setStart(...locate(start, false));
    range.setEnd(...locate(end, true));
    ranges.push(range);
  }
  return ranges;
}

/**
 * Svelte action for an OCR text box. `index` null (the setting off) clears
 * its marks; `key` changes whenever the box's text or layout may have.
 */
export function knownWordMarks(
  element: HTMLElement,
  params: { index: KnownWordIndex | null; key: string }
) {
  let ranges: Range[] = [];
  let frame = 0;

  const clear = () => {
    for (const range of ranges) highlight?.delete(range);
    ranges = [];
  };
  const mark = () => {
    clear();
    const { index } = params;
    if (!index || !index.terms.size) return;
    const target = sharedHighlight();
    if (!target) return;
    ranges = knownWordRanges(element, index);
    for (const range of ranges) target.add(range);
  };
  // After the frame's DOM updates, so the ranges land on the final text nodes
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(mark);
  };

  schedule();
  return {
    update(next: { index: KnownWordIndex | null; key: string }) {
      if (next.index === params.index && next.key === params.key) return;
      params = next;
      schedule();
    },
    destroy() {
      cancelAnimationFrame(frame);
      clear();
    }
  };
}
