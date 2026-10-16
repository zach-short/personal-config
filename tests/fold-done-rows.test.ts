import { describe, expect, test } from 'bun:test';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseBoard } from '../src/lib/board.ts';
import { itemFold, type RowRecord, rowFold } from '../src/lib/fold.ts';
import { type ItemEntry, isItemFor, listItems, nextFreeItem } from '../src/lib/items.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { stampLine } from '../src/lib/stamp.ts';
import { cleanup, tempDir } from './helpers.ts';

/**
 * `fold board` on a migrated board, for a `DONE` row with no item file (per-item-board
 * `DESIGN.md` D18, board item 107). Such a row was closed under 1.x and has nothing to move, so
 * the fold writes it a file in the archive, reads it back, and only then cuts it. The hazard is a
 * row that leaves the table with no copy, or a copy that differs from the row by a byte, with
 * exit 0. So every end-to-end case below reads the archive and the board back.
 *
 * The board is `tests/fold-migrate-ranges.test.ts`'s, with a `DONE` row that has no section
 * (2), one whose prompt is a closed section (7), and a ledger long enough for the steps they cite.
 */

const CLI = join(repoRoot(), 'src', 'cli.ts');
const SPAWN_TIMEOUT = 30_000;

const BOARD = `# Board

| # | Task | Status | Model | Lane | Waits on | Files it owns |
|---|------|--------|-------|------|----------|---------------|
| 2 | Set up the first thing | DONE — HANDOFF 1 | Opus | A | — | z.ts |
| 3 | Fix the first break | DONE — HANDOFF 4 | Opus | A | — | a.ts |
| 4 | Fix the second break | OPEN | Opus | A | — | b.ts |
| 5 | Fix the third break | HELD | Opus | A | item 4 | c.ts |
| 7 | Ship the old thing | DONE, HANDOFF 2 + 3: shipped | Opus | B | — | e.ts |
| 9 | Build the scoped thing | OPEN | Opus | B | — | d.ts |

## Why each item exists

Dated, because an item with no reason gets re-proposed.

### 3–5. Breaks found by the walk, 2026-10-04

The walk found three breaks. Every row is a lead.

### 7. Ship the old thing

The old prompt.

### 9. Build the scoped thing

The scoped prompt.
`;

const LEDGER = `# Ledger

## Step log

**1. Set it up.** Done 2026-10-01.

**2. Shipped part one.** Done 2026-10-02.

**3. Shipped part two.** Done 2026-10-03.

**4. Fixed the break.** Done 2026-10-04.
`;

const HEADER = [
  '| # | Task | Status | Model | Lane | Waits on | Files it owns |',
  '|---|---|---|---|---|---|---|',
];

/** Row 2's archive file, whole: a row with no section and one cited step. */
const ROW_2_FILE = [
  '# 2. Set up the first thing',
  '',
  'This row closed before the board kept one file per item, so it had no file of its own.',
  '`personal-config fold board` wrote this file when the row left the table.',
  '',
  '## The row, as it stood when it left the table',
  '',
  ...HEADER,
  '| 2 | Set up the first thing | DONE — HANDOFF 1 | Opus | A | — | z.ts |',
  '',
  '## Where its record is',
  '',
  "- Ledger step 1: the archive's `HANDOFF-log.md`.",
  "- The archive's `PASSOFF-closed.md` has no section for it.",
  '',
].join('\n');

const RECORD: RowRecord = {
  ledger: 'HANDOFF.md',
  frozenAt: null,
  closedName: 'PASSOFF-closed.md',
  closed: '',
};

describe('rowFold', () => {
  const rowLine = (n: string) =>
    parseBoard(BOARD)?.rows.find((row) => row.number === n)?.text ?? '';

  test('takes every `DONE` row with no file, and no open row', () => {
    expect(rowFold(BOARD, [], [], RECORD).map((row) => row.number)).toEqual(['2', '3', '7']);
  });

  test('a row with a live file is the item move, not this', () => {
    const live: ItemEntry[] = [{ name: '3-fix-the-first-break.md', text: '# 3.\n' }];
    expect(rowFold(BOARD, live, [], RECORD).map((row) => row.number)).toEqual(['2', '7']);
  });

  test('a number the archive holds under another file is left on the table', () => {
    const archived: ItemEntry[] = [{ name: '2-set-up-the-first-thing.md', text: 'other\n' }];
    expect(rowFold(BOARD, [], archived, RECORD).map((row) => row.number)).toEqual(['3', '7']);
  });

  test('the archive holding this very file, after `undo`, folds it again', () => {
    const [two] = rowFold(BOARD, [], [], RECORD);
    const archived: ItemEntry[] = [{ name: two?.name ?? '', text: two?.text ?? '' }];
    expect(rowFold(BOARD, [], archived, RECORD).map((row) => row.number)).toEqual([
      '2',
      '3',
      '7',
    ]);
  });

  test('a number on two rows is left alone: one file cannot hold both', () => {
    const twice = BOARD.replace('| 3 | Fix the first break |', '| 2 | Fix the first break |');
    expect(rowFold(twice, [], [], RECORD).map((row) => row.number)).toEqual(['7']);
  });

  test('the row line is copied byte for byte, and the cells go to the index', () => {
    const seven = rowFold(BOARD, [], [], RECORD).find((row) => row.number === '7');
    expect(seven?.text.split('\n').filter((line) => line === rowLine('7'))).toHaveLength(1);
    expect(seven?.task).toBe('Ship the old thing');
    expect(seven?.status).toBe('DONE, HANDOFF 2 + 3: shipped');
    expect(seven?.name).toBe('7-ship-the-old-thing.md');
  });

  test('steps joined by `+` or `and` are each named; an unfrozen ledger is the live file', () => {
    const board = BOARD.replace('DONE — HANDOFF 1 |', 'DONE, HANDOFF step 12 and 13 |');
    const two = rowFold(board, [], [], { ...RECORD, frozenAt: 12 }).find(
      (r) => r.number === '2',
    );
    expect(two?.text).toContain("- Ledger step 12: the archive's `HANDOFF-log.md`.\n");
    expect(two?.text).toContain('- Ledger step 13: `HANDOFF.md`.\n');
    const seven = rowFold(BOARD, [], [], RECORD).find((row) => row.number === '7');
    expect(seven?.text).toContain(
      '- Ledger step 2: `HANDOFF.md`.\n- Ledger step 3: `HANDOFF.md`.',
    );
  });

  test('a status that cites no step says so', () => {
    const board = BOARD.replace('DONE — HANDOFF 1 |', 'DONE (re-verified 2026-10-04) |');
    const two = rowFold(board, [], [], RECORD).find((row) => row.number === '2');
    expect(two?.text).toContain('- Its status cell names no ledger step.\n');
  });
});

/** Spawns the real CLI, with `$HOME` (where backups live) in a temp directory. */
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

type Repo = {
  dir: string;
  archive: string;
  home: string;
  board: string;
  itemsDir: string;
  archiveItems: string;
  done: () => Promise<void>;
};

/**
 * The fixture migrated by the real `fold migrate`, then row 9 closed the 2.0.0 way, so the board
 * holds both shapes of `DONE` row: three 1.x rows with no file, and one with a live file.
 */
async function migratedRepo(): Promise<Repo> {
  const parent = await tempDir('pc-done-rows-');
  const dir = join(parent, 'repo');
  const archive = join(parent, 'archive');
  const home = join(parent, 'home');
  await Bun.write(join(dir, 'PASSOFF.md'), BOARD);
  await Bun.write(join(dir, 'HANDOFF.md'), LEDGER);
  await Bun.write(
    join(dir, '.personal-config.json'),
    `${JSON.stringify({ archiveHome: archive }, null, 2)}\n`,
  );
  await Bun.write(join(archive, 'INDEX.md'), '# archive — index\n\n## Closed\n');
  await mkdir(home, { recursive: true });
  const migrated = await run(dir, ['fold', 'migrate', '--force'], home);
  if (migrated.code !== 0) throw new Error(migrated.stdout);

  const boardPath = join(dir, 'PASSOFF.md');
  const closed = (await readFile(boardPath, 'utf8')).replace(
    '| 9 | Build the scoped thing | OPEN |',
    '| 9 | Build the scoped thing | DONE — 2026-10-16 |',
  );
  await writeFile(boardPath, closed);
  return {
    dir,
    archive,
    home,
    board: closed,
    itemsDir: join(dir, 'passoff'),
    archiveItems: join(archive, 'passoff'),
    done: () => cleanup(parent),
  };
}

/** Where each number is: the table, the live folder, the archive folder. */
async function placesOf(repo: Repo, numbers: string[]): Promise<Record<string, string[]>> {
  const board = parseBoard(await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8'));
  const live = await listItems(repo.itemsDir);
  const archived = await listItems(repo.archiveItems);
  const places: Record<string, string[]> = {};
  for (const n of numbers) {
    places[n] = [
      ...(board?.rows.filter((row) => row.number === n).map(() => 'table') ?? []),
      ...live.filter((entry) => isItemFor(entry.name, n)).map(() => 'live'),
      ...archived.filter((entry) => isItemFor(entry.name, n)).map(() => 'archive'),
    ];
  }
  return places;
}

async function nextFree(repo: Repo): Promise<number> {
  const board = parseBoard(await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8'));
  return nextFreeItem(
    board?.rows.map((row) => row.number) ?? [],
    await listItems(repo.itemsDir),
    await listItems(repo.archiveItems),
  );
}

async function sorted(dir: string): Promise<string[]> {
  return (await readdir(dir).catch(() => [])).sort();
}

describe('itemFold, two rows for one number', () => {
  test('moves neither, so no row is cut with its line in no archive file', () => {
    const board = BOARD.replace(
      '| 9 | Build the scoped thing | OPEN |',
      '| 9 | Build the scoped thing | DONE — 2026-10-16 |\n| 9 | Build it again | DONE — 2026-10-16 |',
    );
    const live: ItemEntry[] = [{ name: '9-build-the-scoped-thing.md', text: '# 9.\n' }];
    expect(itemFold(board, live)).toEqual([]);
  });
});

describe('fold board, a migrated board with 1.x `DONE` rows', () => {
  test(
    'each `DONE` row ends in the archive once, open rows stay, the next number stays',
    async () => {
      const repo = await migratedRepo();
      try {
        const before = parseBoard(repo.board)?.rows ?? [];
        const nine = await readFile(join(repo.itemsDir, '9-build-the-scoped-thing.md'));
        const four = await readFile(join(repo.itemsDir, '4-fix-the-second-break.md'));
        const free = await nextFree(repo);

        const { code } = await run(repo.dir, ['fold', 'board', '--force'], repo.home);
        expect(code).toBe(0);

        const board = await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8');
        expect(parseBoard(board)?.rows.map((row) => row.text)).toEqual(
          before.filter((row) => ['4', '5'].includes(row.number)).map((row) => row.text),
        );
        expect(await placesOf(repo, ['2', '3', '4', '5', '7', '9'])).toEqual({
          '2': ['archive'],
          '3': ['archive'],
          '4': ['table', 'live'],
          '5': ['table', 'live'],
          '7': ['archive'],
          '9': ['archive'],
        });
        expect(await nextFree(repo)).toBe(free);

        expect(
          await readFile(join(repo.archiveItems, '2-set-up-the-first-thing.md'), 'utf8'),
        ).toBe(ROW_2_FILE);
        for (const n of ['3', '7']) {
          const row = before.find((r) => r.number === n);
          const [name] = (await sorted(repo.archiveItems)).filter((f) => isItemFor(f, n));
          const text = await readFile(join(repo.archiveItems, name ?? ''), 'utf8');
          expect(text.split('\n').filter((line) => line === row?.text)).toHaveLength(1);
        }
        expect(
          (await readFile(join(repo.archiveItems, '9-build-the-scoped-thing.md'))).equals(nine),
        ).toBe(true);
        expect(
          (await readFile(join(repo.itemsDir, '4-fix-the-second-break.md'))).equals(four),
        ).toBe(true);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'each file points at its step in the archive log and at its section in the closed archive',
    async () => {
      const repo = await migratedRepo();
      try {
        await run(repo.dir, ['fold', 'board', '--force'], repo.home);
        const three = await readFile(
          join(repo.archiveItems, '3-fix-the-first-break.md'),
          'utf8',
        );
        expect(three).toContain(
          [
            "- Ledger step 4: the archive's `HANDOFF-log.md`.",
            "- The section that opens `### 3–5.` in the archive's `PASSOFF-closed.md`.",
          ].join('\n'),
        );
        const seven = await readFile(
          join(repo.archiveItems, '7-ship-the-old-thing.md'),
          'utf8',
        );
        expect(seven).toContain(
          "- The section that opens `### 7.` in the archive's `PASSOFF-closed.md`.",
        );
        const closed = await readFile(join(repo.archive, 'PASSOFF-closed.md'), 'utf8');
        expect(closed).toContain('### 7. Ship the old thing\n\nThe old prompt.');

        const index = await readFile(join(repo.archive, 'INDEX.md'), 'utf8');
        expect(index).toMatch(
          /^- \*\*passoff\/7-ship-the-old-thing\.md\*\* ✅ — item 7, Ship the old thing, DONE, HANDOFF 2 \+ 3: shipped, folded \d{4}-\d{2}-\d{2}\.$/m,
        );
        expect(index).toContain(
          '- **passoff/9-build-the-scoped-thing.md** ✅ — item 9, Build the scoped thing, closed 2026-10-16.',
        );
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    '--dry-run writes nothing',
    async () => {
      const repo = await migratedRepo();
      try {
        const archived = await sorted(repo.archiveItems);
        const index = await readFile(join(repo.archive, 'INDEX.md'), 'utf8');
        const { code, stdout } = await run(repo.dir, ['fold', 'board', '--dry-run'], repo.home);
        expect(code).toBe(0);
        expect(stdout).toContain('3 row(s) with no file');
        expect(await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8')).toBe(repo.board);
        expect(await sorted(repo.archiveItems)).toEqual(archived);
        expect(await readFile(join(repo.archive, 'INDEX.md'), 'utf8')).toBe(index);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'undo puts every row back; folding again writes no second copy and no second index line',
    async () => {
      const repo = await migratedRepo();
      try {
        await run(repo.dir, ['fold', 'board', '--force'], repo.home);
        const written = await readFile(join(repo.archiveItems, '2-set-up-the-first-thing.md'));

        expect((await run(repo.dir, ['undo', '--force'], repo.home)).code).toBe(0);
        expect(await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8')).toBe(repo.board);

        expect((await run(repo.dir, ['fold', 'board', '--force'], repo.home)).code).toBe(0);
        expect(
          parseBoard(await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8'))?.rows,
        ).toHaveLength(2);
        expect(
          (await readFile(join(repo.archiveItems, '2-set-up-the-first-thing.md'))).equals(
            written,
          ),
        ).toBe(true);
        const index = await readFile(join(repo.archive, 'INDEX.md'), 'utf8');
        expect(index.split('**passoff/2-set-up-the-first-thing.md**')).toHaveLength(2);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'an archive file for the row with other text leaves the row, and the file, as they were',
    async () => {
      const repo = await migratedRepo();
      try {
        const path = join(repo.archiveItems, '2-set-up-the-first-thing.md');
        await mkdir(repo.archiveItems, { recursive: true });
        await writeFile(path, '# 2. Set up the first thing\n\nAnother copy.\n');

        const { code } = await run(repo.dir, ['fold', 'board', '--force'], repo.home);
        expect(code).toBe(0);
        expect(await readFile(path, 'utf8')).toBe(
          '# 2. Set up the first thing\n\nAnother copy.\n',
        );
        const board = await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8');
        const row = parseBoard(repo.board)?.rows.find((r) => r.number === '2');
        expect(parseBoard(board)?.rows.find((r) => r.number === '2')?.text).toBe(row?.text);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'a board byte that is not UTF-8 refuses the fold: exit 1, board and archive as they were',
    async () => {
      const repo = await migratedRepo();
      try {
        const path = join(repo.dir, 'PASSOFF.md');
        const [head, tail] = repo.board.split('Set up the first thing |');
        const bytes = Buffer.concat([
          Buffer.from(`${head}Set up the first `),
          Buffer.from([0xff]),
          Buffer.from(`thing |${tail}`),
        ]);
        await writeFile(path, bytes);
        const archived = await sorted(repo.archiveItems);

        const proc = Bun.spawn(['bun', 'run', CLI, 'fold', 'board', '--force'], {
          cwd: repo.dir,
          env: { ...process.env, HOME: repo.home },
          stdout: 'pipe',
          stderr: 'pipe',
        });
        const stderr = await new Response(proc.stderr).text();
        expect(await proc.exited).toBe(1);
        expect(stderr).toContain('not valid UTF-8');
        expect((await readFile(path)).equals(bytes)).toBe(true);
        expect(await sorted(repo.archiveItems)).toEqual(archived);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'an adapted board holds the rows whole: no archive file, no row cut, exit 1',
    async () => {
      const repo = await migratedRepo();
      try {
        const adapted = stampLine({
          version: '1.0.0',
          date: '2026-10-01',
          configHash: 'abcdef12',
          standardVersion: '1.2.0',
          adapted: true,
        });
        const text = `${adapted}\n${repo.board}`;
        await writeFile(join(repo.dir, 'PASSOFF.md'), text);
        const archived = await sorted(repo.archiveItems);

        const { code, stdout } = await run(repo.dir, ['fold', 'board', '--force'], repo.home);
        expect(code).toBe(1);
        expect(stdout).toContain('Held the item files');
        expect(await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8')).toBe(text);
        expect(await sorted(repo.archiveItems)).toEqual(archived);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );
});
