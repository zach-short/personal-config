import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { runUndo } from '../src/commands/undo.ts';
import type { PlannedFile } from '../src/lib/types.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { cleanup, recordingPrompter, tempDir, withTty } from './helpers.ts';

function file(path: string, contents: string): PlannedFile {
  return { path, contents, label: 'test', strategy: 'overwrite' };
}

/**
 * `runUndo` reports through `say`, which is `console.log`, so catching the lines is the only way
 * to read what the refusal told the person — and what it said is the half of option (b) that
 * makes the other half honest. Same shape as `tests/decline-seam.test.ts`'s.
 */
async function captured(run: () => Promise<number>): Promise<{ code: number; out: string }> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    return { code: await run(), out: lines.join('\n') };
  } finally {
    console.log = original;
  }
}

/**
 * `paths.ts` reads `$HOME` on every call rather than snapshotting it, so swapping it here moves
 * the whole backups directory — the only way to drive "there is no backup at all" in a suite
 * whose shared sandbox `$HOME` has collected backups from every file before this one (`X2`).
 */
async function withEmptyHome<T>(run: () => Promise<T>): Promise<T> {
  const original = process.env.HOME;
  const dir = await tempDir('pc-undo-home-');
  process.env.HOME = dir;
  try {
    return await run();
  } finally {
    process.env.HOME = original;
    await cleanup(dir);
  }
}

/** A run that overwrote one file, leaving exactly one backup for `undo` to find. */
async function aRunToUndo(dir: string, before = 'original\n'): Promise<string> {
  const target = join(dir, 'doc.md');
  await Bun.write(target, before);
  await commitPlan(await resolvePlan([file(target, 'generated\n')]));
  return target;
}

/**
 * Option (b), decided by Zach on 2026-09-17: `undo` stays a one-shot, one-way restore — it takes
 * no backup of its own and there is no undo of an undo — but it says so before it acts and
 * refuses to act twice. These are the two behaviours that claim makes, plus the two ends it
 * already had. All four ran red against `undo` as it stood that morning.
 */
describe('undo is one-shot, and honest about it', () => {
  test('it asks before restoring, and a no restores nothing', async () => {
    const dir = await tempDir('pc-undo-');
    try {
      const target = await aRunToUndo(dir);
      const { prompter, asked } = recordingPrompter([false]);

      const { code, out } = await captured(() => withTty(true, () => runUndo(prompter)));

      expect(asked).toHaveLength(1);
      expect(asked[0]?.message).toContain('Restore');
      expect(await Bun.file(target).text()).toBe('generated\n');
      expect(out).toContain('Nothing was restored');
      expect(code).toBe(0);
    } finally {
      await cleanup(dir);
    }
  });

  test('it names what it would overwrite, and that the restore is one-way', async () => {
    const dir = await tempDir('pc-undo-');
    try {
      await aRunToUndo(dir);
      const { prompter } = recordingPrompter([false]);

      const { out } = await captured(() => withTty(true, () => runUndo(prompter)));

      expect(out).toContain('doc.md');
      expect(out).toContain('one-way');
    } finally {
      await cleanup(dir);
    }
  });

  test('a second undo of the same backup is refused, not reapplied', async () => {
    const dir = await tempDir('pc-undo-');
    try {
      const target = await aRunToUndo(dir);

      const first = await captured(() => withTty(false, () => runUndo()));
      expect(first.code).toBe(0);
      expect(await Bun.file(target).text()).toBe('original\n');

      // The edit a second `undo` used to eat: made after the restore, and the only copy there is.
      await Bun.write(target, 'hand-edited after the undo\n');
      const second = await captured(() => withTty(false, () => runUndo()));

      expect(second.code).toBe(1);
      expect(second.out).toContain('already been restored');
      expect(await Bun.file(target).text()).toBe('hand-edited after the undo\n');
    } finally {
      await cleanup(dir);
    }
  });

  test('with no terminal there is nobody to ask, so it restores unasked', async () => {
    const dir = await tempDir('pc-undo-');
    try {
      const target = await aRunToUndo(dir);
      const { prompter, asked } = recordingPrompter([]);

      const { code } = await captured(() => withTty(false, () => runUndo(prompter)));

      expect(asked).toEqual([]);
      expect(await Bun.file(target).text()).toBe('original\n');
      expect(code).toBe(0);
    } finally {
      await cleanup(dir);
    }
  });

  test('with no backup at all it says so and asks nothing', async () => {
    const { prompter, asked } = recordingPrompter([]);
    const { code, out } = await withEmptyHome(() =>
      captured(() => withTty(true, () => runUndo(prompter))),
    );

    expect(asked).toEqual([]);
    expect(out).toContain('No backup to restore');
    expect(code).toBe(0);
  });
});
