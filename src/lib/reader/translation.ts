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
 * It grows only into free space. `others` are the page's other text boxes;
 * towards each one the box stops halfway across the gap, so it never covers a
 * neighbour's text and two translations never claim the same gap, whichever
 * bubbles show one. Room one side lacks (a neighbour, the page edge) goes to
 * the other side. Height grows first, beside boxes that share its columns;
 * width then grows beside every box in that taller band. A box already
 * overlapping this one cannot be avoided and is ignored.
 */
export function translationBox(
  [xmin, ymin, xmax, ymax]: number[],
  imgWidth: number,
  imgHeight: number,
  others: number[][] = []
): { left: number; top: number; width: number; height: number } {
  const boxWidth = xmax - xmin;
  const boxHeight = ymax - ymin;
  const neighbours = others.filter(
    ([x0, y0, x1, y1]) => !(x0 < xmax && x1 > xmin && y0 < ymax && y1 > ymin)
  );

  // Vertical: neighbours above/below that share the box's columns
  let roomTop = ymin;
  let roomBottom = imgHeight - ymax;
  for (const [x0, y0, x1, y1] of neighbours) {
    if (!(x0 < xmax && x1 > xmin)) continue;
    if (y1 <= ymin) roomTop = Math.min(roomTop, (ymin - y1) / 2);
    else if (y0 >= ymax) roomBottom = Math.min(roomBottom, (y0 - ymax) / 2);
  }
  const [growTop, growBottom] = grow(boxHeight * 0.1, roomTop, roomBottom);
  const top = ymin - growTop;
  const bottom = ymax + growBottom;

  // Horizontal: neighbours left/right anywhere in the grown band
  let roomLeft = xmin;
  let roomRight = imgWidth - xmax;
  for (const [x0, y0, x1, y1] of neighbours) {
    if (!(y0 < bottom && y1 > top)) continue;
    if (x1 <= xmin) roomLeft = Math.min(roomLeft, (xmin - x1) / 2);
    else if (x0 >= xmax) roomRight = Math.min(roomRight, (x0 - xmax) / 2);
  }
  const wantedWidth = Math.max(boxWidth * 1.2, boxHeight * 0.75);
  const [growLeft, growRight] = grow(wantedWidth - boxWidth, roomLeft, roomRight);

  return {
    left: xmin - growLeft,
    top,
    width: boxWidth + growLeft + growRight,
    height: bottom - top
  };
}

/** Splits `extra` evenly over two sides; what one side has no room for goes to the other. */
function grow(extra: number, roomA: number, roomB: number): [number, number] {
  if (extra <= 0) return [0, 0];
  const a = Math.min(extra / 2, Math.max(roomA, 0));
  const b = Math.min(extra - a, Math.max(roomB, 0));
  return [Math.min(extra - b, Math.max(roomA, 0)), b];
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
