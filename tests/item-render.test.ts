import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import { scanRepo } from '../src/lib/discover.ts';
import { readText } from '../src/lib/disk.ts';
import { readStamp } from '../src/lib/stamp.ts';
import type { Answers, PlannedFile, RepoPlan } from '../src/lib/types.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { renderAll } from '../src/render/index.ts';
import { standardVersion } from '../src/render/standard.ts';
import {
  cleanup,
  DEFAULT_ANSWERS,
  tempDir,
  testContext,
  testRepoPlan,
  testScan,
} from './helpers.ts';

/**
 * Per-item-board Phase 5: what `setup` writes for a new repo (`DESIGN.md` §4.1 to §4.3, §4.6),
 * and what it must not write into a repo that already keeps a board (D12) or has migrated (D5).
 */

const FULL: Answers = {
  ...DEFAULT_ANSWERS,
  hooks: 'both',
  skills: 'all',
  workKind: 'code',
  configWeight: 'full',
  usesGit: 'yes',
};
const LIGHT: Answers = { ...FULL, configWeight: 'light' };
const NON_CODE_FULL: Answers = { ...FULL, workKind: 'non-code', proofLine: 'a reader agrees' };

const ITEM = '/tmp/example/passoff/1-first-task.md';

async function render(
  answers: Answers,
  plan: RepoPlan = testRepoPlan(),
): Promise<PlannedFile[]> {
  return renderAll(testContext(answers, plan));
}

function file(files: PlannedFile[], path: string): PlannedFile | undefined {
  return files.find((f) => f.path === path);
}

function config(files: PlannedFile[]): Record<string, unknown> {
  const found = files.find((f) => f.path.endsWith('.personal-config.json'));
  return JSON.parse(found?.contents ?? '{}') as Record<string, unknown>;
}

function contents(files: PlannedFile[], suffix: string): string {
  return files.find((f) => f.path.endsWith(suffix))?.contents ?? '';
}

describe('a new repo on the full track gets the 2.0.0 board', () => {
  test('passes: the first item file is planned, its first line is `# 1.`, and it carries no stamp', async () => {
    const files = await render(FULL);
    const item = file(files, ITEM);
    expect(item).toBeDefined();
    expect(item?.contents.split('\n')[0]).toMatch(/^# 1\. /);
    // D7 puts the number on line one, and a stamp is a line one.
    expect(readStamp(item?.contents ?? '')).toBeNull();
  });

  test('passes: the board keeps no prompt below its table, and names the folder', async () => {
    const board = contents(await render(FULL), '/PASSOFF.md');
    expect(board).not.toContain('### 1.');
    expect(board).toContain('`passoff/<n>-<slug>.md`');
    expect(board).toContain('`DONE - <date>`');
    expect(board).not.toContain('HANDOFF n');
  });

  test('passes: the ledger has a log in place of the step log', async () => {
    const ledger = contents(await render(FULL), '/HANDOFF.md');
    expect(ledger).toContain('\n## Log\n');
    expect(ledger).not.toContain('## Step log');
    expect(ledger).toContain('`passoff/`');
  });

  test('passes: the config names the folder and freezes a log that has no steps', async () => {
    const saved = config(await render(FULL));
    expect(saved.itemsDir).toBe('passoff');
    // Without it `handoff step` offers step 1, and `fold ledger` never folds the log.
    expect(saved.ledgerFrozenAt).toBe(0);
  });

  test('passes: the router names the folder beside the board', async () => {
    const router = contents(await render(FULL), '/CLAUDE.md');
    expect(router).toContain("each item's prompt is its own file in `passoff/`");
  });

  test('passes: untracked, the exclude file gains `/passoff/`, anchored', async () => {
    const files = await render(
      FULL,
      testRepoPlan({
        trackMode: 'untracked',
        owned: false,
        scan: testScan({ remoteOwner: 'x' }),
      }),
    );
    const lines = contents(files, join('.git', 'info', 'exclude')).split('\n');
    expect(lines).toContain('/passoff/');
    expect(contents(files, 'CLAUDE.local.md')).toContain('`passoff/`');
  });

  test('violates nothing tracked: `.gitignore` names no items folder', async () => {
    const lines = contents(await render(FULL), '.gitignore').split('\n');
    expect(lines.some((line) => line.includes('passoff'))).toBe(false);
  });

  test('passes: an adopted board name gives its own folder (D7)', async () => {
    const files = await render(FULL, testRepoPlan({ scan: testScan({ boardDoc: 'NEXT.md' }) }));
    // An adopted board is a board on disk, so no first item is written into it either.
    expect(files.some((f) => f.path.includes('/next/'))).toBe(false);
    expect(config(files).itemsDir).toBe('next');
  });
});

describe('the light track writes no board, so no items folder (Phase 5 watch line)', () => {
  test('violates: no item file, no folder in the config, no frozen log', async () => {
    const files = await render(LIGHT);
    expect(files.some((f) => f.path.startsWith('/tmp/example/passoff/'))).toBe(false);
    const saved = config(files);
    expect(saved.itemsDir).toBe('');
    expect('ledgerFrozenAt' in saved).toBe(false);
  });

  test('violates: untracked and light, the exclude file names no items folder', async () => {
    const files = await render(
      LIGHT,
      testRepoPlan({
        trackMode: 'untracked',
        owned: false,
        scan: testScan({ remoteOwner: 'x' }),
      }),
    );
    expect(contents(files, join('.git', 'info', 'exclude'))).not.toContain('passoff');
  });

  test('passes: the light ledger keeps its step log, the only place its record can go', async () => {
    const ledger = contents(await render(LIGHT), '/HANDOFF.md');
    expect(ledger).toContain('## Step log');
    expect(ledger).not.toContain('## Log\n');
  });
});

describe('a re-run of setup keeps a repo in the shape it is in', () => {
  test('violates D12 if broken: a 1.x repo with a board gains no folder and no frozen log', async () => {
    const files = await render(
      FULL,
      testRepoPlan({ scan: testScan({ ledgerDoc: 'HANDOFF.md', boardDoc: 'PASSOFF.md' }) }),
    );
    expect(files.some((f) => f.path.startsWith('/tmp/example/passoff/'))).toBe(false);
    expect('ledgerFrozenAt' in config(files)).toBe(false);
  });

  test('passes: a migrated repo keeps its folder name and the step its log froze at', async () => {
    const files = await render(
      FULL,
      testRepoPlan({
        scan: testScan({
          ledgerDoc: 'HANDOFF.md',
          boardDoc: 'PASSOFF.md',
          itemsDoc: 'items',
          ledgerFrozenAt: 106,
        }),
      }),
    );
    const saved = config(files);
    expect(saved.itemsDir).toBe('items');
    expect(saved.ledgerFrozenAt).toBe(106);
    expect(files.some((f) => f.path.endsWith('1-first-task.md'))).toBe(false);
  });
});

/**
 * Written to disk and read back by `doctor`, as the light track's target is in `tracks.test.ts`:
 * the board, the item file and the ledger must agree for `item-files`, `board-status` and
 * `step-numbers` with no finding. Non-code, because a code target's Part 0 prompt keeps two
 * tokens on purpose. A plain folder, so `scanRepo` asks nothing of git.
 */
describe('doctor against a generated full target with an items folder', () => {
  async function generate(dir: string) {
    const scan = await scanRepo(dir, 'folder');
    const plan = testRepoPlan({ scan, trackMode: 'n/a' });
    const ctx = testContext(NON_CODE_FULL, plan);
    ctx.stamp = { ...ctx.stamp, standardVersion: await standardVersion() };
    const files = (await renderAll(ctx)).filter((f) => f.path.startsWith(dir));
    await commitPlan(await resolvePlan(files));
    return ctx;
  }

  test('passes: no findings, and the item file is on disk', async () => {
    const dir = await tempDir('pc-items-');
    try {
      const ctx = await generate(dir);
      const report = await runDoctorOn(dir, {
        standardVersion: ctx.stamp.standardVersion,
        config: ctx.config,
      });
      const described = report.findings.map(
        (f) => `${f.file}:${f.line} ${f.rule} — ${f.message}`,
      );
      expect(described).toEqual([]);
      expect(await readText(join(dir, 'passoff', '1-first-task.md'))).toMatch(/^# 1\. /);
    } finally {
      await cleanup(dir);
    }
  });

  test('passes: a second run plans no item file and keeps the frozen log', async () => {
    const dir = await tempDir('pc-items-');
    try {
      await generate(dir);
      const scan = await scanRepo(dir, 'folder');
      expect(scan.itemsDoc).toBe('passoff');
      expect(scan.ledgerFrozenAt).toBe(0);
      const again = await renderAll(
        testContext(NON_CODE_FULL, testRepoPlan({ scan, trackMode: 'n/a' })),
      );
      expect(again.some((f) => f.path.endsWith('1-first-task.md'))).toBe(false);
      expect(config(again).ledgerFrozenAt).toBe(0);
    } finally {
      await cleanup(dir);
    }
  });
});
