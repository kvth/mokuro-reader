import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import type { Block, Page } from '$lib/types';
import {
  getBlockTranslation,
  blockTranslationLanguages,
  volumeTranslationLanguages,
  matchTranslationLanguage,
  translationBox,
  translationBlockKey,
  blockTranslationOverrides,
  setBlockTranslation,
  clearBlockTranslationOverrides
} from './translation';

function block(translations?: Record<string, unknown>): Block {
  return {
    box: [0, 0, 10, 10],
    vertical: true,
    font_size: 10,
    lines: ['はい'],
    translations: translations as Record<string, string>
  };
}

function page(blocks: Block[]): Page {
  return { version: '0.2.5', img_width: 100, img_height: 100, blocks, img_path: '001.jpg' };
}

describe('getBlockTranslation', () => {
  it('returns the exact language, case-insensitively', () => {
    const b = block({ en: 'Yes.', de: 'Ja.' });
    expect(getBlockTranslation(b, 'de')).toBe('Ja.');
    expect(getBlockTranslation(b, ' EN ')).toBe('Yes.');
  });

  it('falls back to the same primary language', () => {
    expect(getBlockTranslation(block({ 'en-gb': 'Yes.' }), 'en')).toBe('Yes.');
    expect(getBlockTranslation(block({ en: 'Yes.' }), 'en-US')).toBe('Yes.');
    expect(getBlockTranslation(block({ 'en-gb': 'Yes.' }), 'de')).toBeUndefined();
  });

  it('ignores blocks without usable translations', () => {
    expect(getBlockTranslation(block(), 'en')).toBeUndefined();
    expect(getBlockTranslation(block({ en: '  ' }), 'en')).toBeUndefined();
    expect(getBlockTranslation(block({ en: 42 }), 'en')).toBeUndefined();
    expect(getBlockTranslation(block('en' as unknown as Record<string, unknown>), 'en')).toBe(
      undefined
    );
  });
});

describe('translation languages', () => {
  it("lists a block's languages with usable text, normalized and sorted", () => {
    expect(blockTranslationLanguages(block({ en: 'Yes.', DE: 'Ja.', fr: ' ' }))).toEqual([
      'de',
      'en'
    ]);
    expect(blockTranslationLanguages(block())).toEqual([]);
  });

  it('collects the languages of every page', () => {
    const pages = [page([block({ en: 'Yes.' })]), undefined, page([block(), block({ de: 'Ja.' })])];
    expect(volumeTranslationLanguages(pages)).toEqual(['de', 'en']);
    expect(volumeTranslationLanguages([])).toEqual([]);
  });

  it("matches a remembered language to the volume's languages", () => {
    expect(matchTranslationLanguage('DE', ['de', 'en'])).toBe('de');
    expect(matchTranslationLanguage('en', ['de', 'en-gb'])).toBe('en-gb');
    expect(matchTranslationLanguage('fr', ['de', 'en'])).toBeNull();
  });
});

describe('translationBox', () => {
  it('widens a narrow vertical box around its centre', () => {
    // 20 wide, 100 tall, centred at (50, 100)
    const box = translationBox([40, 50, 60, 150], 1000, 1000);
    expect(box.width).toBe(75);
    expect(box.height).toBeCloseTo(110);
    expect(box.left).toBeCloseTo(12.5);
    expect(box.top).toBeCloseTo(45);
  });

  it('pads a wide box by 10% on each side', () => {
    const box = translationBox([100, 100, 300, 140], 1000, 1000);
    expect(box.width).toBeCloseTo(240);
    expect(box.left).toBeCloseTo(80);
  });

  it('stays on the page', () => {
    const box = translationBox([0, 0, 10, 100], 50, 105);
    expect(box.left).toBe(0);
    expect(box.top).toBe(0);
    expect(box.left + box.width).toBeLessThanOrEqual(50);
    expect(box.top + box.height).toBeLessThanOrEqual(105);
  });

  const overlaps = (
    a: { left: number; top: number; width: number; height: number },
    [x0, y0, x1, y1]: number[]
  ) => a.left < x1 && a.left + a.width > x0 && a.top < y1 && a.top + a.height > y0;

  it('stops halfway to a neighbour and grows away from it instead', () => {
    // wants 75 wide (55 extra); a neighbour 10 px to the left leaves 5 there
    const neighbour = [20, 60, 30, 140];
    const box = translationBox([40, 50, 60, 150], 1000, 1000, [neighbour]);
    expect(box.left).toBeCloseTo(35);
    expect(box.width).toBeCloseTo(75);
    expect(overlaps(box, neighbour)).toBe(false);
  });

  it('shrinks between close neighbours, and two neighbours never share the gap', () => {
    const a = [40, 50, 60, 150];
    const left = [20, 50, 30, 150];
    const right = [70, 50, 90, 150];
    const box = translationBox(a, 1000, 1000, [left, right]);
    expect(box.left).toBeCloseTo(35);
    expect(box.width).toBeCloseTo(30);
    const fromRight = translationBox(right, 1000, 1000, [left, a]);
    expect(fromRight.left).toBeGreaterThanOrEqual(box.left + box.width);
  });

  it('grows less in height towards a box in its columns', () => {
    const above = [40, 0, 60, 48];
    const box = translationBox([40, 50, 60, 150], 1000, 1000, [above]);
    expect(box.top).toBeCloseTo(49);
    expect(box.top + box.height).toBeCloseTo(159);
    expect(overlaps(box, above)).toBe(false);
  });

  it('ignores boxes outside its band and boxes it already overlaps', () => {
    const far = [0, 400, 30, 500];
    const overlapping = [55, 60, 80, 90];
    const box = translationBox([40, 50, 60, 150], 1000, 1000, [far, overlapping]);
    expect(box).toEqual(translationBox([40, 50, 60, 150], 1000, 1000));
  });
});

describe('single-bubble overrides', () => {
  it('sets a language or the OCR text per bubble, dropping what the mode shows anyway', () => {
    const a = translationBlockKey('vol', '001.jpg', 0);
    const b = translationBlockKey('vol', '001.jpg', 1);
    expect(a).not.toBe(b);

    setBlockTranslation(a, 'de', 'en');
    setBlockTranslation(b, null, 'en');
    expect([...get(blockTranslationOverrides)]).toEqual([
      [a, 'de'],
      [b, null]
    ]);

    setBlockTranslation(a, 'en', 'en');
    expect(get(blockTranslationOverrides).has(a)).toBe(false);

    clearBlockTranslationOverrides();
    expect(get(blockTranslationOverrides).size).toBe(0);
  });
});
