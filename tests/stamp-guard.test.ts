import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { type StampExpectation, stampDrift } from '../src/doctor/rules/stamp-drift.ts';
import { kindOf } from '../src/doctor/scan.ts';
import { latestBackup, restore } from '../src/lib/backup.ts';
import {
  isOurs,
  markAdapted,
  readStamp,
  type StampParts,
  sameButForStampDate,
  stampLine,
  withStamp,
} from '../src/lib/stamp.ts';
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
  adapted: false,
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

  test('a person’s file that quotes a stamp in prose is left alone (H10)', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'CLAUDE.md');
      const theirs = `# written by a person\n\nOurs look like:\n\n    ${stampLine(STAMP)}\n`;
      await Bun.write(target, theirs);

      const changes = await resolvePlan([generated(target, '# generated\n')]);
      expect(changes[0]?.guard).toBe('no-stamp');

      await commitPlan(changes);
      expect(await Bun.file(target).text()).toBe(theirs);
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
      const backup = await latestBackup();
      expect(backup?.manifest.entries.map((e) => e.original)).toContain(target);
      await restore(
        backup ?? { dir, manifest: { timestamp: '', entries: [] }, restoredAt: null },
      );
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

  test('a stamp quoted in prose is not a claim — the write lands (H10)', async () => {
    const dir = await tempDir();
    try {
      // The shape that happened: a board gains a prompt that quotes a stamp, as row 68's did.
      const target = join(dir, 'PASSOFF.md');
      await Bun.write(target, '# board\n\n| 5 | OPEN | a thing |\n');
      const quoting = `# board\n\n| 5 | OPEN | a thing |\n\nThe files carry:\n\n\`\`\`\n${stampLine(STAMP)}\n\`\`\`\n`;

      const changes = await resolvePlan([unclaimed(target, quoting)]);
      expect(changes[0]?.guard).toBe('none');

      await commitPlan(changes);
      expect(await Bun.file(target).text()).toBe(quoting);
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
    // No render to compare against — the standard lag alone is what should tell the two apart.
    const stale: StampExpectation = {
      standardVersion: '9.9.9',
      rendered: null,
      configured: true,
    };
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

/**
 * H10's compatibility net (H7): narrowing where a stamp counts must not lose one a renderer
 * wrote. Every stamp here comes from the real renderers, in all three shapes they produce —
 * line 1, below a shebang (hook scripts), below frontmatter (skills).
 */
describe('a stamp where a renderer puts one still counts', () => {
  const answers = { ...DEFAULT_ANSWERS, skills: 'all', hooks: 'both' } as const;

  async function rendered(dir: string): Promise<PlannedFile[]> {
    const repo = testRepoPlan({ scan: testScan({ path: dir, name: 'example' }) });
    const ctx = testContext(answers, repo);
    const files = await renderAll(ctx);
    return files.filter((file) => /personal-config v\S+ · \d{4}-/.test(file.contents));
  }

  function shaped(files: PlannedFile[], opening: string): PlannedFile {
    const file = files.find((f) => f.contents.startsWith(opening));
    if (!file) throw new Error(`no rendered file opens with ${opening}`);
    return file;
  }

  test('a hook written before 2026-09-18 — stamp above a displaced `#!` — still counts', () => {
    const old = `${stampLine(STAMP, 'sh')}\n#!/usr/bin/env bash\nset -euo pipefail\n`;
    expect(readStamp(old)).toEqual(STAMP);
    expect(readStamp(markAdapted(old, ''))?.adapted).toBe(true);
  });

  test('every rendered stamp round-trips, in all three shapes', async () => {
    const dir = await tempDir();
    try {
      const files = await rendered(dir);
      for (const opening of ['<!--', '#!', '---\n']) shaped(files, opening);
      for (const file of files) {
        expect({ path: file.path, ours: isOurs(file.contents) }).toEqual({
          path: file.path,
          ours: true,
        });
        expect(readStamp(file.contents)?.adapted).toBe(false);
      }
    } finally {
      await cleanup(dir);
      await clearSavedAnswers();
    }
  });

  test('the guard reads each shape as it did: stamped, adapted, stripped', async () => {
    const dir = await tempDir();
    try {
      const files = await rendered(dir);
      for (const opening of ['<!--', '#!', '---\n']) {
        const file = shaped(files, opening);
        const target = join(dir, `shape-${files.indexOf(file)}`);
        const planned = { ...file, path: target };
        const verdict = async (onDisk: string) => {
          await Bun.write(target, onDisk);
          return (await resolvePlan([planned]))[0]?.guard;
        };

        expect(await verdict(file.contents)).toBe('none');
        expect(await verdict(markAdapted(file.contents, ''))).toBe('adapted');
        expect(await verdict(stripStamp(file.contents))).toBe('no-stamp');
      }
    } finally {
      await cleanup(dir);
      await clearSavedAnswers();
    }
  });

  test('markAdapted marks the anchored line and changes no other', async () => {
    const dir = await tempDir();
    try {
      for (const file of await rendered(dir)) {
        const before = file.contents.split('\n');
        const after = markAdapted(file.contents, '').split('\n');
        const changed = before.flatMap((line, i) => (line === after[i] ? [] : [i]));
        expect(changed).toHaveLength(1);
        expect(readStamp(after.join('\n'))?.adapted).toBe(true);
      }
    } finally {
      await cleanup(dir);
      await clearSavedAnswers();
    }
  });

  test('only the anchored stamp’s date is forgiven, in each shape', async () => {
    const dir = await tempDir();
    try {
      for (const file of await rendered(dir)) {
        const redated = file.contents.replace(/ · \d{4}-\d{2}-\d{2} · /, ' · 2031-01-01 · ');
        expect(redated).not.toBe(file.contents);
        expect(sameButForStampDate(file.contents, redated)).toBe(true);
      }
    } finally {
      await cleanup(dir);
      await clearSavedAnswers();
    }
  });
});

describe('a quoted stamp’s date is prose, not provenance (H10)', () => {
  const board = (date: string) =>
    `# board\n\n| 5 | OPEN | a thing |\n\n    ${stampLine({ ...STAMP, date })}\n`;

  test('an edit that only changes a quoted date is not mistaken for date churn', () => {
    expect(sameButForStampDate(board('2026-09-16'), board('2026-09-24'))).toBe(false);
  });

  test('so the edit lands', async () => {
    const dir = await tempDir();
    try {
      const target = join(dir, 'PASSOFF.md');
      await Bun.write(target, board('2026-09-16'));

      const changes = await resolvePlan([edit(target, 'board', board('2026-09-24'))]);
      await commitPlan(changes);
      expect(await Bun.file(target).text()).toBe(board('2026-09-24'));
    } finally {
      await cleanup(dir);
    }
  });
});
