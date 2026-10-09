import {describe, expect, it} from 'vitest';
import {catalogsForTests, fill, languageFor, numberFormat, stringsFor} from '../../src/i18n';

describe('texts', () => {
  it('have the same keys, placeholders and lines in English and Portuguese', () => {
    const {en, pt} = catalogsForTests;
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(pt[key].trim(), key).not.toBe('');
      expect(holes(pt[key]), key).toBe(holes(en[key]));
      expect(pt[key].split('\n').length, key).toBe(en[key].split('\n').length);
    }
  });

  it('pick Portuguese for any pt-*, English otherwise', () => {
    const {en, pt} = catalogsForTests;
    expect(languageFor('pt-PT')).toBe('pt');
    expect(languageFor('pt-BR')).toBe('pt');
    expect(languageFor('PT')).toBe('pt');
    expect(languageFor('en-US')).toBe('en');
    expect(stringsFor('pt-PT').newGame).toBe(pt.newGame);
    expect(stringsFor('fr-FR').newGame).toBe(en.newGame);
    expect(stringsFor(undefined).newGame).toBe(en.newGame);
    expect(fill('{a} · {b}', {a: 3, b: 'x'})).toBe('3 · x');
    expect(numberFormat('pt-BR')(1024)).toBe('1.024');
    expect(numberFormat('en')(1024)).toBe('1,024');
  });

  it('are Brazilian Portuguese, not from Portugal', () => {
    const all = Object.values(catalogsForTests.pt).join('\n');
    expect(all).not.toMatch(/\ba sua\b|\bo seu\b|\bas suas\b|\bos seus\b|\btu\b|\bestás|ecrã|telemóvel|\bregisto\b|utilizador|\bequipa\b/i);
  });
});
