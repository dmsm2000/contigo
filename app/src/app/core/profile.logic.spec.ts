import { describe, expect, it } from 'vitest';
import { cleanName, MAX_NAME_LENGTH } from './profile.logic';

describe('cleanName', () => {
  it('arruma os espaços', () => {
    expect(cleanName('  Maria   José ')).toBe('Maria José');
  });

  it('um nome vazio ou só de espaços é recusado', () => {
    expect(cleanName('')).toBe('empty');
    expect(cleanName('   \n ')).toBe('empty');
  });

  it('aceita o limite e recusa o que passa dele', () => {
    expect(cleanName('x'.repeat(MAX_NAME_LENGTH))).toBe('x'.repeat(MAX_NAME_LENGTH));
    expect(cleanName('x'.repeat(MAX_NAME_LENGTH + 1))).toBe('tooLong');
  });

  it('aceita acentos e outros alfabetos', () => {
    expect(cleanName('Inês Çelik')).toBe('Inês Çelik');
  });
});
