/**
 * Japanese deinflection without a dictionary: every dictionary form a
 * surface string could be an inflection of (食べさせられなかった → 食べる).
 *
 * Used to find words the user has Anki cards for in OCR text
 * (`known-words.ts`): a candidate counts only when it IS one of those words,
 * so overgeneration is harmless — the card list is the dictionary.
 *
 * Rules strip a suffix and name the class of what is left, and chain the way
 * Yomitan's transforms do: a rule applies when the current form's class is
 * one it accepts. `SURFACE` is the text as written; intermediate classes
 * (te-form, past, masu, the bare stem) are never results themselves.
 */

const SURFACE = 1;
const V1 = 2; // ichidan
const V5 = 4; // godan
const VS = 8; // する
const VK = 16; // 来る
const ADJ = 32; // い-adjective (and ない / たい, which conjugate like one)
const TE = 64;
const TA = 128;
const MASU = 256;
const STEM = 512;

/** Classes a dictionary form can have. */
const RESULT = SURFACE | V1 | V5 | VS | VK | ADJ;

type Rule = readonly [suffixIn: string, suffixOut: string, from: number, to: number];

/** Godan endings: dictionary u-row kana → [a, i, e, o, te, ta]. */
const GODAN: readonly [string, string, string, string, string, string, string][] = [
  ['く', 'か', 'き', 'け', 'こ', 'いて', 'いた'],
  ['ぐ', 'が', 'ぎ', 'げ', 'ご', 'いで', 'いだ'],
  ['す', 'さ', 'し', 'せ', 'そ', 'して', 'した'],
  ['つ', 'た', 'ち', 'て', 'と', 'って', 'った'],
  ['ぬ', 'な', 'に', 'ね', 'の', 'んで', 'んだ'],
  ['ぶ', 'ば', 'び', 'べ', 'ぼ', 'んで', 'んだ'],
  ['む', 'ま', 'み', 'め', 'も', 'んで', 'んだ'],
  ['る', 'ら', 'り', 'れ', 'ろ', 'って', 'った'],
  ['う', 'わ', 'い', 'え', 'お', 'って', 'った']
];

function buildRules(): Rule[] {
  const rules: Rule[] = [];
  const add = (suffixIn: string, suffixOut: string, from: number, to: number) =>
    rules.push([suffixIn, suffixOut, from, to]);

  for (const [u, a, i, e, o, te, ta] of GODAN) {
    add(te, u, SURFACE | TE, V5); // 書いて
    add(ta, u, SURFACE | TA, V5); // 書いた
    add(`${a}ない`, u, SURFACE | ADJ, V5); // 書かない
    add(`${a}ず`, u, SURFACE, V5);
    add(`${a}ん`, u, SURFACE, V5); // 分からん
    add(i, u, STEM, V5); // 書き(ます)
    add(`${o}う`, u, SURFACE, V5); // 書こう
    add(e, u, SURFACE, V5); // 書け (imperative)
    add(`${e}る`, u, SURFACE | V1, V5); // 書ける (potential)
    add(`${e}ば`, u, SURFACE, V5); // 書けば
    add(`${a}れる`, u, SURFACE | V1, V5); // 書かれる
    add(`${a}せる`, u, SURFACE | V1, V5); // 書かせる
  }
  // 行く: って / った, not いて / いた
  add('行って', '行く', SURFACE | TE, V5);
  add('行った', '行く', SURFACE | TA, V5);
  add('いって', 'いく', SURFACE | TE, V5);
  add('いった', 'いく', SURFACE | TA, V5);

  // Ichidan
  add('て', 'る', SURFACE | TE, V1);
  add('た', 'る', SURFACE | TA, V1);
  add('ない', 'る', SURFACE | ADJ, V1);
  add('ず', 'る', SURFACE, V1);
  add('ん', 'る', SURFACE, V1);
  add('', 'る', STEM, V1);
  add('よう', 'る', SURFACE, V1);
  add('ろ', 'る', SURFACE, V1);
  add('よ', 'る', SURFACE, V1);
  add('られる', 'る', SURFACE | V1, V1); // potential / passive
  add('れる', 'る', SURFACE | V1, V1); // ら抜き
  add('させる', 'る', SURFACE | V1, V1);
  add('れば', 'る', SURFACE, V1);

  // する (and する-nouns: 勉強した → 勉強)
  add('して', 'する', SURFACE | TE, VS);
  add('した', 'する', SURFACE | TA, VS);
  add('しない', 'する', SURFACE | ADJ, VS);
  add('せず', 'する', SURFACE, VS);
  add('し', 'する', STEM, VS);
  add('しよう', 'する', SURFACE, VS);
  add('しろ', 'する', SURFACE, VS);
  add('せよ', 'する', SURFACE, VS);
  add('される', 'する', SURFACE | V1, VS);
  add('させる', 'する', SURFACE | V1, VS);
  add('できる', 'する', SURFACE | V1, VS);
  add('すれば', 'する', SURFACE, VS);
  add('する', '', SURFACE | VS, SURFACE);

  // 来る
  for (const k of ['来', 'き', 'こ']) {
    const base = k === '来' ? '来る' : 'くる';
    if (k !== 'こ') {
      add(`${k}て`, base, SURFACE | TE, VK);
      add(`${k}た`, base, SURFACE | TA, VK);
      add(k, base, STEM, VK);
    }
    if (k !== 'き') {
      add(`${k}ない`, base, SURFACE | ADJ, VK);
      add(`${k}よう`, base, SURFACE, VK);
      add(`${k}い`, base, SURFACE, VK);
      add(`${k}られる`, base, SURFACE | V1, VK);
      add(`${k}れる`, base, SURFACE | V1, VK);
      add(`${k}させる`, base, SURFACE | V1, VK);
    }
  }
  add('くれば', 'くる', SURFACE, VK);
  add('来れば', '来る', SURFACE, VK);

  // い-adjectives
  add('くて', 'い', SURFACE | TE, ADJ);
  add('かった', 'い', SURFACE | TA, ADJ);
  add('くない', 'い', SURFACE | ADJ, ADJ);
  add('ければ', 'い', SURFACE, ADJ);
  add('く', 'い', SURFACE, ADJ);
  add('さ', 'い', SURFACE, ADJ);
  add('そう', 'い', SURFACE, ADJ);
  add('すぎる', 'い', SURFACE | V1, ADJ);

  // Past and te-form compounds
  add('たら', 'た', SURFACE, TA);
  add('だら', 'だ', SURFACE, TA);
  add('たり', 'た', SURFACE, TA);
  add('だり', 'だ', SURFACE, TA);
  add('ちゃ', 'て', SURFACE, TE);
  add('じゃ', 'で', SURFACE, TE);
  for (const [aux, cls] of [
    ['いる', V1],
    ['る', V1],
    ['おく', V5],
    ['しまう', V5],
    ['ある', V5],
    ['いく', V5],
    ['く', V5],
    ['くる', VK],
    ['みる', V1],
    ['くれる', V1],
    ['あげる', V1],
    ['もらう', V5],
    ['ほしい', ADJ],
    ['ください', SURFACE]
  ] as const) {
    add(`て${aux}`, 'て', SURFACE | cls, TE);
    add(`で${aux}`, 'で', SURFACE | cls, TE);
  }
  add('とく', 'て', SURFACE | V5, TE);
  add('どく', 'で', SURFACE | V5, TE);
  add('ちゃう', 'て', SURFACE | V5, TE);
  add('じゃう', 'で', SURFACE | V5, TE);

  // Polite and stem-based forms
  add('ます', '', SURFACE | MASU, STEM);
  for (const form of ['ません', 'ました', 'ませんでした', 'ましょう', 'まして']) {
    add(form, 'ます', SURFACE, MASU);
  }
  add('たい', '', SURFACE | ADJ, STEM);
  add('ながら', '', SURFACE, STEM);
  add('そう', '', SURFACE, STEM);
  add('すぎる', '', SURFACE | V1, STEM);
  add('なさい', '', SURFACE, STEM);
  add('やすい', '', SURFACE | ADJ, STEM);
  add('にくい', '', SURFACE | ADJ, STEM);
  return rules;
}

const RULES = buildRules();
const MAX_DEPTH = 8;

/**
 * Every form `text` could be an inflection of, `text` itself included. A
 * result may be no word at all — check it against a word list.
 */
export function deinflect(text: string): string[] {
  const results = new Set<string>([text]);
  const seen = new Set<string>([`${text}|${SURFACE}`]);
  let frontier: [string, number][] = [[text, SURFACE]];
  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const next: [string, number][] = [];
    for (const [form, cls] of frontier) {
      for (const [suffixIn, suffixOut, from, to] of RULES) {
        if (!(cls & from) || !form.endsWith(suffixIn)) continue;
        const out = form.slice(0, form.length - suffixIn.length) + suffixOut;
        if (!out) continue;
        const key = `${out}|${to}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (to & RESULT) results.add(out);
        next.push([out, to]);
      }
    }
    frontier = next;
  }
  return [...results];
}
