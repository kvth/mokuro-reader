/**
 * Touch long-press on OCR text never starts the browser's word selection.
 *
 * A long press on selectable text makes Android select a word and raise its
 * selection handles and copy bar, which sit on top of (and fight with)
 * Yomitan's panel. Yomitan scans the point under the finger and never needs a
 * selection, so a `selectstart` on a text box while the last press was a
 * touch is cancelled. Mouse and pen keep drag selection (Yomitan/Migaku
 * desktop scanning).
 *
 * Shared by every TextBoxes instance; the listeners are installed once while
 * any instance is mounted (`retainTouchTextPress`).
 */

let lastPointerType: string | null = null;
let holders = 0;

function onPointerDown(event: PointerEvent) {
  if (event.isPrimary) lastPointerType = event.pointerType;
}

function onSelectStart(event: Event) {
  if (lastPointerType !== 'touch') return;
  const target = event.target;
  const element = target instanceof Element ? target : (target as Node | null)?.parentElement;
  if (element?.closest('.textBox')) event.preventDefault();
}

/** Install the shared listeners; returns the release for this holder. */
export function retainTouchTextPress(): () => void {
  if (holders++ === 0) {
    window.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('selectstart', onSelectStart, true);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--holders === 0) {
      window.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('selectstart', onSelectStart, true);
      lastPointerType = null;
    }
  };
}
