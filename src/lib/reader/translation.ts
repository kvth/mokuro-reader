/**
 * Speech-bubble translations added by mokuro-translate.
 *
 * A block may carry `translations: { [lang]: text }`, an optional extension
 * key the upstream reader ignores and this one stores and exports verbatim
 * with the rest of the block. The overlay shows a block's translation in
 * place of its OCR text in translation mode (`showTranslation` setting; the R
 * key cycles through the volume's languages), or when that one bubble was
 * switched to a language from the text box context menu.
 */
import { writable } from 'svelte/store';
import type { Block, Page } from '$lib/types';

export function normalizeLanguage(lang: string): string {
  return lang.trim().toLowerCase();
}

function primaryLanguage(lang: string): string {
  return normalizeLanguage(lang).split('-')[0];
}

function usableText(text: unknown): text is string {
  return typeof text === 'string' && text.trim() !== '';
}

/**
 * The block's translation to `lang`: an exact key first, then any key with
 * the same primary language (`en` finds `en-gb` and the other way round).
 */
export function getBlockTranslation(block: Block, lang: string): string | undefined {
  const translations = block.translations;
  if (!translations || typeof translations !== 'object') return undefined;

  const wanted = normalizeLanguage(lang);
  if (usableText(translations[wanted])) return translations[wanted];
  for (const [key, text] of Object.entries(translations)) {
    if (primaryLanguage(key) === primaryLanguage(wanted) && usableText(text)) return text;
  }
  return undefined;
}

/** The languages the block has a translation in, normalized and sorted. */
export function blockTranslationLanguages(block: Block): string[] {
  const translations = block.translations;
  if (!translations || typeof translations !== 'object') return [];
  const langs = Object.entries(translations)
    .filter(([, text]) => usableText(text))
    .map(([key]) => normalizeLanguage(key));
  return [...new Set(langs)].sort();
}

/** Every language any block of the pages has a translation in, sorted. */
export function volumeTranslationLanguages(pages: (Page | undefined)[]): string[] {
  const langs = new Set<string>();
  for (const page of pages) {
    for (const block of page?.blocks ?? []) {
      for (const lang of blockTranslationLanguages(block)) langs.add(lang);
    }
  }
  return [...langs].sort();
}

/**
 * Which of `langs` stands for `preferred`: the same code, else the first with
 * the same primary language, else null.
 */
export function matchTranslationLanguage(preferred: string, langs: string[]): string | null {
  const wanted = normalizeLanguage(preferred);
  if (langs.includes(wanted)) return wanted;
  return langs.find((lang) => primaryLanguage(lang) === primaryLanguage(wanted)) ?? null;
}

/**
 * The area a translation is fitted into, in image px. A Japanese text box
 * hugs its (often narrow, vertical) columns, while horizontal translated text
 * needs a wider area: the box wants to grow to 120% of its width (at least 3/4
 * of its height) and 110% of its height, around its centre.
 *
 * It never leaves the page and never crosses a neighbour's area. `others` are
 * the page's other text boxes; every pair of boxes splits the space between
 * them along ONE line, halfway across the gap — or, for boxes that already
 * overlap, through the overlap, so both give up part of it. Both boxes of a
 * pair pick the same line (`splitLine`), so whichever bubbles show a
 * translation, no two areas cover each other — short of a box inside another,
 * or one squeezed to nothing between two neighbours, which keeps its own box
 * rather than vanish. Room one side lacks (a neighbour, the page edge) goes to
 * the other side.
 */
export function translationBox(
  box: number[],
  imgWidth: number,
  imgHeight: number,
  others: number[][] = []
): { left: number; top: number; width: number; height: number } {
  const own = clampBox(box, imgWidth, imgHeight);
  const [xmin, ymin, xmax, ymax] = own;
  const boxWidth = xmax - xmin;
  const boxHeight = ymax - ymin;

  // How far each side may reach
  let minLeft = 0;
  let maxRight = imgWidth;
  let minTop = 0;
  let maxBottom = imgHeight;
  for (const other of others) {
    const split = splitLine(box, other);
    if (!split) continue;
    if (split.axis === 'x') {
      if (split.before) minLeft = Math.max(minLeft, split.at);
      else maxRight = Math.min(maxRight, split.at);
    } else if (split.before) minTop = Math.max(minTop, split.at);
    else maxBottom = Math.min(maxBottom, split.at);
  }
  // Squeezed from both sides past each other: give up shrinking on that axis
  if (minLeft >= maxRight)
    [minLeft, maxRight] = [Math.min(minLeft, xmin), Math.max(maxRight, xmax)];
  if (minTop >= maxBottom)
    [minTop, maxBottom] = [Math.min(minTop, ymin), Math.max(maxBottom, ymax)];

  const [growTop, growBottom] = grow(boxHeight * 0.1, ymin - minTop, maxBottom - ymax);
  const wantedWidth = Math.max(boxWidth * 1.2, boxHeight * 0.75);
  const [growLeft, growRight] = grow(wantedWidth - boxWidth, xmin - minLeft, maxRight - xmax);

  return {
    left: xmin - growLeft,
    top: ymin - growTop,
    width: boxWidth + growLeft + growRight,
    height: boxHeight + growTop + growBottom
  };
}

function clampBox([xmin, ymin, xmax, ymax]: number[], imgWidth: number, imgHeight: number) {
  const x0 = Math.min(Math.max(xmin, 0), imgWidth);
  const y0 = Math.min(Math.max(ymin, 0), imgHeight);
  return [x0, y0, Math.max(Math.min(xmax, imgWidth), x0), Math.max(Math.min(ymax, imgHeight), y0)];
}

/**
 * The line two boxes' areas stay on either side of, across the axis where it
 * costs least. Ranges that overlap partly split halfway through the overlap,
 * costing the overlap; apart ranges split halfway across the gap, a negative
 * cost, so apart boxes split across their widest gap and boxes that share
 * columns split above/below each other. A range spanning the other's (boxes
 * crossing like a plus sign, or one beside the other's middle) gives up the
 * overlap and its smaller leftover end: the line is the spanned box's edge.
 * `before`: `other` lies on the low side (left / above). Symmetric, so both
 * boxes of a pair pick the same line. A box inside the other: null.
 */
function splitLine(
  [xmin, ymin, xmax, ymax]: number[],
  [x0, y0, x1, y1]: number[]
): { axis: 'x' | 'y'; at: number; before: boolean } | null {
  if (
    (x0 <= xmin && y0 <= ymin && x1 >= xmax && y1 >= ymax) ||
    (xmin <= x0 && ymin <= y0 && xmax >= x1 && ymax >= y1)
  ) {
    return null;
  }
  let best: { axis: 'x' | 'y'; cost: number; at: number; before: boolean } | null = null;
  for (const [axis, a0, a1, b0, b1] of [
    ['x', xmin, xmax, x0, x1],
    ['y', ymin, ymax, y0, y1]
  ] as const) {
    // The same range: neither box lies to one side of the other
    if (a0 === b0 && a1 === b1) continue;
    const overlap = Math.min(a1, b1) - Math.max(a0, b0);
    let split: { axis: 'x' | 'y'; cost: number; at: number; before: boolean };
    if (overlap > 0 && b0 <= a0 && b1 >= a1) {
      // `other` spans this box's range and keeps its longer end
      const keepsHigh = b1 - a1 >= a0 - b0;
      split = {
        axis,
        cost: overlap + Math.min(b1 - a1, a0 - b0),
        at: keepsHigh ? a1 : a0,
        before: !keepsHigh
      };
    } else if (overlap > 0 && a0 <= b0 && a1 >= b1) {
      // this box spans `other`'s range and keeps its longer end
      const keepsHigh = a1 - b1 >= b0 - a0;
      split = {
        axis,
        cost: overlap + Math.min(a1 - b1, b0 - a0),
        at: keepsHigh ? b1 : b0,
        before: keepsHigh
      };
    } else {
      const before = b0 + b1 < a0 + a1;
      split = { axis, cost: overlap, at: before ? (a0 + b1) / 2 : (b0 + a1) / 2, before };
    }
    if (!best || split.cost < best.cost) best = split;
  }
  return best;
}

/**
 * Splits `extra` evenly over two sides; what one side has no room for goes to
 * the other. A negative room shrinks that side (a neighbour overlaps it).
 */
function grow(extra: number, roomA: number, roomB: number): [number, number] {
  const a = Math.min(extra / 2, roomA);
  const b = Math.min(extra - a, roomB);
  return [Math.min(extra - b, roomA), b];
}

/** Identifies one block of one page of one volume. */
export function translationBlockKey(volumeUuid: string, imgPath: string, blockIndex: number) {
  return `${volumeUuid}\u0000${imgPath}\u0000${blockIndex}`;
}

/**
 * The language translation mode shows across the volume, null when it is
 * off. Set by the reader, which resolves the remembered language against the
 * languages the volume has; read by every page's text boxes.
 */
export const displayedTranslationLanguage = writable<string | null>(null);

/**
 * Bubbles switched one by one from the context menu: block key → the
 * language that bubble shows, or null for its OCR text. Session-only; the
 * reader clears them whenever the displayed language changes.
 */
export const blockTranslationOverrides = writable<Map<string, string | null>>(new Map());

/**
 * Shows `lang` (null: the OCR text) on one bubble. Choosing what the mode
 * shows anyway drops the override, so the bubble follows the mode again.
 */
export function setBlockTranslation(key: string, lang: string | null, modeLang: string | null) {
  blockTranslationOverrides.update((overrides) => {
    const next = new Map(overrides);
    if (lang === modeLang) next.delete(key);
    else next.set(key, lang);
    return next;
  });
}

export function clearBlockTranslationOverrides() {
  blockTranslationOverrides.update((overrides) => (overrides.size ? new Map() : overrides));
}
