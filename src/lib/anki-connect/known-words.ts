import { derived, get, writable } from 'svelte/store';
import { settings } from '$lib/settings';
import { buildKnownWordIndex, cleanAnkiWord, type KnownWordIndex } from '$lib/reader/known-words';

/**
 * The words of the user's Anki cards, read from AnkiConnect for the reader to
 * colour (`markKnownWords`). Read-only: cards keep being made wherever the
 * user makes them (Yomitan). Works without the reader's own AnkiConnect card
 * features being connected — it only needs the URL.
 *
 * Every request is quiet: a reader page must never raise a snackbar or a
 * permission prompt because Anki is closed. The last list is cached in
 * localStorage, so words stay coloured while Anki is unreachable.
 *
 * A refresh asks `findNotes` for the deck's note ids and `notesInfo` only for
 * ids it has not seen (both supported by AnkiConnect Android), so the check
 * a page turn runs is one cheap call.
 */

/** Field names a Yomitan / mining note keeps its word in, by preference. */
const WORD_FIELDS = ['Expression', 'Word', 'Term', 'Vocab', 'Vocabulary', 'Kanji', 'Front'];
const CACHE_KEY = 'anki-known-words';
const NOTES_INFO_BATCH = 100;
/** A page turn re-checks the deck at most this often. */
const REFRESH_INTERVAL_MS = 60_000;

interface Cache {
  /** url | deck | field — a change of any of them starts over */
  source: string;
  /** note id → its word ('' when the note has no usable word) */
  notes: Record<string, string>;
}

export type KnownWordsStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; words: number; notes: number; at: number }
  | { state: 'error'; message: string };

const notesStore = writable<Record<string, string>>(readCache()?.notes ?? {});
export const knownWordsStatus = writable<KnownWordsStatus>({ state: 'idle' });

/** The index every page's text boxes match against — built once per word list. */
export const knownWordIndex = derived(
  notesStore,
  (notes): KnownWordIndex => buildKnownWordIndex(Object.values(notes))
);

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

function writeCache(cache: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // quota / private mode: the list just is not kept across sessions
  }
}

function currentSource() {
  const { url, knownWordsDeck, knownWordsField } = get(settings).ankiConnectSettings;
  return {
    url: url || 'http://127.0.0.1:8765',
    deck: knownWordsDeck.trim(),
    field: knownWordsField.trim()
  };
}

async function request<T>(
  url: string,
  action: string,
  params: Record<string, unknown>
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action, params, version: 6 })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result as T;
}

/** Anki search for every note of the deck (and its subdecks). */
export function deckQuery(deck: string): string {
  const escaped = deck.replace(/"/g, '\\"');
  return /\s/.test(deck) ? `"deck:${escaped}"` : `deck:${escaped}`;
}

interface NoteInfo {
  noteId: number;
  fields: Record<string, { value: string; order: number }>;
}

/** The note's word: the configured field, else the first familiar one, else its first field. */
export function noteWord(note: NoteInfo, field: string): string {
  const fields = note.fields ?? {};
  let value: string | undefined;
  if (field) {
    value = fields[field]?.value;
  } else {
    const name = WORD_FIELDS.find((f) => f in fields);
    value = name
      ? fields[name].value
      : Object.values(fields).sort((a, b) => a.order - b.order)[0]?.value;
  }
  return value ? cleanAnkiWord(value) : '';
}

let running: Promise<void> | null = null;
let lastRefresh = 0;

/**
 * Bring the word list up to date with the deck. Without `force`, does
 * nothing when the last check was under a minute ago (page turns call this).
 */
export function refreshKnownWords(options: { force?: boolean } = {}): Promise<void> {
  if (running) return running;
  if (!options.force && Date.now() - lastRefresh < REFRESH_INTERVAL_MS) return Promise.resolve();
  lastRefresh = Date.now();
  running = refresh().finally(() => {
    running = null;
  });
  return running;
}

async function refresh() {
  const { url, deck, field } = currentSource();
  if (!deck) {
    knownWordsStatus.set({ state: 'error', message: 'No deck set' });
    return;
  }
  const source = `${url}|${deck}|${field}`;
  const cached = readCache();
  const known = cached?.source === source ? { ...cached.notes } : {};
  if (get(knownWordsStatus).state !== 'ready') knownWordsStatus.set({ state: 'loading' });
  try {
    const ids = await request<number[]>(url, 'findNotes', { query: deckQuery(deck) });
    const current = new Set(ids.map(String));
    const notes: Record<string, string> = {};
    for (const id of current) if (id in known) notes[id] = known[id];
    const missing = ids.filter((id) => !(String(id) in notes));
    for (let i = 0; i < missing.length; i += NOTES_INFO_BATCH) {
      const infos = await request<NoteInfo[]>(url, 'notesInfo', {
        notes: missing.slice(i, i + NOTES_INFO_BATCH)
      });
      for (const info of infos) {
        if (info?.noteId !== undefined) notes[String(info.noteId)] = noteWord(info, field);
      }
    }
    writeCache({ source, notes });
    notesStore.set(notes);
    knownWordsStatus.set({
      state: 'ready',
      words: new Set(Object.values(notes).filter(Boolean)).size,
      notes: ids.length,
      at: Date.now()
    });
  } catch (e) {
    console.debug('[known-words] refresh failed', e);
    knownWordsStatus.set({
      state: 'error',
      message:
        e instanceof TypeError ? 'Cannot reach AnkiConnect' : String((e as Error).message ?? e)
    });
  }
}
