import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { retainTouchTextPress } from './touch-text-press';

/** Build a pointer-event-shaped Event (jsdom has no PointerEvent ctor). */
function pointerDown(pointerType: string, isPrimary = true): Event {
  const event = new Event('pointerdown', { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerType: { value: pointerType },
    isPrimary: { value: isPrimary }
  });
  return event;
}

function selectStart(target: Node): Event {
  const event = new Event('selectstart', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe('touch-text-press', () => {
  let release: () => void;
  let textBox: HTMLElement;
  let line: Text;
  let outside: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML =
      '<div class="textBox"><p><span class="ocr-line">日本語</span></p></div><div id="outside">x</div>';
    textBox = document.querySelector('.textBox')!;
    line = textBox.querySelector('.ocr-line')!.firstChild as Text;
    outside = document.getElementById('outside')!;
    release = retainTouchTextPress();
  });

  afterEach(() => {
    release();
    document.body.innerHTML = '';
  });

  it('cancels a selection started by a touch press on a text box', () => {
    textBox.dispatchEvent(pointerDown('touch'));
    expect(selectStart(line).defaultPrevented).toBe(true);
  });

  it('keeps mouse and pen selection, and touch selection outside text boxes', () => {
    textBox.dispatchEvent(pointerDown('mouse'));
    expect(selectStart(line).defaultPrevented).toBe(false);
    textBox.dispatchEvent(pointerDown('pen'));
    expect(selectStart(line).defaultPrevented).toBe(false);
    outside.dispatchEvent(pointerDown('touch'));
    expect(selectStart(outside.firstChild!).defaultPrevented).toBe(false);
  });

  it("ignores a pinch's second finger", () => {
    textBox.dispatchEvent(pointerDown('mouse'));
    textBox.dispatchEvent(pointerDown('touch', false));
    expect(selectStart(line).defaultPrevented).toBe(false);
  });

  it('removes its listeners when the last holder releases', () => {
    const second = retainTouchTextPress();
    release();
    textBox.dispatchEvent(pointerDown('touch'));
    expect(selectStart(line).defaultPrevented).toBe(true);
    second();
    release = () => {};
    textBox.dispatchEvent(pointerDown('touch'));
    expect(selectStart(line).defaultPrevented).toBe(false);
  });
});
