import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { updateAnkiSetting } from '$lib/settings';
import {
  deckQuery,
  knownWordIndex,
  knownWordsStatus,
  noteWord,
  refreshKnownWords
} from './known-words';

const note = (noteId: number, fields: Record<string, string>) => ({
  noteId,
  fields: Object.fromEntries(
    Object.entries(fields).map(([name, value], order) => [name, { value, order }])
  )
});

describe('noteWord', () => {
  it('takes the configured field', () => {
    expect(noteWord(note(1, { Front: 'x', Vocab: '食べる' }), 'Vocab')).toBe('食べる');
  });

  it('detects a familiar word field, else the first field', () => {
    expect(noteWord(note(1, { Sentence: '…', Expression: '<b>学校</b>' }), '')).toBe('学校');
    expect(noteWord(note(1, { Mine: '漢字[かんじ]', Other: 'x' }), '')).toBe('漢字');
  });
});

describe('deckQuery', () => {
  it('quotes only a deck name with spaces', () => {
    expect(deckQuery('yomitan')).toBe('deck:yomitan');
    expect(deckQuery('My Mining')).toBe('"deck:My Mining"');
  });
});

describe('refreshKnownWords', () => {
  let calls: { action: string; params: Record<string, unknown> }[];
  let notes: ReturnType<typeof note>[];

  beforeEach(() => {
    localStorage.clear();
    calls = [];
    notes = [note(1, { Expression: '食べる' }), note(2, { Expression: '学校' })];
    updateAnkiSetting('knownWordsDeck', 'yomitan');
    updateAnkiSetting('knownWordsField', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const { action, params } = JSON.parse(init.body);
        calls.push({ action, params });
        const result =
          action === 'findNotes'
            ? notes.map((n) => n.noteId)
            : notes.filter((n) => (params.notes as number[]).includes(n.noteId));
        return { json: async () => ({ result, error: null }) };
      })
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reads the deck once, then only notes it has not seen', async () => {
    await refreshKnownWords({ force: true });
    expect(calls.map((c) => c.action)).toEqual(['findNotes', 'notesInfo']);
    expect(calls[0].params).toEqual({ query: 'deck:yomitan' });
    expect([...get(knownWordIndex).terms].sort()).toEqual(['学校', '食べる']);
    expect(get(knownWordsStatus)).toMatchObject({ state: 'ready', words: 2, notes: 2 });

    calls = [];
    notes.push(note(3, { Expression: '高い' }));
    await refreshKnownWords({ force: true });
    expect(calls[1]).toEqual({ action: 'notesInfo', params: { notes: [3] } });
    expect(get(knownWordIndex).terms.has('高い')).toBe(true);

    // a deleted note's word goes
    notes = notes.filter((n) => n.noteId !== 2);
    await refreshKnownWords({ force: true });
    expect(get(knownWordIndex).terms.has('学校')).toBe(false);
  });

  it('skips a page-turn refresh within a minute', async () => {
    await refreshKnownWords({ force: true });
    calls = [];
    await refreshKnownWords();
    expect(calls).toEqual([]);
  });

  it('keeps the last list and reports when Anki cannot be reached', async () => {
    await refreshKnownWords({ force: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );
    await refreshKnownWords({ force: true });
    expect(get(knownWordsStatus)).toEqual({ state: 'error', message: 'Cannot reach AnkiConnect' });
    expect(get(knownWordIndex).terms.has('食べる')).toBe(true);
  });
});
