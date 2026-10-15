/**
 * Standard 2.1.1: a folder with no git can never write a hash, so under 2.1.0 its rows stopped at
 * `DONE` and nothing ever folded. There `DONE` is final, and `fold`, `fold migrate` and `unfolded`
 * treat it as `COMMITTED`. The hazard runs the other way too: a repo read as "no git" folds a
 * `DONE` item whose code is in no commit yet, so every case here has its git twin beside it.
 */
import { describe, expect, test } from 'bun:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { planRepo } from '../src/commands/setup.ts';
import { runDoctorOn } from '../src/doctor/index.ts';
import { defaultsPrompter } from '../src/lib/ask.ts';
import { boardFold, itemFold, migrateFold } from '../src/lib/fold.ts';
import { insideGit } from '../src/lib/git.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { isFoldable } from '../src/lib/status.ts';
import type { Answers } from '../src/lib/types.ts';
import { renderAll } from '../src/render/index.ts';
import {
  cleanup,
  DEFAULT_ANSWERS,
  tempDir,
  testConfig,
  testContext,
  testRepoPlan,
  testScan,
} from './helpers.ts';
import { FIXTURE_BOARD, FIXTURE_ITEMS, type ItemRepo, makeItemRepo } from './item-fixture.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');
const SPAWN_TIMEOUT = 30_000;

const ITEM_1 = FIXTURE_ITEMS['1'] ?? { name: '', text: '' };

/** The BD-3 board with item 1 built and recorded: its file is live and no commit holds it. */
const DONE_BOARD = FIXTURE_BOARD.replace(
  '| 1 | Write the first thing | `OPEN` |',
  '| 1 | Write the first thing | `DONE, 2026-10-14` |',
);

describe('insideGit reads the filesystem, at the root and above it', () => {
  test('a `.git` directory, a worktree `.git` file, and one two levels up all count', async () => {
    const dir = await tempDir('pc-nogit-');
    try {
      expect(await insideGit(dir)).toBe(false);
      await mkdir(join(dir, 'repo', '.git'), { recursive: true });
      expect(await insideGit(join(dir, 'repo'))).toBe(true);
      await mkdir(join(dir, 'repo', 'a', 'b'), { recursive: true });
      expect(await insideGit(join(dir, 'repo', 'a', 'b'))).toBe(true);
      await mkdir(join(dir, 'tree'));
      await writeFile(join(dir, 'tree', '.git'), 'gitdir: /elsewhere\n');
      expect(await insideGit(join(dir, 'tree'))).toBe(true);
    } finally {
      await cleanup(dir);
    }
  });
});

describe('isFoldable', () => {
  test('with git, only `COMMITTED`', () => {
    expect(isFoldable('COMMITTED, 2026-10-14, a1b2c3d', true)).toBe(true);
    expect(isFoldable('DONE, 2026-10-14', true)).toBe(false);
  });

  test('without git, `DONE` too, and still nothing open', () => {
    expect(isFoldable('DONE, 2026-10-14', false)).toBe(true);
    expect(isFoldable('DONE — HANDOFF 2', false)).toBe(true);
    expect(isFoldable('COMMITTED, 2026-10-14, a1b2c3d', false)).toBe(true);
    for (const status of ['OPEN', 'IN FLIGHT', 'HELD on 3', 'SUPERSEDED by 4', 'SETTLED AS NO'])
      expect(isFoldable(status, false), status).toBe(false);
  });
});

describe('the three folds, as data', () => {
  const listing = Object.values(FIXTURE_ITEMS);

  test('itemFold moves a `DONE` item without git and keeps it with git', () => {
    expect(itemFold(DONE_BOARD, listing, true)).toEqual([]);
    expect(itemFold(DONE_BOARD, listing, false).map((move) => move.name)).toEqual([
      ITEM_1.name,
    ]);
  });

  test('boardFold lifts a `DONE` prompt without git and keeps it with git', () => {
    const board = [
      '| # | Task | Status |',
      '|---|------|--------|',
      '| 2 | Build it | `DONE, HANDOFF 2` |',
      '',
      '### 2. Build it',
      '',
      'The prompt.',
      '',
    ].join('\n');
    expect(boardFold(board, true).folded).toEqual([]);
    expect(boardFold(board, false).folded.map((block) => block.id)).toEqual(['2']);
  });

  test('migrateFold sends a `DONE` section to the closed archive without git', () => {
    const board = [
      '| # | Task | Status |',
      '|---|------|--------|',
      '| 1 | Write it | `DONE, HANDOFF 1` |',
      '',
      '### 1. Write it',
      '',
      'The first prompt.',
      '',
    ].join('\n');
    const kept = migrateFold(board, '', '2026-10-15', 'HANDOFF.md', true);
    expect(kept.closed).toEqual([]);
    expect(kept.items.map((item) => item.number)).toEqual(['1']);
    const final = migrateFold(board, '', '2026-10-15', 'HANDOFF.md', false);
    expect(final.closed.map((block) => block.id)).toEqual(['1']);
    expect(final.items).toEqual([]);
  });
});

async function withDoneRepo(git: boolean, run_: (repo: ItemRepo) => Promise<void>) {
  const repo = await makeItemRepo({ git });
  try {
    await writeFile(join(repo.dir, 'PASSOFF.md'), DONE_BOARD);
    await run_(repo);
  } finally {
    await repo.done();
  }
}

async function unfoldedFindings(repo: ItemRepo): Promise<string[]> {
  const report = await runDoctorOn(repo.dir, {
    standardVersion: '1.0.0',
    config: testConfig(),
  });
  return report.findings.filter((f) => f.rule === 'unfolded').map((f) => f.message);
}

describe('unfolded, on a live `DONE` item file', () => {
  test('violates: without git, the file is dead weight and the rule says so', async () => {
    await withDoneRepo(false, async (repo) => {
      expect(await unfoldedFindings(repo)).toEqual([
        expect.stringMatching(/^1 closed item file\(s\) still in passoff\/ \(1\)/),
      ]);
    });
  });

  test('passes: with git, the file is the only copy until the commit exists', async () => {
    await withDoneRepo(true, async (repo) => {
      expect(await unfoldedFindings(repo)).toEqual([]);
    });
  });
});

async function run(cwd: string, args: string[], home: string) {
  const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
    cwd,
    env: { ...process.env, HOME: home },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (stderr !== '') throw new Error(`stderr: ${stderr}`);
  return { code, stdout };
}

describe('fold board, end to end', () => {
  test(
    'without git, a `DONE` item moves: archived, read back, then its file and row cut',
    async () => {
      const home = await tempDir('pc-home-');
      try {
        await withDoneRepo(false, async (repo) => {
          const { code } = await run(repo.dir, ['fold', 'board', '--force'], home);
          expect(code).toBe(0);
          expect(await readFile(join(repo.archiveItems, ITEM_1.name), 'utf8')).toBe(
            ITEM_1.text,
          );
          expect(
            await readFile(join(repo.itemsDir, ITEM_1.name), 'utf8').catch(() => null),
          ).toBe(null);
          const board = await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8');
          expect(board).not.toContain('| 1 | Write the first thing |');
        });
      } finally {
        await cleanup(home);
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'with git, the same `DONE` item stays: file and board untouched',
    async () => {
      const home = await tempDir('pc-home-');
      try {
        await withDoneRepo(true, async (repo) => {
          const { code } = await run(repo.dir, ['fold', 'board', '--force'], home);
          expect(code).toBe(0);
          expect(await readFile(join(repo.itemsDir, ITEM_1.name), 'utf8')).toBe(ITEM_1.text);
          expect(await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8')).toBe(DONE_BOARD);
        });
      } finally {
        await cleanup(home);
      }
    },
    SPAWN_TIMEOUT,
  );
});

describe('the board a target gets says which word folds', () => {
  const NOTE = '`DONE` is final here';

  test('a folder target is told that `DONE` folds', async () => {
    const answers: Answers = { ...DEFAULT_ANSWERS, usesGit: 'no', archiveHome: '' };
    const scan = testScan({
      kind: 'folder',
      name: 'accounts',
      path: '/tmp/x',
      remoteOwner: null,
    });
    const plan = await planRepo(scan, null, answers, testConfig(), defaultsPrompter());
    const files = await renderAll(testContext(answers, plan));
    const board = files.find((f) => f.path === '/tmp/x/PASSOFF.md')?.contents ?? '';
    expect(board.replace(/\s+/g, ' ')).toContain(NOTE);
    expect(board).not.toContain('{{');
  });

  test('a git target is not, whatever the person answered about git', async () => {
    for (const usesGit of ['yes', 'no']) {
      const answers: Answers = { ...DEFAULT_ANSWERS, usesGit };
      const files = await renderAll(testContext(answers, testRepoPlan()));
      const board = files.find((f) => f.path === '/tmp/example/PASSOFF.md')?.contents ?? '';
      expect(board, usesGit).toContain('`personal-config fold board` does it.');
      expect(board.replace(/\s+/g, ' '), usesGit).not.toContain(NOTE);
    }
  });
});
