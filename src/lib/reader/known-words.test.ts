import { describe, expect, it } from 'vitest';
import { buildKnownWordIndex, cleanAnkiWord, findKnownWords, wordStem } from './known-words';

const words = (text: string, terms: string[]) =>
  findKnownWords(text, buildKnownWordIndex(terms)).map(([s, e]) => text.slice(s, e));

describe('findKnownWords', () => {
  it('finds words as written and inflected', () => {
    expect(words('昨日学校で本を読んだ', ['学校', '読む'])).toEqual(['学校', '読んだ']);
    expect(words('もう食べさせられなかったよ', ['食べる'])).toEqual(['食べさせられなかった']);
  });

  it('takes the longest match at each position', () => {
    expect(words('日本語が好き', ['日本', '日本語'])).toEqual(['日本語']);
  });

  it('never overlaps matches', () => {
    expect(words('大学生', ['大学', '学生'])).toEqual(['大学']);
  });

  it('leaves single kana out, keeps single kanji', () => {
    expect(words('心はある', ['心', 'は'])).toEqual(['心']);
  });

  it('finds nothing without words', () => {
    expect(findKnownWords('学校', buildKnownWordIndex([]))).toEqual([]);
  });

  it('gives UTF-16 offsets past surrogate pairs', () => {
    const text = '𠮟られた';
    expect(findKnownWords(text, buildKnownWordIndex(['𠮟る']))).toEqual([[0, text.length]]);
  });
});

describe('wordStem', () => {
  it('drops the hiragana tail inflection changes', () => {
    expect(wordStem('食べる')).toBe('食');
    expect(wordStem('勉強する')).toBe('勉強');
    expect(wordStem('高い')).toBe('高');
    expect(wordStem('学校')).toBe('学校');
    expect(wordStem('わかる')).toBe('わ');
  });
});

describe('cleanAnkiWord', () => {
  it('strips HTML, furigana and spaces', () => {
    expect(cleanAnkiWord('<b>食</b>べる')).toBe('食べる');
    expect(cleanAnkiWord(' 漢字[かんじ] ')).toBe('漢字');
    expect(cleanAnkiWord('日本&nbsp;語')).toBe('日本語');
  });
});
