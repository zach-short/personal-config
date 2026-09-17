import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import {
  backupFiles,
  latestBackup,
  type Manifest,
  restore,
  timestampDir,
} from '../src/lib/backup.ts';
import { diffSummary } from '../src/lib/diff.ts';
import { readJson } from '../src/lib/disk.ts';
import type { PlannedFile } from '../src/lib/types.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { cleanup, tempDir } from './helpers.ts';

function file(
  path: string,
  contents: string,
  strategy: PlannedFile['strategy'] = 'overwrite',
): PlannedFile {
  return { path, contents, label: 'test', strategy };
}

describe('backup and undo', () => {
  test('an overwritten file is backed up and restored byte for byte', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'thing.md');
      await Bun.write(target, 'original\n');

      await commitPlan(await resolvePlan([file(target, 'replaced\n')]));
      expect(await Bun.file(target).text()).toBe('replaced\n');

      const backup = await latestBackup();
      expect(backup).not.toBeNull();
      expect(backup?.manifest.entries.map((e) => e.original)).toContain(target);
      expect(backup?.restoredAt).toBeNull();

      await restore(
        backup ?? { dir, manifest: { timestamp: '', entries: [] }, restoredAt: null },
      );
      expect(await Bun.file(target).text()).toBe('original\n');
    } finally {
      await cleanup(dir);
    }
  });

  test('a file that did not exist is not in the manifest', async () => {
    const dir = await tempDir();
    try {
      const manifest = await backupFiles([join(dir, 'never-existed.md')]);
      expect(manifest.entries).toEqual([]);
    } finally {
      await cleanup(dir);
    }
  });
});

/**
 * A stamp far in the past, so the directories these tests claim can never be the newest one
 * `latestBackup` hands another test in the suite — every other backup taken here is stamped
 * `new Date()`. It is what `timestampDir` would have returned at that instant, not a literal,
 * because the format is the thing under test.
 */
const LONG_AGO = timestampDir(new Date('2020-01-01T00:00:00Z'));

/** `<backup dir>/files/<n>-<flattened path>` — two levels up is the backup itself. */
function backupDirOf(stored: string): string {
  return dirname(dirname(stored));
}

async function manifestIn(dir: string): Promise<Manifest> {
  return (await readJson(join(dir, 'manifest.json'))) as Manifest;
}

/**
 * The three gaps row 39 reproduced in the chain every write in this tool goes through
 * (`HANDOFF.md` step 52, board item 53). Each of these failed against the code as it stood on
 * 2026-09-17 before the fix that follows it — which is the only reason any of them is evidence.
 */
describe('what the backup chain must not lose', () => {
  test('two backups taken inside one second get a directory each', async () => {
    const dir = await tempDir();
    try {
      const first = join(dir, 'first.md');
      const second = join(dir, 'second.md');
      await Bun.write(first, 'first\n');
      await Bun.write(second, 'second\n');

      // One stamp, twice — which is what `doctor --fix` looping several roots does on its own.
      const a = await backupFiles([first], LONG_AGO);
      const b = await backupFiles([second], LONG_AGO);

      const aDir = backupDirOf(a.entries[0]?.stored ?? '');
      const bDir = backupDirOf(b.entries[0]?.stored ?? '');
      expect(aDir).not.toBe(bDir);

      // Each directory's manifest is its own. The second run used to write its manifest over
      // the first's, leaving the first backup's files on disk with nothing naming them.
      expect((await manifestIn(aDir)).entries.map((e) => e.original)).toEqual([first]);
      expect((await manifestIn(bDir)).entries.map((e) => e.original)).toEqual([second]);

      // Still sortable: the newer directory sorts last, which is how `latestBackup` finds it.
      expect([bDir, aDir].sort()).toEqual([aDir, bDir]);
    } finally {
      await cleanup(dir);
    }
  });

  test('a file created while the confirm sat open is backed up, not silently overwritten', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'raced.md');
      // Resolved while nothing is there: this is the state the preview and the confirm show.
      const changes = await resolvePlan([file(target, 'ours\n')]);
      // The window. Another session in the same checkout writes the file while that prompt sits
      // open — the norm in this repo, not a contrived race.
      await Bun.write(target, 'somebody else was here\n');

      const result = await commitPlan(changes);
      expect(await Bun.file(target).text()).toBe('ours\n');

      const entry = result.manifest?.entries.find((e) => e.original === target);
      expect(entry).toBeDefined();
      expect(await Bun.file(entry?.stored ?? '').text()).toBe('somebody else was here\n');
    } finally {
      await cleanup(dir);
    }
  });

  test('a pre-existing empty file is backed up rather than counted as absent', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'empty.md');
      await Bun.write(target, '');

      const result = await commitPlan(await resolvePlan([file(target, 'filled\n')]));
      expect(await Bun.file(target).text()).toBe('filled\n');

      // "Absent" and "there, and empty" are different facts about a path. Reading them off one
      // `before` string made a zero-byte file the one thing a run could destroy without trace.
      const entry = result.manifest?.entries.find((e) => e.original === target);
      expect(entry).toBeDefined();
      expect(await Bun.file(entry?.stored ?? '').text()).toBe('');
    } finally {
      await cleanup(dir);
    }
  });
});

describe('write strategies', () => {
  test('append-lines adds only what is missing and never reorders', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, '.gitignore');
      await Bun.write(target, 'build/\n.env\n');

      await commitPlan(
        await resolvePlan([file(target, '.env\nPART0-PROMPT.md\n', 'append-lines')]),
      );
      expect(await Bun.file(target).text()).toBe('build/\n.env\nPART0-PROMPT.md\n');
    } finally {
      await cleanup(dir);
    }
  });

  test('append-lines is a no-op when every line is already there', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, '.gitignore');
      await Bun.write(target, 'a\nb\n');
      const changes = await resolvePlan([file(target, 'b\na\n', 'append-lines')]);
      expect(changes[0]?.before).toBe(changes[0]?.after as string);
    } finally {
      await cleanup(dir);
    }
  });

  test('merge-json keeps the user’s existing hooks and adds ours', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'settings.json');
      await Bun.write(
        target,
        JSON.stringify({
          model: 'theirs',
          hooks: {
            SessionStart: [{ hooks: [{ type: 'command', command: 'their-script.sh' }] }],
          },
        }),
      );

      const ours = JSON.stringify({
        hooks: {
          PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'guard.sh' }] }],
        },
      });
      await commitPlan(await resolvePlan([file(target, ours, 'merge-json')]));

      const merged = (await Bun.file(target).json()) as Record<string, never>;
      expect(merged.model).toBe('theirs' as never);
      expect(JSON.stringify(merged)).toContain('their-script.sh');
      expect(JSON.stringify(merged)).toContain('guard.sh');
    } finally {
      await cleanup(dir);
    }
  });

  test('merge-json does not duplicate an entry that is already present', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'settings.json');
      const ours = JSON.stringify({
        hooks: {
          PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'guard.sh' }] }],
        },
      });
      await Bun.write(target, ours);

      const changes = await resolvePlan([file(target, ours, 'merge-json')]);
      const parsed = JSON.parse(changes[0]?.after ?? '{}') as {
        hooks: { PreToolUse: unknown[] };
      };
      expect(parsed.hooks.PreToolUse).toHaveLength(1);
    } finally {
      await cleanup(dir);
    }
  });
});

describe('diff summary', () => {
  test('describes a new file, an unchanged one, and a change', () => {
    expect(diffSummary('', 'a\nb\n')).toContain('new file');
    expect(diffSummary('a\n', 'a\n')).toBe('unchanged');
    expect(diffSummary('a\nb\n', 'a\nc\n')).toBe('+1 −1');
  });
});
