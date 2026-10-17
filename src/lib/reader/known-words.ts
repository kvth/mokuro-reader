import { deinflect } from './deinflect';

/**
 * Finding the words the user has Anki cards for in OCR text. The card list is
 * the dictionary: at every position the longest stretch of text that is, or
 * deinflects to, one of those words is a match (`deinflect.ts`).
 *
 * Inflection only ever changes a word's kana tail, so a match starts with the
 * word's STEM — the word without its trailing hiragana (食べる → 食,
 * 勉強する → 勉強, 高い → 高). Only positions where a stem starts are tried,
 * which keeps a page of text cheap with thousands of cards.
 */

export interface KnownWordIndex {
  terms: Set<string>;
  stems: Set<string>;
  /** Every prefix of every stem: walks stop as soon as no stem can follow */
  stemPrefixes: Set<string>;
}

/** Longest inflected tail a match may carry past its stem (食べさせられなかった). */
const MAX_INFLECTION = 10;
/** A cap on deinflection results kept between pages. */
const CACHE_LIMIT = 20000;

const KANA_ONLY = /^[\u3040-\u30ff\u30fc]+$/;
const TRAILING_HIRAGANA = /[\u3040-\u309f]+$/;

/** The part of a word inflection never touches; all-kana words keep all but their last two. */
export function wordStem(word: string): string {
  const stem = word.replace(TRAILING_HIRAGANA, '');
  return stem || word.slice(0, Math.max(1, word.length - 2));
}

/**
 * Index of the card words worth looking for. A single kana (は, の, い) would
 * light up every bubble, so it is left out.
 */
export function buildKnownWordIndex(words: Iterable<string>): KnownWordIndex {
  const terms = new Set<string>();
  const stems = new Set<string>();
  const stemPrefixes = new Set<string>();
  for (const word of words) {
    const length = [...word].length;
    if (length === 0 || (length === 1 && KANA_ONLY.test(word))) continue;
    terms.add(word);
    const stem = wordStem(word);
    stems.add(stem);
    for (let i = 1; i <= stem.length; i++) stemPrefixes.add(stem.slice(0, i));
  }
  return { terms, stems, stemPrefixes };
}

const deinflected = new Map<string, string[]>();

function deinflectCached(text: string): string[] {
  let forms = deinflected.get(text);
  if (!forms) {
    if (deinflected.size >= CACHE_LIMIT) deinflected.clear();
    forms = deinflect(text);
    deinflected.set(text, forms);
  }
  return forms;
}

/** End of the longest known word starting at `i`, or 0. */
function matchAt(text: string, i: number, index: KnownWordIndex): number {
  let longestStem = 0;
  for (let j = i + 1; j <= text.length; j++) {
    const prefix = text.slice(i, j);
    if (!index.stemPrefixes.has(prefix)) break;
    if (index.stems.has(prefix)) longestStem = j - i;
  }
  if (!longestStem) return 0;
  for (let j = Math.min(text.length, i + longestStem + MAX_INFLECTION); j > i; j--) {
    const candidate = text.slice(i, j);
    if (index.terms.has(candidate)) return j;
    if (j - i >= longestStem && deinflectCached(candidate).some((f) => index.terms.has(f))) {
      return j;
    }
  }
  return 0;
}

/** [start, end) UTF-16 offsets of every known word in `text`, in order, never overlapping. */
export function findKnownWords(text: string, index: KnownWordIndex): [number, number][] {
  const found: [number, number][] = [];
  if (!index.terms.size) return found;
  let i = 0;
  while (i < text.length) {
    const end = matchAt(text, i, index);
    if (end) {
      found.push([i, end]);
      i = end;
    } else {
      i += (text.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
    }
  }
  return found;
}

/**
 * The word an Anki field holds, as the text would show it: no HTML, no
 * furigana brackets (漢字[かんじ]), no spaces.
 */
export function cleanAnkiWord(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, '');
}
