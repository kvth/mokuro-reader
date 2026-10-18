import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { get } from 'svelte/store';
import { settings } from '$lib/settings';

vi.mock('$lib/catalog/db', () => ({ db: {} }));

import QuickActions from '../QuickActions.svelte';

afterEach(cleanup);

const layers = [
  { layer_id: 'english', name: 'English', kind: 'translation' as const, updated_at: 'x' }
];

/** Mounts QuickActions with `layersOpen` bound to a parent-owned `$state`, as Reader does. */
function mount() {
  const parent = $state({ layersOpen: false, visible: true });
  const utils = render(QuickActions, {
    props: {
      left: vi.fn(),
      right: vi.fn(),
      src1: undefined,
      src2: undefined,
      volumeUuid: 'v1',
      layers,
      onSelectLayer: vi.fn(),
      onLayerAction: vi.fn(),
      get visible() {
        return parent.visible;
      },
      get layersOpen() {
        return parent.layersOpen;
      },
      set layersOpen(v: boolean) {
        parent.layersOpen = v;
      }
    }
  });
  return { parent, ...utils };
}

async function openPicker(utils: ReturnType<typeof mount>) {
  await fireEvent.click(utils.getByLabelText('Quick actions menu'));
  await fireEvent.click(utils.getByLabelText('OCR layers'));
  expect(utils.parent.layersOpen).toBe(true);
}

describe('QuickActions — layer picker open state', () => {
  it('publishes the picker open state to the parent, which can close it (Escape path)', async () => {
    const utils = mount();
    await openPicker(utils);
    expect(utils.queryByRole('dialog', { name: 'OCR layers' })).not.toBeNull();

    utils.parent.layersOpen = false;
    flushSync();
    expect(utils.queryByRole('dialog', { name: 'OCR layers' })).toBeNull();
  });

  it('reports closed once the picker is no longer rendered (overlays hidden)', async () => {
    // Otherwise the reader would keep swallowing its shortcuts for a picker
    // nobody can see.
    const utils = mount();
    await openPicker(utils);
    utils.parent.visible = false;
    flushSync();
    expect(utils.parent.layersOpen).toBe(false);
  });

  it('reports closed when it unmounts with the picker open (volume switch)', async () => {
    const utils = mount();
    await openPicker(utils);
    utils.unmount();
    expect(utils.parent.layersOpen).toBe(false);
  });
});

describe('QuickActions — translation switch', () => {
  function mountWithTranslation(translationLanguage: string | null) {
    const onToggleTranslation = vi.fn();
    const utils = render(QuickActions, {
      props: {
        left: vi.fn(),
        right: vi.fn(),
        src1: undefined,
        src2: undefined,
        volumeUuid: 'v1',
        translationAvailable: true,
        translationLanguage,
        onToggleTranslation
      }
    });
    return { onToggleTranslation, ...utils };
  }

  it('cycles the translation from the quick actions menu', async () => {
    const utils = mountWithTranslation(null);
    await fireEvent.click(utils.getByLabelText('Quick actions menu'));
    await fireEvent.click(utils.getByLabelText('Show translation'));
    expect(utils.onToggleTranslation).toHaveBeenCalledOnce();
  });

  it("shows the active language's code", async () => {
    const utils = mountWithTranslation('en');
    await fireEvent.click(utils.getByLabelText('Quick actions menu'));
    const button = utils.getByLabelText('Translation: EN');
    // Generated content, not a text node Yomitan would scan
    expect(button.textContent?.trim()).toBe('');
    expect(button.querySelector('[data-lang]')?.getAttribute('data-lang')).toBe('EN');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('toggles the room to tap translated bubbles', async () => {
    const utils = mountWithTranslation(null);
    await fireEvent.click(utils.getByLabelText('Quick actions menu'));
    const button = utils.getByLabelText('Room to tap translated bubbles');
    const before = get(settings).bubbleTapRoom;
    expect(button.getAttribute('aria-pressed')).toBe(String(before));
    await fireEvent.click(button);
    expect(get(settings).bubbleTapRoom).toBe(!before);
    expect(button.getAttribute('aria-pressed')).toBe(String(!before));
    await fireEvent.click(button);
    expect(get(settings).bubbleTapRoom).toBe(before);
  });
});
