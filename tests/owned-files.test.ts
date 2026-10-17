import { describe, expect, test } from 'bun:test';
import { ownedFiles, ownedTokens, sharedFiles } from '../src/lib/board.ts';

describe('ownedTokens — the collision check reading "Files it owns" (row 124)', () => {
  test('a note in parentheses after a path is dropped, commas inside it included', () => {
    expect(
      ownedFiles('`src/lib/board.ts` (`sharedFiles`), `docs/x.md` (As built, P2)'),
    ).toEqual(['src/lib/board.ts', 'docs/x.md']);
  });

  test('a brace list stays one token, and it is a glob', () => {
    expect(ownedTokens('`native/{a,b}.tsx`, `src/c.ts`')).toEqual([
      { text: 'native/{a,b}.tsx', kind: 'glob' },
      { text: 'src/c.ts', kind: 'path' },
    ]);
  });

  test('a route folder in parentheses is part of the path, not a note', () => {
    expect(ownedTokens('`web/app/(no-nav)/checkout/`')).toEqual([
      { text: 'web/app/(no-nav)/checkout/', kind: 'path' },
    ]);
  });

  test('home, absolute and parent paths are not repository-relative', () => {
    const kinds = ownedTokens('`~/.wk/wk.toml`, `/etc/hosts`, `../x.ts`, `web/.../y.tsx`').map(
      (t) => t.kind,
    );
    expect(kinds).toEqual(['prose', 'prose', 'prose', 'glob']);
  });

  test('an empty cell, a dash and nothing own nothing', () => {
    expect(ownedTokens('')).toEqual([]);
    expect(ownedTokens('—')).toEqual([]);
    expect(ownedTokens('nothing')).toEqual([]);
  });

  test('a bare file name is a path the check compares', () => {
    expect(ownedFiles('`Makefile`, `LICENSE`')).toEqual(['Makefile', 'LICENSE']);
  });
});

describe('sharedFiles — exact tokens and directory prefixes', () => {
  test('exact tokens match as before', () => {
    expect(sharedFiles('`src/import.ts`', '`src/import.ts`, `src/cli.ts`')).toEqual([
      'src/import.ts',
    ]);
    expect(sharedFiles('`src/a.ts`', '`src/b.ts`')).toEqual([]);
  });

  test('a directory collides with a file under it, from either side, named by the file', () => {
    expect(sharedFiles('`src/lib/`', '`src/lib/board.ts`')).toEqual(['src/lib/board.ts']);
    expect(sharedFiles('`src/lib/board.ts`', '`src/lib/`')).toEqual(['src/lib/board.ts']);
  });

  test('nested directories collide on the deeper one; equal directories on themselves', () => {
    expect(sharedFiles('`src/`', '`src/lib/`')).toEqual(['src/lib/']);
    expect(sharedFiles('`tests/`', '`tests/`')).toEqual(['tests/']);
  });

  test('a prefix without the trailing slash is a file, not a directory', () => {
    expect(sharedFiles('`src/lib`', '`src/lib/board.ts`')).toEqual([]);
    expect(sharedFiles('`src/li/`', '`src/lib/board.ts`')).toEqual([]);
  });

  test('a path with a note collides with the same path without one', () => {
    expect(sharedFiles('`src/lib/board.ts` (`sharedFiles`)', '`src/lib/board.ts`')).toEqual([
      'src/lib/board.ts',
    ]);
  });
});
