import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Tree = { [key: string]: string | Tree };

function flatKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flatKeys(value, `${prefix}${key}.`),
  );
}

function load(language: string): Tree {
  return JSON.parse(readFileSync(join(process.cwd(), 'public/i18n', `${language}.json`), 'utf8'));
}

describe('traduções', () => {
  const portuguese = flatKeys(load('pt')).sort();

  for (const language of ['es', 'en']) {
    it(`${language} tem exatamente as mesmas frases que pt`, () => {
      expect(flatKeys(load(language)).sort()).toEqual(portuguese);
    });
  }
});
