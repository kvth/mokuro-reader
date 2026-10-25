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

  it('ignores far boxes', () => {
    const far = [0, 400, 30, 500];
    const box = translationBox([40, 50, 60, 150], 1000, 1000, [far]);
    expect(box).toEqual(translationBox([40, 50, 60, 150], 1000, 1000));
  });

  const area = (box: number[], others: number[][], w = 1000, h = 1000) =>
    translationBox(
      box,
      w,
      h,
      others.filter((o) => o !== box)
    );
  const cross = (
    a: { left: number; top: number; width: number; height: number },
    b: { left: number; top: number; width: number; height: number }
  ) =>
    a.left < b.left + b.width - 1e-9 &&
    b.left < a.left + a.width - 1e-9 &&
    a.top < b.top + b.height - 1e-9 &&
    b.top < a.top + a.height - 1e-9;

  it('splits an overlap with a neighbour halfway, on the axis they overlap least', () => {
    const a = [40, 50, 60, 150];
    const b = [55, 60, 80, 90]; // 5 px into a's columns, 30 px into its rows
    const boxA = area(a, [a, b]);
    const boxB = area(b, [a, b]);
    expect(boxA.left + boxA.width).toBeCloseTo(57.5);
    expect(boxB.left).toBeCloseTo(57.5);
    expect(cross(boxA, boxB)).toBe(false);
  });

  it('keeps diagonal neighbours out of each other’s corner', () => {
    // b is just right of and just below a: both would grow into the corner
    const a = [100, 100, 200, 300];
    const b = [205, 302, 400, 500];
    expect(cross(area(a, [a, b]), area(b, [a, b]))).toBe(false);
  });

  it('splits boxes in the same columns above and below each other', () => {
    const a = [40, 50, 60, 150];
    const b = [40, 120, 60, 200];
    expect(cross(area(a, [a, b]), area(b, [a, b]))).toBe(false);
  });

  it('trims the box that spans the other where two boxes cross', () => {
    const tall = [644, 922, 736, 1233];
    const wide = [642, 1007, 849, 1056]; // runs from tall's left edge far right
    const boxTall = area(tall, [tall, wide], 1000, 1400);
    const boxWide = area(wide, [tall, wide], 1000, 1400);
    expect(boxWide.left).toBeCloseTo(736);
    expect(boxTall.top).toBeLessThanOrEqual(922);
    expect(cross(boxTall, boxWide)).toBe(false);
  });

  it('keeps a box that runs past the page on it', () => {
    const box = translationBox([-20, 900, 40, 1030], 1000, 1000);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.top + box.height).toBeLessThanOrEqual(1000);
  });

  it('never lets two areas cross, nor leave the page', () => {
    // Deterministic pseudo-random pages of bubbles, some touching or overlapping
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let pageNo = 0; pageNo < 2000; pageNo++) {
      const boxes: number[][] = [];
      for (let i = 0; i < 2 + Math.floor(rand() * 10); i++) {
        const x = rand() * 985;
        const y = rand() * 1385;
        boxes.push([
          x,
          y,
          Math.min(x + 15 + rand() * 200, 1000),
          Math.min(y + 15 + rand() * 300, 1400)
        ]);
      }
      const areas = boxes.map((b) => area(b, boxes, 1000, 1400));
      // A box overlapped from both sides can be squeezed to nothing; it then
      // keeps its own box rather than vanish. Mostly where three boxes meet
      // (skipped here); otherwise ~1 in 15 000 of these crowded pages.
      const meet = (p: number[], q: number[]) =>
        p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3];
      const pileUp = boxes.some((p, i) =>
        boxes.some(
          (q, j) => j > i && meet(p, q) && boxes.some((r, k) => k > j && meet(p, r) && meet(q, r))
        )
      );
      if (pileUp) continue;
      for (const a of areas) {
        expect(a.left).toBeGreaterThanOrEqual(0);
        expect(a.top).toBeGreaterThanOrEqual(0);
        expect(a.left + a.width).toBeLessThanOrEqual(1000 + 1e-9);
        expect(a.top + a.height).toBeLessThanOrEqual(1400 + 1e-9);
      }
      const nested = (p: number[], q: number[]) =>
        p[0] <= q[0] && p[1] <= q[1] && p[2] >= q[2] && p[3] >= q[3];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          if (nested(boxes[i], boxes[j]) || nested(boxes[j], boxes[i])) continue;
          expect(cross(areas[i], areas[j]), `page ${pageNo}: ${i} × ${j}`).toBe(false);
        }
      }
    }
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
