import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isPointOnText } from './text-hit';

/**
 * jsdom has no layout: lay every character of the box out on one row, 10 px
 * per character (UTF-16 offset × 10), 20 px tall.
 */
function fakeLayout() {
  const original = Range.prototype.getClientRects;
  Range.prototype.getClientRects = function (this: Range) {
    const node = this.startContainer;
    const before = textBefore(node) + this.startOffset;
    const width = (this.endOffset - this.startOffset) * 10;
    return [new DOMRect(before * 10, 0, width, 20)] as unknown as DOMRectList;
  };
  return () => {
    Range.prototype.getClientRects = original;
  };
}

/** Length of the box's text before `node` (all text nodes, document order). */
function textBefore(node: Node): number {
  let count = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n && n !== node; n = walker.nextNode()) {
    count += n.textContent?.length ?? 0;
  }
  return count;
}

describe('isPointOnText', () => {
  let restore: () => void;
  let box: HTMLElement;

  beforeEach(() => {
    restore = fakeLayout();
    // "日本 語" — characters at x 0–10, 10–20, a space at 20–30, 30–40
    document.body.innerHTML = '<div class="textBox"><p><span>日本</span><span> 語</span></p></div>';
    box = document.querySelector('.textBox')!;
  });

  afterEach(() => {
    restore();
    document.body.innerHTML = '';
  });

  it('is true over a character, in any of the text nodes', () => {
    expect(isPointOnText(box, 5, 10)).toBe(true);
    expect(isPointOnText(box, 35, 10)).toBe(true);
  });

  it('is false over whitespace and past the text', () => {
    expect(isPointOnText(box, 25, 10)).toBe(false);
    expect(isPointOnText(box, 45, 10)).toBe(false);
    expect(isPointOnText(box, 5, 30)).toBe(false);
  });

  it('takes a surrogate pair as one character', () => {
    document.body.innerHTML = '<div class="textBox"><p>𠮟る</p></div>';
    box = document.querySelector('.textBox')!;
    // 𠮟 spans offsets 0–2 → x 0–20; る at 20–30
    expect(isPointOnText(box, 15, 10)).toBe(true);
    expect(isPointOnText(box, 25, 10)).toBe(true);
    expect(isPointOnText(box, 35, 10)).toBe(false);
  });
});
