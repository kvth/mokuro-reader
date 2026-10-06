import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import type { Block, Page } from '$lib/types';
import {
  getBlockTranslation,
  pagesHaveTranslation,
  translationBox,
  translationBlockKey,
  switchedTranslationBlocks,
  toggleBlockTranslation,
  clearSwitchedTranslationBlocks
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

describe('pagesHaveTranslation', () => {
  it('finds a translation in any page', () => {
    const pages = [page([block()]), undefined, page([block(), block({ de: 'Ja.' })])];
    expect(pagesHaveTranslation(pages, 'de')).toBe(true);
    expect(pagesHaveTranslation(pages, 'en')).toBe(false);
    expect(pagesHaveTranslation([], 'en')).toBe(false);
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
});

describe('switched blocks', () => {
  it('toggles and clears single bubbles', () => {
    const a = translationBlockKey('vol', '001.jpg', 0);
    const b = translationBlockKey('vol', '001.jpg', 1);
    expect(a).not.toBe(b);

    toggleBlockTranslation(a);
    toggleBlockTranslation(b);
    toggleBlockTranslation(b);
    expect([...get(switchedTranslationBlocks)]).toEqual([a]);

    clearSwitchedTranslationBlocks();
    expect(get(switchedTranslationBlocks).size).toBe(0);
  });
});
