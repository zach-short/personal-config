import { describe, expect, test } from 'bun:test';
import { chmod, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  copyTo,
  exists,
  modeOf,
  readJson,
  readText,
  setMode,
  writeText,
} from '../src/lib/disk.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

describe('disk', () => {
  /**
   * The whole reason this module exists rather than a bare `stat`. `Bun.file().exists()` was
   * false for a directory, and two callers are built on that: `discover.ts` probes directories
   * separately, and `isGitRepo` tells a `.git` directory from a worktree's `.git` file. A version
   * that answered `true` here would break both without failing any other test.
   */
  test('exists is true for a file and false for a directory', async () => {
    const dir = await tempDir();
    try {
      await writeText(join(dir, 'a-file'), 'x');
      await mkdir(join(dir, 'a-dir'));

      expect(await exists(join(dir, 'a-file'))).toBe(true);
      expect(await exists(join(dir, 'a-dir'))).toBe(false);
      expect(await exists(join(dir, 'not-there'))).toBe(false);
    } finally {
      await cleanup(dir);
    }
  });

  test('writeText creates the parent directories it needs', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'one', 'two', 'three.md');
      await writeText(target, 'deep\n');
      expect(await readText(target)).toBe('deep\n');
    } finally {
      await cleanup(dir);
    }
  });

  /**
   * `writeText`'s third argument, and the two facts behind it, measured 2026-09-18 rather than
   * assumed: a 0644 file run as a command fails, and `writeFile`'s own `mode` option would not
   * have fixed it — the option is honoured only when the call *creates* the file, so it is
   * silently ignored for exactly the install that needs repairing. Hence the explicit `chmod`.
   */
  test('writeText applies a mode, and applies it to a file that already exists', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'hook.sh');
      await writeText(target, '#!/usr/bin/env bash\necho hi\n', 0o755);
      expect(await modeOf(target)).toBe(0o755);

      await chmod(target, 0o644);
      await writeText(target, '#!/usr/bin/env bash\necho again\n', 0o755);
      expect(await modeOf(target)).toBe(0o755);
      expect((await stat(target)).mode & 0o111).not.toBe(0);
    } finally {
      await cleanup(dir);
    }
  });

  /** The other ~44 call sites: no third argument, no permission change, not even on a re-write. */
  test('writeText without a mode leaves permissions to the filesystem', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'notes.md');
      await writeText(target, 'plain\n');
      expect((await stat(target)).mode & 0o111).toBe(0);

      await chmod(target, 0o600);
      await writeText(target, 'plain again\n');
      expect(await modeOf(target)).toBe(0o600);
    } finally {
      await cleanup(dir);
    }
  });

  test('modeOf masks off the file type, and answers null for a path that is not there', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'a-file');
      await writeText(target, 'x');
      await chmod(target, 0o640);

      expect(await modeOf(target)).toBe(0o640);
      expect(await modeOf(join(dir, 'not-there'))).toBeNull();
    } finally {
      await cleanup(dir);
    }
  });

  test('setMode changes bits on a file whose bytes are already right', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'hook.sh');
      await writeText(target, 'body\n');
      await chmod(target, 0o644);

      await setMode(target, 0o755);
      expect(await modeOf(target)).toBe(0o755);
      expect(await readText(target)).toBe('body\n');
    } finally {
      await cleanup(dir);
    }
  });

  test('copyTo copies bytes and creates the parent directories it needs', async () => {
    const dir = await tempDir();
    try {
      const from = join(dir, 'source.md');
      const to = join(dir, 'nested', 'copy.md');
      await writeText(from, 'the bytes\n');

      await copyTo(from, to);
      expect(await readText(to)).toBe('the bytes\n');
    } finally {
      await cleanup(dir);
    }
  });

  /** Callers attach their own `.catch()`; several treat a missing file as an empty one. */
  test('readText and readJson reject on a path that is not there', async () => {
    const dir = await tempDir();
    try {
      await expect(readText(join(dir, 'nope'))).rejects.toThrow();
      await expect(readJson(join(dir, 'nope.json'))).rejects.toThrow();
      expect(await readText(join(dir, 'nope')).catch(() => '')).toBe('');
    } finally {
      await cleanup(dir);
    }
  });

  test('readJson parses, and rejects on malformed JSON rather than returning half of it', async () => {
    const dir = await tempDir();
    try {
      await writeText(join(dir, 'good.json'), '{"a":1}');
      await writeText(join(dir, 'bad.json'), '{"a":');

      expect(await readJson(join(dir, 'good.json'))).toEqual({ a: 1 });
      await expect(readJson(join(dir, 'bad.json'))).rejects.toThrow();
    } finally {
      await cleanup(dir);
    }
  });
});

describe('repoRoot', () => {
  /**
   * The invariant that has to hold in both layouts: a checkout runs from `src/lib/`, the published
   * bin is one bundled file in `dist/`. Counting `..` segments is right in exactly one of them,
   * and wrong resolves into `node_modules/` — which fails as a missing profile much later, not
   * as a crash. Asserting the marker rather than a literal path is what makes this layout-proof.
   */
  test('resolves to the directory holding package.json, not a fixed number of levels up', async () => {
    const root = repoRoot();

    expect(await exists(join(root, 'package.json'))).toBe(true);
    const pkg = (await readJson(join(root, 'package.json'))) as { name?: string };
    expect(pkg.name).toBe('personal-config');
  });

  test('the package root holds everything the CLI loads through it', async () => {
    const root = repoRoot();

    expect(await exists(join(root, 'profiles', 'starter.json'))).toBe(true);
    expect(await exists(join(root, 'standard', 'VERSION'))).toBe(true);
    expect(await exists(join(root, 'catalog.json'))).toBe(true);
    expect(await exists(join(root, 'templates', 'PART0-PROMPT.md'))).toBe(true);
  });
});
