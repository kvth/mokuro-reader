/**
 * Touch long-press on OCR text belongs to the reader, not to the browser and
 * not to Yomitan.
 *
 * - **No native selection.** A long press on selectable text makes Android
 *   select a word and raise its selection handles and copy bar, which sit on
 *   top of (and fight with) Yomitan's panel. Yomitan scans the point under
 *   the finger and never needs a selection, so a `selectstart` on a text box
 *   while the last press was a touch is cancelled. Mouse and pen keep drag
 *   selection (Yomitan/Migaku desktop scanning).
 * - **The context menu, not a lookup.** Yomitan's default touch input scans
 *   on a TAP: when the finger lifts without having moved. A long press is
 *   such a tap to it, so the reader's menu (opened by `contextmenu` while the
 *   finger is still down) was followed by a lookup on release. Yomitan voids
 *   the pending tap on ANY `touchmove` reaching its window listener, so the
 *   menu dispatches one (`cancelPendingTap`) — the release then looks nothing
 *   up. Its "scan on touch press" input is out of reach: that one scans on
 *   the press and cancels the `contextmenu` itself.
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

/** Was the press that led here (e.g. to a `contextmenu`) a touch? */
export function isTouchPress(): boolean {
  return lastPointerType === 'touch';
}

/**
 * Void the tap a touch long-press is still holding, so Yomitan does not look
 * the word under the finger up on release.
 */
export function cancelPendingTap(): void {
  window.dispatchEvent(new Event('touchmove'));
}
