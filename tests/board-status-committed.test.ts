import { describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { boardStatus, boardStatusRule } from '../src/doctor/rules/board-status.ts';
import type { Doc } from '../src/doctor/scan.ts';
import { loadItemContext } from '../src/lib/items.ts';
import { cleanup, tempDir } from './helpers.ts';
import { FIXTURE_BOARD, makeItemRepo } from './item-fixture.ts';

/**
 * §2.3, 2026-10-15: `DONE, <record>` is built and not yet in a commit, and `COMMITTED, <record>,
 * <hash>` is the owner's commit found in git. The hazard on the new word is a hash that reads
 * exactly like a real one and names nothing, so the hash is asked of git; the hazard on the old
 * one is every row written before the split, `DONE — HANDOFF 24`, turning into a finding.
 *
 * A file of its own rather than more cases in `board-status.test.ts`, per X1.
 */

const HEADER = '| # | Task | Status | Model | Lane | Waits on | Files it owns |';
const RULE = '|---|------|--------|-------|------|----------|---------------|';

const LOG = [
  '## Step log',
  '',
  '**1. One.** Done 2026-09-15.',
  '',
  '**2. Two.** Done 2026-09-16.',
];

function board(status: string, path: string): Doc {
  const text = [HEADER, RULE, `| 1 | X | \`${status}\` | D | A | — | — |`].join('\n');
  return {
    path,
    kind: 'board',
    text,
    lines: text.split('\n'),
    isTemplate: false,
    ledgerStem: 'HANDOFF',
  };
}

/** A 1.x board beside its ledger, in a temp directory git cannot read: hashes are unverifiable. */
async function messagesBesideLedger(status: string): Promise<string[]> {
  const dir = await tempDir('pc-committed-');
  try {
    await Bun.write(join(dir, 'HANDOFF.md'), LOG.join('\n'));
    return boardStatus.check(board(status, join(dir, 'PASSOFF.md'))).map((f) => f.message);
  } finally {
    await cleanup(dir);
  }
}

describe('§2.3 — COMMITTED carries the record and the commit (1.x board)', () => {
  test.each([
    'COMMITTED, HANDOFF 2, a1b2c3d',
    'COMMITTED — HANDOFF 2, a1b2c3d',
    'COMMITTED, HANDOFF 2, a1b2c3d (on claude/row-2)',
    'COMMITTED, portfolio HANDOFF 21, a1b2c3d',
  ])('passes: `%s`', async (status) => {
    expect(await messagesBesideLedger(status)).toEqual([]);
  });

  test.each([
    'COMMITTED',
    'COMMITTED, HANDOFF 2',
    'COMMITTED, a1b2c3d',
    'COMMITTED, 2026-10-15, a1b2c3d',
  ])('violates: `%s` names the shape', async (status) => {
    expect(await messagesBesideLedger(status)).toEqual([
      expect.stringContaining('`COMMITTED, HANDOFF <n>, <short hash>`'),
    ]);
  });

  test('violates: a step the ledger does not have', async () => {
    expect(await messagesBesideLedger('COMMITTED, HANDOFF 999, a1b2c3d')).toEqual([
      expect.stringContaining('`COMMITTED, HANDOFF 999` cites a step the ledger does not have'),
    ]);
  });
});

describe('§2.3 — DONE before and after the split (1.x board)', () => {
  test.each(['DONE, HANDOFF 2', 'DONE — HANDOFF 2'])('passes: `%s`', async (status) => {
    expect(await messagesBesideLedger(status)).toEqual([]);
  });

  test('the vocabulary names both words when a status is unknown', async () => {
    expect(await messagesBesideLedger('WIP')).toEqual([
      expect.stringContaining('DONE, <ledger step>, COMMITTED, <ledger step>, <hash>'),
    ]);
  });
});

async function git(cwd: string, args: string[]): Promise<string> {
  const proc = Bun.spawn(['git', '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'ignore',
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out.trim();
}

/** A real repo with one commit on `main` and one on a branch `main` does not hold. */
async function withGitRepo(run: (dir: string, hashes: string[]) => Promise<void>) {
  const dir = await tempDir('pc-committed-git-');
  try {
    await git(dir, ['init', '--quiet', '--initial-branch=main']);
    await git(dir, ['config', 'user.email', 'test@example.com']);
    await git(dir, ['config', 'user.name', 'test']);
    await Bun.write(join(dir, 'a.txt'), 'a\n');
    await git(dir, ['add', 'a.txt']);
    await git(dir, ['commit', '--quiet', '-m', 'row 1']);
    const onMain = await git(dir, ['rev-parse', '--short', 'HEAD']);
    await git(dir, ['checkout', '--quiet', '-b', 'claude/row-2']);
    await Bun.write(join(dir, 'b.txt'), 'b\n');
    await git(dir, ['add', 'b.txt']);
    await git(dir, ['commit', '--quiet', '-m', 'row 2']);
    const onBranch = await git(dir, ['rev-parse', '--short', 'HEAD']);
    await git(dir, ['checkout', '--quiet', 'main']);
    await Bun.write(join(dir, 'HANDOFF.md'), LOG.join('\n'));
    await run(dir, [onMain, onBranch]);
  } finally {
    await cleanup(dir);
  }
}

function messagesIn(dir: string, status: string): string[] {
  return boardStatus.check(board(status, join(dir, 'PASSOFF.md'))).map((f) => f.message);
}

describe('§2.3 — the hash is a commit git has', () => {
  test('passes: the commit on main', async () => {
    await withGitRepo(async (dir, [onMain]) => {
      expect(messagesIn(dir, `COMMITTED, HANDOFF 1, ${onMain}`)).toEqual([]);
    });
  });

  test('passes: a commit on a worktree branch main does not hold yet, and the row names it', async () => {
    await withGitRepo(async (dir, [, onBranch]) => {
      expect(messagesIn(dir, `COMMITTED, HANDOFF 2, ${onBranch} (on claude/row-2)`)).toEqual(
        [],
      );
    });
  });

  test('violates: a hash that names no commit here', async () => {
    await withGitRepo(async (dir) => {
      expect(messagesIn(dir, 'COMMITTED, HANDOFF 1, deadbee')).toEqual([
        expect.stringContaining('`deadbee` is not a commit in this repo'),
      ]);
    });
  });
});

describe('§2.3 — COMMITTED on a board with item files (D2)', () => {
  const SEVEN = '| 7 | Close the old thing | `DONE` — 2026-10-15 |';

  async function check(status: string, withFolder = true): Promise<string[]> {
    const repo = await makeItemRepo();
    try {
      if (!withFolder) await rm(repo.itemsDir, { recursive: true });
      const text = FIXTURE_BOARD.replace(SEVEN, `| 7 | Close the old thing | \`${status}\` |`);
      const doc: Doc = {
        path: join(repo.dir, 'PASSOFF.md'),
        kind: 'board',
        text,
        lines: text.split('\n'),
        isTemplate: false,
        ledgerStem: 'HANDOFF',
        itemsDir: repo.itemsDir,
      };
      const context = await loadItemContext(repo.dir, 'passoff');
      return boardStatusRule(context)
        .check(doc)
        .map((f) => f.message);
    } finally {
      await repo.done();
    }
  }

  test('passes: `COMMITTED, <date>, <hash>` whose file is in the archive', async () => {
    expect(await check('COMMITTED, 2026-10-15, a1b2c3d')).toEqual([]);
  });

  test('passes: `DONE, <date>`, the comma spelling', async () => {
    expect(await check('DONE, 2026-10-15')).toEqual([]);
  });

  test('violates: a date that is not one', async () => {
    expect(await check('COMMITTED, 2026-13-40, a1b2c3d')).toEqual([
      expect.stringContaining('`COMMITTED, 2026-13-40` is not a date'),
    ]);
  });

  test('violates: no hash names the 2.0.0 shape', async () => {
    expect(await check('COMMITTED, 2026-10-15')).toEqual([
      expect.stringContaining('`COMMITTED, <date>, <short hash>`'),
    ]);
  });

  test('on 1.x, a date is not a record (D12)', async () => {
    expect(await check('COMMITTED, 2026-10-15, a1b2c3d', false)).toEqual([
      expect.stringContaining('`COMMITTED, HANDOFF <n>, <short hash>`'),
    ]);
  });
});
