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
import { clamp } from '$lib/util/misc';
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
