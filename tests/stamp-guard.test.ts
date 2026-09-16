import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { stampDrift } from '../src/doctor/rules/stamp-drift.ts';
import { kindOf } from '../src/doctor/scan.ts';
import { latestManifest, restore } from '../src/lib/backup.ts';
import { isOurs, readStamp, type StampParts, withStamp } from '../src/lib/stamp.ts';
import type { PlannedFile } from '../src/lib/types.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { edit } from '../src/render/context.ts';
import { renderAll } from '../src/render/index.ts';
import {
  cleanup,
  clearSavedAnswers,
  DEFAULT_ANSWERS,
  tempDir,
  testContext,
  testRepoPlan,
  testScan,
} from './helpers.ts';

const STAMP: StampParts = {
  version: '0.2.1',
  date: '2026-09-16',
  configHash: 'abcd1234',
  standardVersion: '1.0.0',
};

/** A file the tool claims: the stamp in its contents is the claim. */
function generated(path: string, body: string): PlannedFile {
  return { path, contents: withStamp(body, STAMP), label: 'test', strategy: 'overwrite' };
}

/** A file the tool writes without claiming it — the two JSON state files, ignore lines. */
function unclaimed(
  path: string,
  contents: string,
  strategy: PlannedFile['strategy'] = 'overwrite',
): PlannedFile {
  return { path, contents, label: 'test', strategy };
}

/** What Part 0 adaptation does to take a document back: delete the one stamp line. */
function stripStamp(text: string): string {
  return text
    .split('\n')
    .filter((line) => readStamp(line) === null)
    .join('\n');
}

describe('the stamp guard', () => {
  test('a file with no stamp is left alone, not overwritten', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'CLAUDE.md');
      await Bun.write(target, '# written by a person\n');

      const changes = await resolvePlan([generated(target, '# generated\n')]);
      expect(changes[0]?.guard).toBe('no-stamp');
      expect(changes[0]?.after).toBe(changes[0]?.before as string);

      const result = await commitPlan(changes);
      expect(result.written).toEqual([]);
      expect(await Bun.file(target).text()).toBe('# written by a person\n');
    } finally {
      await cleanup(dir);
    }
  });

  test('a path with nothing at it is written — the guard is not a first-run block', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'HANDOFF.md');
      const changes = await resolvePlan([generated(target, '# the ledger\n')]);

      expect(changes[0]?.guard).toBe('none');
      await commitPlan(changes);
      expect(await Bun.file(target).text()).toContain('# the ledger');
    } finally {
      await cleanup(dir);
    }
  });

  test('a stamped file is overwritten even when edited, and undo brings it back', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'PASSOFF.md');
      const edited = withStamp('# ours, then edited by hand\n', STAMP);
      await Bun.write(target, edited);

      const changes = await resolvePlan([generated(target, '# re-rendered\n')]);
      expect(changes[0]?.guard).toBe('none');
      await commitPlan(changes);
      expect(await Bun.file(target).text()).toContain('# re-rendered');

      // The decision this pins: nothing in a stamp records the bytes we wrote, so a hand edit
      // to a stamped file is invisible here. It is recoverable rather than preserved.
      const manifest = await latestManifest();
      expect(manifest?.entries.map((e) => e.original)).toContain(target);
      await restore(manifest ?? { timestamp: '', entries: [] });
      expect(await Bun.file(target).text()).toBe(edited);
    } finally {
      await cleanup(dir);
    }
  });
});

describe('what the guard must not refuse', () => {
  test('merge-json still merges into a settings.json the tool never wrote', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'settings.json');
      await Bun.write(target, JSON.stringify({ model: 'theirs' }));

      const ours = JSON.stringify({
        hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [] }] },
      });
      const changes = await resolvePlan([unclaimed(target, ours, 'merge-json')]);
      expect(changes[0]?.guard).toBe('none');

      await commitPlan(changes);
      const merged = (await Bun.file(target).json()) as Record<string, unknown>;
      expect(merged.model).toBe('theirs');
      expect(JSON.stringify(merged)).toContain('PreToolUse');
    } finally {
      await cleanup(dir);
    }
  });

  test('append-lines still appends to an ignore file the tool never wrote', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, '.gitignore');
      await Bun.write(target, 'build/\n');

      const changes = await resolvePlan([
        unclaimed(target, '/.personal-config.json\n', 'append-lines'),
      ]);
      expect(changes[0]?.guard).toBe('none');

      await commitPlan(changes);
      expect(await Bun.file(target).text()).toBe('build/\n/.personal-config.json\n');
    } finally {
      await cleanup(dir);
    }
  });

  test('an in-place edit still writes — `passoff claim` marks a board nobody stamped', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'PASSOFF.md');
      await Bun.write(target, '| 5 | OPEN | a thing |\n');

      const changes = await resolvePlan([
        edit(target, 'board — item 5 claimed', '| 5 | IN FLIGHT | a thing |\n'),
      ]);
      expect(changes[0]?.guard).toBe('none');

      await commitPlan(changes);
      expect(await Bun.file(target).text()).toContain('IN FLIGHT');
    } finally {
      await cleanup(dir);
    }
  });
});

describe('taking a generated document back', () => {
  test('stripping the stamp survives a re-run, and the rest of the run still lands', async () => {
    const dir = await tempDir();
    try {
      const plan = () => {
        const repo = testRepoPlan({ scan: testScan({ path: dir, name: 'example' }) });
        return renderAll(testContext(DEFAULT_ANSWERS, repo));
      };
      await commitPlan(await resolvePlan(await plan()));

      const router = join(dir, 'CLAUDE.md');
      const ledger = join(dir, 'HANDOFF.md');
      const adapted = `${stripStamp(await Bun.file(router).text())}\n## written after Part 0\n`;
      expect(isOurs(adapted)).toBe(false);
      await Bun.write(router, adapted);

      const second = await resolvePlan(await plan());
      expect(second.find((c) => c.file.path === router)?.guard).toBe('no-stamp');
      expect(second.find((c) => c.file.path === ledger)?.guard).toBe('none');

      await commitPlan(second);
      expect(await Bun.file(router).text()).toBe(adapted);
    } finally {
      await cleanup(dir);
      await clearSavedAnswers();
    }
  });

  test('doctor goes quiet on exactly what the guard leaves alone', () => {
    const body = '# a document Part 0 rewrote\n';
    const stale = { configHash: 'ffffffff', standardVersion: '9.9.9' };
    const doc = (text: string) => ({
      path: 'CLAUDE.md',
      kind: kindOf('CLAUDE.md'),
      text,
      lines: text.split('\n'),
      isTemplate: false,
      ledgerStem: 'HANDOFF',
    });

    // Stamped: the guard would overwrite it, so a drift finding is actionable.
    expect(stampDrift(doc(withStamp(body, STAMP)), stale).length).toBeGreaterThan(0);
    // Unstamped: no re-run will ever clear the finding, so there must not be one.
    expect(stampDrift(doc(body), stale)).toEqual([]);
  });
});
