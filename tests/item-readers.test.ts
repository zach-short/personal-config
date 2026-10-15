import { describe, expect, test } from 'bun:test';
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import { unfoldedRule } from '../src/doctor/rules/unfolded.ts';
import type { Doc } from '../src/doctor/scan.ts';
import { staleLogLines } from '../src/lib/log.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir, testConfig } from './helpers.ts';
import {
  FIXTURE_ARCHIVED_ITEM,
  FIXTURE_ITEMS,
  type ItemRepo,
  makeItemRepo,
} from './item-fixture.ts';

/**
 * Per-item-board `DESIGN.md` D11: `passoff next`, `board-status` and `unfolded` read one item
 * through one module, and the proof is the BD-3 fixture read by all three. Each step below moves
 * one item and asks every reader about it.
 */

const CLI = join(repoRoot(), 'src', 'cli.ts');

async function run(cwd: string, args: string[]) {
  const home = await tempDir('pc-home-');
  try {
    const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
      cwd,
      env: { ...process.env, HOME: home },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stdout = await new Response(proc.stdout).text();
    return { code: await proc.exited, stdout };
  } finally {
    await cleanup(home);
  }
}

/** What `board-status` and `unfolded` say about the board, as `doctor` builds them for this root. */
async function boardFindings(repo: ItemRepo): Promise<string[]> {
  const report = await runDoctorOn(repo.dir, {
    standardVersion: '1.0.0',
    config: testConfig(),
  });
  return report.findings
    .filter((f) => f.rule === 'board-status' || f.rule === 'unfolded')
    .map((f) => `${f.rule}: ${f.message}`);
}

/** Rewrites item 7's status cell on the fixture's board. */
async function setSeven(repo: ItemRepo, status: string): Promise<void> {
  const path = join(repo.dir, 'PASSOFF.md');
  const board = await readFile(path, 'utf8');
  await writeFile(path, board.replace('`DONE` — 2026-10-15', status));
}

async function withRepo(run_: (repo: ItemRepo) => Promise<void>): Promise<void> {
  const repo = await makeItemRepo();
  try {
    await run_(repo);
  } finally {
    await repo.done();
  }
}

describe('D11 — every reader agrees on every item of the BD-3 fixture', () => {
  test('the fixture as built: item 1 from its file, item 7 closed and archived', async () => {
    await withRepo(async (repo) => {
      const next = await run(repo.dir, ['passoff', 'next']);
      expect(next.code).toBe(0);
      expect(next.stdout).toContain('item 1 — Write the first thing');
      // The path's tail only: macOS reports the temp directory under `/private`.
      expect(next.stdout).toContain(`passoff/${FIXTURE_ITEMS['1']?.name}:`);
      expect(next.stdout).toContain('The first item file.');
      expect(next.stdout).not.toContain('The item between 1 and 2.');
      expect(next.stdout).toContain('A new item takes number 16');
      expect(await boardFindings(repo)).toEqual([]);
    });
  });

  test('item 7 committed and its file back in the live folder: unfolded sees it, board-status still finds it', async () => {
    await withRepo(async (repo) => {
      await rename(
        join(repo.archiveItems, FIXTURE_ARCHIVED_ITEM.name),
        join(repo.itemsDir, FIXTURE_ARCHIVED_ITEM.name),
      );
      await setSeven(repo, '`COMMITTED, 2026-10-15, a1b2c3d`');
      expect(await boardFindings(repo)).toEqual([
        expect.stringMatching(
          /^unfolded: 1 `COMMITTED` item file\(s\) still in passoff\/ \(7\)/,
        ),
      ]);
    });
  });

  /** §2.3: the file is the only way to rebuild the work until the owner's commit exists. */
  test('item 7 still DONE and its file back in the live folder: nothing to fold yet', async () => {
    await withRepo(async (repo) => {
      await rename(
        join(repo.archiveItems, FIXTURE_ARCHIVED_ITEM.name),
        join(repo.itemsDir, FIXTURE_ARCHIVED_ITEM.name),
      );
      await setSeven(repo, '`DONE, 2026-10-15`');
      expect(await boardFindings(repo)).toEqual([]);
    });
  });

  test("item 7's file gone from both: board-status reports it, unfolded has nothing to fold", async () => {
    await withRepo(async (repo) => {
      await rm(join(repo.archiveItems, FIXTURE_ARCHIVED_ITEM.name));
      expect(await boardFindings(repo)).toEqual([
        expect.stringContaining("board-status: `DONE, 2026-10-15` points at item 7's file"),
      ]);
    });
  });

  test('claiming down the board hands out 1, then 1.5, then 15, each from its own file', async () => {
    await withRepo(async (repo) => {
      for (const [number, text] of [
        ['1', 'The first item file.'],
        ['1.5', 'The item between 1 and 2.'],
        ['15', 'The file, which wins over the section.'],
      ] as const) {
        const next = await run(repo.dir, ['passoff', 'next']);
        expect(next.stdout).toContain(`item ${number} — `);
        expect(next.stdout).toContain(text);
        // 1 and 1.5 both own `src/a.ts`, so every claim after the first is a collision (§2.1).
        expect((await run(repo.dir, ['passoff', 'claim', number, '--force'])).code).toBe(0);
      }
      expect((await run(repo.dir, ['passoff', 'next'])).stdout).toContain('No `OPEN` item');
    });
  });
});

describe('passoff claim on an item file (§4.5)', () => {
  test('the status cell goes on the board, the note under the file’s heading, and nowhere else', async () => {
    await withRepo(async (repo) => {
      const result = await run(repo.dir, ['passoff', 'claim', '15']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Wrote 2 file(s)');

      const board = await Bun.file(join(repo.dir, 'PASSOFF.md')).text();
      expect(board).toContain('| 15 | Settle the question | `IN FLIGHT` |');
      expect(board).not.toContain('Claimed');

      const file = await Bun.file(join(repo.itemsDir, '15-settle-the-question.md')).text();
      expect(file.split('\n').slice(0, 3)).toEqual([
        '# 15. Settle the question',
        '',
        expect.stringMatching(/^> \*\*Claimed `IN FLIGHT` \d{4}-\d{2}-\d{2}\.\*\*$/),
      ]);
    });
  });

  test('--dry-run previews both files and writes neither', async () => {
    await withRepo(async (repo) => {
      const result = await run(repo.dir, ['passoff', 'claim', '1', '--dry-run']);
      expect(result.stdout).toContain(join(repo.dir, 'PASSOFF.md'));
      expect(result.stdout).toContain(join(repo.itemsDir, '1-write-the-first-thing.md'));
      expect(result.stdout).toContain('nothing was written');
      const file = await Bun.file(join(repo.itemsDir, '1-write-the-first-thing.md')).text();
      expect(file).toBe(FIXTURE_ITEMS['1']?.text ?? '');
    });
  });
});

describe('handoff step on a frozen ledger (BD-4)', () => {
  test('exits 0, says where the log went, prints both scaffolds, and writes nothing', async () => {
    const dir = await tempDir('pc-frozen-');
    try {
      const ledger = '# Ledger\n\n## Log\n\n- 2026-10-15 · log frozen at step 105\n';
      await Bun.write(join(dir, 'HANDOFF.md'), ledger);
      await Bun.write(join(dir, '.personal-config.json'), '{"ledgerFrozenAt": 105}\n');
      const before = await readdir(dir);

      const result = await run(dir, ['handoff', 'step']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('froze at step 105');
      expect(result.stdout).toContain('HANDOFF-log.md');
      expect(result.stdout).toMatch(/## Close-out, \d{4}-\d{2}-\d{2}/);
      expect(result.stdout).toMatch(/- \d{4}-\d{2}-\d{2} · closed item <n>/);
      expect(result.stdout).not.toContain('next free number');
      expect(await readdir(dir)).toEqual(before);
      expect(await Bun.file(join(dir, 'HANDOFF.md')).text()).toBe(ledger);
    } finally {
      await cleanup(dir);
    }
  });
});

describe('D4 — unfolded on a frozen ledger reports log lines past the dial', () => {
  const LEDGER = [
    '# Ledger',
    '',
    '## Log',
    '',
    '- 2026-06-01 · closed item 3',
    '- 2026-07-10 · autopilot run 1 · docs/incomplete/autopilot/STATE.md',
    '- 2026-10-15 · closed item 9',
    '',
    '## Style rules',
    '',
    '- 2020-01-01 · not a log line, it is under another heading',
  ].join('\n');

  function ledgerDoc(): Doc {
    return {
      path: 'HANDOFF.md',
      kind: 'ledger',
      text: LEDGER,
      lines: LEDGER.split('\n'),
      isTemplate: false,
      ledgerStem: 'HANDOFF',
    };
  }

  test('only lines under `## Log`, and only those older than ninety days', () => {
    expect(staleLogLines(LEDGER, '2026-10-15', 90).map((line) => line.date)).toEqual([
      '2026-06-01',
      '2026-07-10',
    ]);
    expect(staleLogLines(LEDGER, '2026-10-17', 90)).toHaveLength(2);
    expect(staleLogLines(LEDGER, '2026-09-15', 90)).toHaveLength(1);
  });

  test('violates: one finding, at the oldest line, on a frozen ledger', () => {
    const findings = unfoldedRule(
      { archived: null, ledgerFrozenAt: 105, git: true },
      '2026-10-15',
    ).check(ledgerDoc());
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(5);
    expect(findings[0]?.message).toContain('2 log line(s) older than 90 days');
  });

  test('passes: a 1.x ledger is never read for log lines (D12)', () => {
    const findings = unfoldedRule(
      { archived: null, ledgerFrozenAt: null, git: true },
      '2026-10-15',
    ).check(ledgerDoc());
    expect(findings).toEqual([]);
  });
});
