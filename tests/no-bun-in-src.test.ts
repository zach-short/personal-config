import { describe, expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readText } from '../src/lib/disk.ts';
import { repoRoot } from '../src/lib/paths.ts';

async function tsFilesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return tsFilesUnder(full);
      return entry.name.endsWith('.ts') ? [full] : [];
    }),
  );
  return found.flat();
}

/** Strips block comments (including JSDoc) and line comments, so prose mentioning an API is not code calling it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('the published bin runs on Node, not Bun', () => {
  test('no source file calls a Bun-only API outside a comment', async () => {
    const files = await tsFilesUnder(join(repoRoot(), 'src'));
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(await readText(file));
      if (/\bBun\./.test(code)) offenders.push(file);
    }
    // src/lib/disk.ts documents the removal in prose (`Bun.file`, `Bun.write`, …) — that is
    // comment text stripped above, not a call. A hit here means real code, not documentation.
    expect(offenders).toEqual([]);
  });
});
