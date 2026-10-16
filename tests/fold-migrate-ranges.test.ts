import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseBoard } from '../src/lib/board.ts';
import { migrateFold } from '../src/lib/fold.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

/**
 * Range headings in `fold migrate` (item 105, G59). A board that files items under
 * `### 26–30.` has one section for a run of rows and no heading per row, so before this every
 * row in the run got no item file. The hazard is text that leaves the board and lands nowhere,
 * so each case reads it back where it should be.
 */

const CLI = join(repoRoot(), 'src', 'cli.ts');
const SPAWN_TIMEOUT = 30_000;
const DATE = '2026-10-16';

/** One range of three rows, one `DONE`; item 9 has its own section; one level-2 prose section. */
const BOARD = `# Board

| # | Task | Status | Model | Lane | Waits on | Files it owns |
|---|------|--------|-------|------|----------|---------------|
| 3 | Fix the first break | DONE — HANDOFF 4 | Opus | A | — | a.ts |
| 4 | Fix the second break | OPEN | Opus | A | — | b.ts |
| 5 | Fix the third break | HELD | Opus | A | item 4 | c.ts |
| 9 | Build the scoped thing | OPEN | Opus | B | — | d.ts |

## Why each item exists

Dated, because an item with no reason gets re-proposed.

### 3–5. Breaks found by the walk, 2026-10-04

The walk found three breaks. Every row is a lead.

### 9. Build the scoped thing

The scoped prompt.

## Build row 4: the walk's own notes

Notes that are no row's section.
`;

const LEDGER = `# Ledger

## Step log

**1. Built it.** Done 2026-10-01.

Body of one.
`;

const RANGE_TEXT =
  '### 3–5. Breaks found by the walk, 2026-10-04\n\nThe walk found three breaks. Every row is a lead.';

describe('migrateFold, a range heading', () => {
  const migration = migrateFold(BOARD, LEDGER, DATE, 'HANDOFF.md');

  test('each open row in the range gets a file: shared context, then its own row', () => {
    expect(migration.problems).toEqual([]);
    const four = migration.items.find((item) => item.number === '4');
    expect(four?.name).toBe('4-fix-the-second-break.md');
    expect(four?.text).toBe(
      [
        '# 4. Fix the second break',
        '',
        '## Shared context (rows 3 to 5)',
        '',
        RANGE_TEXT,
        '',
        '## The row, as it stood at migration',
        '',
        '| # | Task | Status | Model | Lane | Waits on | Files it owns |',
        '|---|---|---|---|---|---|---|',
        '| 4 | Fix the second break | OPEN | Opus | A | — | b.ts |',
        '',
      ].join('\n'),
    );
    expect(migration.items.map((item) => item.number)).toEqual(['4', '5', '9']);
  });

  test('a `DONE` row in the range gets no file and no closed entry of its own', () => {
    expect(migration.items.some((item) => item.number === '3')).toBe(false);
    expect(migration.closed).toEqual([]);
  });

  test('the range section goes whole to the closed archive, so no byte leaves with nowhere to go', () => {
    expect(migration.shared.map((block) => block.id)).toEqual(['3–5']);
    expect(migration.shared[0]?.text.replace(/\n+$/, '')).toBe(RANGE_TEXT);
  });

  test('the board keeps every row and the level-2 prose, and loses the range section', () => {
    expect(parseBoard(migration.board)?.rows.map((row) => row.number)).toEqual([
      '3',
      '4',
      '5',
      '9',
    ]);
    expect(migration.board).not.toContain('The walk found three breaks.');
    expect(migration.board).toContain(
      '## Why each item exists\n\nDated, because an item with no reason gets re-proposed.',
    );
    expect(migration.board).toContain(
      "## Build row 4: the walk's own notes\n\nNotes that are no row's section.\n",
    );
    expect(migration.prose).toEqual([
      '## Why each item exists',
      "## Build row 4: the walk's own notes",
    ]);
  });

  test('an open row with its own section inside a range keeps it, with the shared context after', () => {
    const own = BOARD.replace('### 9. Build the scoped thing', '### 4. Fix the second break');
    const four = migrateFold(own, LEDGER, DATE, 'HANDOFF.md').items.find(
      (item) => item.number === '4',
    );
    expect(four?.text).toBe(
      `# 4. Fix the second break\n\nThe scoped prompt.\n\n## Shared context (rows 3 to 5)\n\n${RANGE_TEXT}\n`,
    );
  });

  test('a row two ranges claim refuses, and nothing is cut', () => {
    const twice = BOARD.replace(
      '### 9. Build',
      '### 4–9. Everything again\n\nMore.\n\n### 9. Build',
    );
    const refused = migrateFold(twice, LEDGER, DATE, 'HANDOFF.md');
    expect(refused.problems).toEqual([
      'row 4 sits in two range sections',
      'row 5 sits in two range sections',
    ]);
    expect(refused.board).toBe(twice);
  });

  test('a hyphen reads as an en dash', () => {
    const hyphen = migrateFold(
      BOARD.replace('### 3–5.', '### 3-5.'),
      LEDGER,
      DATE,
      'HANDOFF.md',
    );
    expect(hyphen.shared.map((block) => block.id)).toEqual(['3–5']);
    expect(hyphen.items.map((item) => item.number)).toEqual(['4', '5', '9']);
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

describe('fold migrate, end to end, with a range heading', () => {
  test(
    'the dry run names the range and the prose; the real run archives the range and reads it back',
    async () => {
      const parent = await tempDir('pc-ranges-');
      const dir = join(parent, 'repo');
      const archive = join(parent, 'archive');
      const home = join(parent, 'home');
      try {
        await Bun.write(join(dir, 'PASSOFF.md'), BOARD);
        await Bun.write(join(dir, 'HANDOFF.md'), LEDGER);
        await Bun.write(
          join(dir, '.personal-config.json'),
          `${JSON.stringify({ archiveHome: archive }, null, 2)}\n`,
        );
        await Bun.write(join(archive, 'INDEX.md'), '# archive — index\n\n## Closed\n');
        await Bun.write(join(home, '.keep'), '');

        const dry = await run(dir, ['fold', 'migrate', '--dry-run'], home);
        expect(dry.code).toBe(0);
        expect(dry.stdout).toContain('range sections, whole to the closed archive');
        expect(dry.stdout).toContain('3–5');
        expect(dry.stdout).toContain("    ## Build row 4: the walk's own notes");
        expect(await readFile(join(dir, 'PASSOFF.md'), 'utf8')).toBe(BOARD);

        const { code } = await run(dir, ['fold', 'migrate', '--force'], home);
        expect(code).toBe(0);
        // `readdir` order is the filesystem's: sorted on macOS, not on Linux (CI).
        expect((await readdir(join(dir, 'passoff'))).sort()).toEqual([
          '4-fix-the-second-break.md',
          '5-fix-the-third-break.md',
          '9-build-the-scoped-thing.md',
        ]);
        expect(await readFile(join(archive, 'PASSOFF-closed.md'), 'utf8')).toContain(
          RANGE_TEXT,
        );
      } finally {
        await cleanup(parent);
      }
    },
    SPAWN_TIMEOUT,
  );
});
