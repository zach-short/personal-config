import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { backupFiles, latestManifest, restore } from '../src/lib/backup.ts';
import { diffSummary } from '../src/lib/diff.ts';
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

      const manifest = await latestManifest();
      expect(manifest).not.toBeNull();
      expect(manifest?.entries.map((e) => e.original)).toContain(target);

      await restore(manifest ?? { timestamp: '', entries: [] });
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
