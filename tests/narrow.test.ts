/**
 * The boundaries where parsed JSON becomes a typed value (`docs/conventions-ts.md` T1) — and the
 * one among them that was a security hole. `--from` merged whatever a fetched document said,
 * `identity` included, and `setup` preferred that identity to the login `gh` proves; so a
 * profile handed out by anyone could name you the owner of a repository you do not own, and the
 * ownership guard would then write tracked files into it. Found 2026-09-17.
 */
import { describe, expect, test } from 'bun:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseCli } from '../src/lib/args.ts';
import { latestBackup } from '../src/lib/backup.ts';
import { loadConfig } from '../src/lib/config.ts';
import { backupsDir } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

async function jsonFile(dir: string, name: string, body: unknown): Promise<string> {
  const path = join(dir, name);
  await Bun.write(path, JSON.stringify(body));
  return path;
}

describe('identity is never read from a document handed over', () => {
  test('violates: a --from profile naming a login does not become the login', async () => {
    const dir = await tempDir('pc-from-');
    try {
      const path = await jsonFile(dir, 'profile.json', {
        identity: { githubLogin: 'owner-of-a-repo-you-only-cloned' },
        answers: { mode: 'solo' },
      });
      const config = await loadConfig(parseCli(['setup', '--from', path]), null);

      expect(config.identity.githubLogin).toBeNull();
      // The rest of the document still lands: only the claim about who you are is dropped.
      expect(config.answers.mode).toBe('solo');
    } finally {
      await cleanup(dir);
    }
  });

  test('violates: nor does a checkout’s own .personal-config.json', async () => {
    const dir = await tempDir('pc-repo-');
    try {
      await jsonFile(dir, '.personal-config.json', {
        identity: { githubLogin: 'someone' },
        models: { default: 'From The Repo' },
      });
      const config = await loadConfig(parseCli(['setup']), dir);

      expect(config.identity.githubLogin).toBeNull();
      expect(config.models.default).toBe('From The Repo');
    } finally {
      await cleanup(dir);
    }
  });

  test('passes: a profile shipped with the package may still name one', async () => {
    const config = await loadConfig(parseCli(['setup', '--profile', 'zach']), null);
    expect(config.identity.githubLogin).not.toBeNull();
  });
});

describe('a config layer is narrowed, not cast', () => {
  test('violates: a models field that is not an object is refused, naming the file and the field', async () => {
    const dir = await tempDir('pc-from-');
    try {
      const path = await jsonFile(dir, 'profile.json', { models: 'Opus 5' });
      const loading = loadConfig(parseCli(['setup', '--from', path]), null);
      await expect(loading).rejects.toThrow('"models" is not an object');
      await expect(loading).rejects.toThrow(path);
    } finally {
      await cleanup(dir);
    }
  });

  test('violates: an answer that is not a string, boolean or list of strings is refused', async () => {
    const dir = await tempDir('pc-from-');
    try {
      const path = await jsonFile(dir, 'profile.json', { answers: { mode: 7 } });
      await expect(loadConfig(parseCli(['setup', '--from', path]), null)).rejects.toThrow(
        '"answers.mode"',
      );
    } finally {
      await cleanup(dir);
    }
  });

  test('passes: a partial models object merges over the layer below it', async () => {
    const dir = await tempDir('pc-from-');
    try {
      const path = await jsonFile(dir, 'profile.json', {
        models: { default: 'From The Document' },
      });
      const config = await loadConfig(
        parseCli(['setup', '--profile', 'zach', '--from', path]),
        null,
      );
      expect(config.models.default).toBe('From The Document');
      expect(config.models.deep).toBe('Fable 5.1');
    } finally {
      await cleanup(dir);
    }
  });
});

describe('a backup manifest is narrowed before undo trusts it', () => {
  /**
   * Stamped far in the future so it is the newest directory `latestBackup` sees, and removed
   * in `finally` so no later test in the run finds it there.
   */
  test('violates: a manifest.json that is not one is refused, naming its path', async () => {
    const dir = join(backupsDir(), '9999-12-31T23-59-59-000');
    await mkdir(dir, { recursive: true });
    try {
      await Bun.write(join(dir, 'manifest.json'), JSON.stringify({ entries: 'nope' }));
      await expect(latestBackup()).rejects.toThrow(join(dir, 'manifest.json'));
    } finally {
      await cleanup(dir);
    }
  });
});
