import { describe, expect, test } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { migrateFold } from '../src/lib/fold.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { edit } from '../src/render/context.ts';
import { cleanup, tempDir } from './helpers.ts';

/**
 * Item 105's audit, finding 1: a plan's `after` is the file as it was read, with this run's edit
 * applied. A file another session changed between that read and the write lost the change, and
 * the run reported success. The case that found it was a ledger an autopilot run appended a step
 * to while `fold migrate` waited at its confirm.
 */

describe('commitPlan, a file that moved after the plan read it', () => {
  test('refuses the whole batch and writes nothing, the other file included', async () => {
    const dir = await tempDir('pc-moved-');
    try {
      const ledger = join(dir, 'HANDOFF.md');
      const board = join(dir, 'PASSOFF.md');
      await writeFile(ledger, '# Ledger\n\n**1. One.**\n');
      await writeFile(board, '# Board\n');
      const plan = await resolvePlan([
        edit(board, 'board', '# Board, cut\n'),
        edit(ledger, 'ledger', '# Ledger, cut\n'),
      ]);
      const appended = '# Ledger\n\n**1. One.**\n\n**2. Two, from another session.**\n';
      await writeFile(ledger, appended);

      await expect(commitPlan(plan)).rejects.toThrow(
        `changed on disk after this run read them: ${ledger}`,
      );
      expect(await readFile(ledger, 'utf8')).toBe(appended);
      expect(await readFile(board, 'utf8')).toBe('# Board\n');
    } finally {
      await cleanup(dir);
    }
  });

  test('a file that appeared after the plan read the path as absent is refused too', async () => {
    const dir = await tempDir('pc-moved-');
    try {
      const path = join(dir, 'new.md');
      const plan = await resolvePlan([edit(path, 'new', 'ours\n')]);
      await writeFile(path, 'theirs\n');
      await expect(commitPlan(plan)).rejects.toThrow('changed on disk');
      expect(await readFile(path, 'utf8')).toBe('theirs\n');
    } finally {
      await cleanup(dir);
    }
  });

  test('a file still as it was read is written', async () => {
    const dir = await tempDir('pc-moved-');
    try {
      const path = join(dir, 'same.md');
      await writeFile(path, 'before\n');
      const result = await commitPlan(await resolvePlan([edit(path, 'same', 'after\n')]));
      expect(result.written).toEqual([path]);
      expect(await readFile(path, 'utf8')).toBe('after\n');
    } finally {
      await cleanup(dir);
    }
  });
});

describe('migrateFold, the frozen log keeps its own bytes', () => {
  test('two trailing spaces on the last step line, a markdown line break, reach the archive', () => {
    const ledger =
      '# Ledger\n\n## Step log\n\n**1. Built it.** Done 2026-10-01.\n\nLast line.  \n\n## Style rules\n\nKeep.\n';
    const migration = migrateFold('', ledger, '2026-10-16', 'HANDOFF.md');
    expect(migration.log?.text.endsWith('Last line.  ')).toBe(true);
  });
});
