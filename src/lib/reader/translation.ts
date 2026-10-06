/**
 * Speech-bubble translations added by mokuro-translate.
 *
 * A block may carry `translations: { [lang]: text }`, an optional extension
 * key the upstream reader ignores and this one stores and exports verbatim
 * with the rest of the block. The overlay shows a block's translation in
 * place of its OCR text when translation mode is on (`showTranslation`
 * setting, R key), or when that one bubble was switched from the text box
 * context menu.
 */
import { writable } from 'svelte/store';
import { clamp } from '$lib/util/misc';
import type { Block, Page } from '$lib/types';

export function normalizeLanguage(lang: string): string {
  return lang.trim().toLowerCase();
}

/**
 * The block's translation to `lang`: an exact key first, then any key with
 * the same primary language (`en` finds `en-gb` and the other way round).
 */
export function getBlockTranslation(block: Block, lang: string): string | undefined {
  const translations = block.translations;
  if (!translations || typeof translations !== 'object') return undefined;

  const wanted = normalizeLanguage(lang);
  const primary = wanted.split('-')[0];
  const usable = (text: unknown): text is string => typeof text === 'string' && text.trim() !== '';

  if (usable(translations[wanted])) return translations[wanted];
  for (const [key, text] of Object.entries(translations)) {
    if (normalizeLanguage(key).split('-')[0] === primary && usable(text)) return text;
  }
  return undefined;
}

export function pagesHaveTranslation(pages: (Page | undefined)[], lang: string): boolean {
  return pages.some((page) =>
    page?.blocks?.some((block) => getBlockTranslation(block, lang) !== undefined)
  );
}

/**
 * The area a translation is fitted into, in image px. A Japanese text box
 * hugs its (often narrow, vertical) columns, while horizontal translated text
 * needs a wider area, so the box grows around its centre: 10% on each side,
 * and at least 3/4 of its height wide. It stays on the page.
 */
export function translationBox(
  [xmin, ymin, xmax, ymax]: number[],
  imgWidth: number,
  imgHeight: number
): { left: number; top: number; width: number; height: number } {
  const boxWidth = xmax - xmin;
  const boxHeight = ymax - ymin;
  const width = Math.min(Math.max(boxWidth * 1.2, boxHeight * 0.75), imgWidth);
  const height = Math.min(boxHeight * 1.1, imgHeight);
  const left = clamp((xmin + xmax) / 2 - width / 2, 0, imgWidth - width);
  const top = clamp((ymin + ymax) / 2 - height / 2, 0, imgHeight - height);
  return { left, top, width, height };
}

/** Identifies one block of one page of one volume. */
export function translationBlockKey(volumeUuid: string, imgPath: string, blockIndex: number) {
  return `${volumeUuid}\u0000${imgPath}\u0000${blockIndex}`;
}

/**
 * Bubbles switched one by one from the context menu: each shows the opposite
 * of the translation mode. Session-only; the reader clears them whenever the
 * mode or the translation language changes.
 */
export const switchedTranslationBlocks = writable<Set<string>>(new Set());

export function toggleBlockTranslation(key: string) {
  switchedTranslationBlocks.update((keys) => {
    const next = new Set(keys);
    if (!next.delete(key)) next.add(key);
    return next;
  });
}

export function clearSwitchedTranslationBlocks() {
  switchedTranslationBlocks.update((keys) => (keys.size ? new Set() : keys));
}
