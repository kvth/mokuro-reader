import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { get } from 'svelte/store';
import { settings, updateSetting } from '$lib/settings';

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

  beforeEach(() => updateSetting('pinTranslationButton', true));
  afterEach(() => updateSetting('pinTranslationButton', true));

  it('shows the switch above the menu button without opening the menu', async () => {
    const utils = mountWithTranslation(null);
    // Menu closed: no other action is on screen, the switch is
    expect(utils.queryByLabelText('Toggle fullscreen')).toBeNull();
    await fireEvent.click(utils.getByLabelText('Show translation'));
    expect(utils.onToggleTranslation).toHaveBeenCalledOnce();
    // Opening the menu does not add a second copy
    await fireEvent.click(utils.getByLabelText('Quick actions menu'));
    expect(utils.getAllByLabelText('Show translation')).toHaveLength(1);
  });

  it('keeps the switch inside the menu when pinning is off', async () => {
    updateSetting('pinTranslationButton', false);
    const utils = mountWithTranslation(null);
    expect(utils.queryByLabelText('Show translation')).toBeNull();
    await fireEvent.click(utils.getByLabelText('Quick actions menu'));
    expect(utils.getAllByLabelText('Show translation')).toHaveLength(1);
  });

  it('pins nothing for a volume without translations', () => {
    const utils = render(QuickActions, {
      props: { left: vi.fn(), right: vi.fn(), src1: undefined, src2: undefined, volumeUuid: 'v1' }
    });
    expect(utils.queryByLabelText('Show translation')).toBeNull();
  });

  it('cycles the translation from the quick actions menu', async () => {
    updateSetting('pinTranslationButton', false);
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

describe('QuickActions — OCR switch', () => {
  function mountPlain() {
    return render(QuickActions, {
      props: { left: vi.fn(), right: vi.fn(), src1: undefined, src2: undefined, volumeUuid: 'v1' }
    });
  }

  beforeEach(() => {
    updateSetting('pinOcrButton', true);
    updateSetting('alwaysShowOCR', false);
  });
  afterEach(() => {
    updateSetting('pinOcrButton', true);
    updateSetting('alwaysShowOCR', false);
  });

  it('shows the switch above the menu button for any volume', async () => {
    const utils = mountPlain();
    expect(utils.queryByLabelText('Toggle fullscreen')).toBeNull();
    const button = utils.getByLabelText('Always show OCR');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(button);
    expect(get(settings).alwaysShowOCR).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    // Opening the menu does not add a second copy
    await fireEvent.click(utils.getByLabelText('Quick actions menu'));
    expect(utils.getAllByLabelText('Always show OCR')).toHaveLength(1);
  });

  it('keeps the switch inside the menu when pinning is off', async () => {
    updateSetting('pinOcrButton', false);
    const utils = mountPlain();
    expect(utils.queryByLabelText('Always show OCR')).toBeNull();
    await fireEvent.click(utils.getByLabelText('Quick actions menu'));
    await fireEvent.click(utils.getByLabelText('Always show OCR'));
    expect(get(settings).alwaysShowOCR).toBe(true);
  });

  it('sits between the translation switch and the menu button', () => {
    const utils = render(QuickActions, {
      props: {
        left: vi.fn(),
        right: vi.fn(),
        src1: undefined,
        src2: undefined,
        volumeUuid: 'v1',
        translationAvailable: true,
        onToggleTranslation: vi.fn()
      }
    });
    const order = [
      utils.getByLabelText('Show translation'),
      utils.getByLabelText('Always show OCR'),
      utils.getByLabelText('Quick actions menu')
    ];
    for (let i = 1; i < order.length; i++) {
      expect(
        order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  });
});
