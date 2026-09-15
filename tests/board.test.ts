import { describe, expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type Board,
  type BoardRow,
  cellAt,
  isEmptyCell,
  parseBoard,
  rowByNumber,
  sharedFiles,
  withStatus,
} from '../src/lib/board.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

const HEADER = '| # | Task | Status | Model | Lane | Waits on | Files it owns |';
const RULE = '|---|------|--------|-------|------|----------|---------------|';

function board(rows: string[], sections: string[] = []): string {
  return ['# PASSOFF', '', HEADER, RULE, ...rows, '', '---', '', ...sections].join('\n');
}

const OPEN_ROW =
  '| 2 | Build the importer | `OPEN` | Deep | A | — (item 1 done) | `src/import.ts` |';
const FLIGHT_ROW =
  '| 3 | Rewrite the parser | `IN FLIGHT` | Default | B | — | `src/import.ts`, `src/cli.ts` |';
const DONE_ROW = '| 1 | Scaffold it | `DONE — HANDOFF 1` | Default | A | — | — |';

const SECTION = ['### 2. Build the importer', '', '*Opened 2026-09-15.*', '', 'Do the thing.'];

/** Throwing beats a non-null assertion: a parse that returned nothing fails as a parse. */
function parsed(text: string): Board {
  const board = parseBoard(text);
  if (!board) throw new Error('no board table in this fixture');
  return board;
}

function firstRow(board: Board): BoardRow {
  const row = board.rows[0];
  if (!row) throw new Error('this fixture has no rows');
  return row;
}

async function repoWith(text: string, config?: string): Promise<string> {
  const dir = await tempDir('pc-board-');
  await mkdir(join(dir, '.git'), { recursive: true });
  await writeFile(join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  await writeFile(join(dir, config === undefined ? 'PASSOFF.md' : 'BOARD.md'), text);
  if (config !== undefined) await writeFile(join(dir, '.personal-config.json'), config);
  return dir;
}

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

describe('parsing the board', () => {
  test('reads every row, and the columns from the header', () => {
    const board_ = parsed(board([DONE_ROW, OPEN_ROW]));
    expect(board_.rows.map((row) => row.number)).toEqual(['1', '2']);
    expect(board_.rows[1]?.status).toBe('OPEN');
    expect(cellAt(board_.rows[1]?.cells ?? [], board_.columns.model)).toBe('Deep');
  });

  test('a table inside a prompt below the board is not part of the board', () => {
    const below = ['### 2. Build it', '', HEADER, RULE, DONE_ROW];
    expect(parsed(board([OPEN_ROW], below)).rows).toHaveLength(1);
  });

  test('a board with no table at all reads as none', () => {
    expect(parseBoard('# PASSOFF\n\nNothing here yet.\n')).toBeNull();
  });

  test('a dash carrying a parenthetical still names nothing', () => {
    expect(isEmptyCell('— (item 1 done, HANDOFF 2)')).toBe(true);
    expect(isEmptyCell('—')).toBe(true);
    expect(isEmptyCell('item 1')).toBe(false);
  });

  test('rewriting the status touches one cell, even when the title says OPEN too', () => {
    const row = '| 4 | Leave the door OPEN | `OPEN` | Deep | A | — | — |';
    const board_ = parsed(board([row]));
    const rewritten = withStatus(firstRow(board_), board_.columns, '`IN FLIGHT`');
    expect(rewritten).toContain('Leave the door OPEN');
    expect(rewritten).toContain('| `IN FLIGHT` |');
    expect(rewritten.split('|')).toHaveLength(row.split('|').length);
  });

  test('two rows naming one file collide, whatever their lanes say', () => {
    expect(sharedFiles('`src/import.ts`', '`src/import.ts`, `src/cli.ts`')).toEqual([
      'src/import.ts',
    ]);
    expect(sharedFiles('`src/a.ts`', '`src/b.ts`')).toEqual([]);
  });

  test('an item is found by the number as written', () => {
    const board_ = parsed(board([DONE_ROW, OPEN_ROW]));
    expect(rowByNumber(board_, '2')?.status).toBe('OPEN');
    expect(rowByNumber(board_, '9')).toBeNull();
  });
});

describe('passoff next', () => {
  test('prints the first OPEN item, its model line and its prompt', async () => {
    const dir = await repoWith(board([DONE_ROW, OPEN_ROW], SECTION));
    try {
      const result = await run(dir, ['passoff', 'next']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('item 2 — Build the importer');
      expect(result.stdout).toContain('Model: Deep');
      expect(result.stdout).toContain('Do the thing.');
      expect(result.stdout).toContain('passoff claim 2');
    } finally {
      await cleanup(dir);
    }
  });

  test('warns when an IN FLIGHT item already owns one of its files', async () => {
    const dir = await repoWith(board([OPEN_ROW, FLIGHT_ROW], SECTION));
    try {
      const result = await run(dir, ['passoff', 'next']);
      expect(result.stdout).toContain('Collision: item 3 is IN FLIGHT and owns src/import.ts');
    } finally {
      await cleanup(dir);
    }
  });

  test('says so when the item has no prompt section to paste', async () => {
    const dir = await repoWith(board([OPEN_ROW]));
    try {
      const result = await run(dir, ['passoff', 'next']);
      expect(result.stdout).toContain('no prompt section');
    } finally {
      await cleanup(dir);
    }
  });

  test('reports what is in flight when nothing is open', async () => {
    const dir = await repoWith(board([DONE_ROW, FLIGHT_ROW]));
    try {
      const result = await run(dir, ['passoff', 'next']);
      expect(result.stdout).toContain('No `OPEN` item');
      expect(result.stdout).toContain('In flight: 3');
    } finally {
      await cleanup(dir);
    }
  });
});

describe('passoff claim', () => {
  test('writes the status and a dated line under the item heading', async () => {
    const dir = await repoWith(board([DONE_ROW, OPEN_ROW], SECTION));
    try {
      const result = await run(dir, ['passoff', 'claim', '2']);
      expect(result.code).toBe(0);
      const after = await Bun.file(join(dir, 'PASSOFF.md')).text();
      expect(after).toContain('| `IN FLIGHT` |');
      expect(after).not.toContain('| `OPEN` |');
      expect(after).toMatch(/> \*\*Claimed `IN FLIGHT` \d{4}-\d{2}-\d{2}\.\*\*/);
    } finally {
      await cleanup(dir);
    }
  });

  test('the claim note lands under the heading, not inside the prompt', async () => {
    const dir = await repoWith(board([OPEN_ROW], SECTION));
    try {
      await run(dir, ['passoff', 'claim', '2']);
      const lines = (await Bun.file(join(dir, 'PASSOFF.md')).text()).split('\n');
      const heading = lines.findIndex((line) => line.startsWith('### 2.'));
      expect(lines.slice(heading, heading + 3).join('\n')).toContain('Claimed');
      expect(lines.at(-1)).toBe('Do the thing.');
    } finally {
      await cleanup(dir);
    }
  });

  test('claiming twice does not add a second note', async () => {
    const dir = await repoWith(board([OPEN_ROW], SECTION));
    try {
      await run(dir, ['passoff', 'claim', '2']);
      const once = await Bun.file(join(dir, 'PASSOFF.md')).text();
      const second = await run(dir, ['passoff', 'claim', '2']);
      expect(second.code).toBe(1);
      expect(second.stdout).toContain('is `IN FLIGHT`');
      expect(await Bun.file(join(dir, 'PASSOFF.md')).text()).toBe(once);
    } finally {
      await cleanup(dir);
    }
  });

  test('refuses an item that is not OPEN, naming its status', async () => {
    const dir = await repoWith(board([DONE_ROW, OPEN_ROW], SECTION));
    try {
      const result = await run(dir, ['passoff', 'claim', '1']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('DONE — HANDOFF 1');
    } finally {
      await cleanup(dir);
    }
  });

  test('refuses a claim that collides with something in flight, and --force takes it anyway', async () => {
    const dir = await repoWith(board([OPEN_ROW, FLIGHT_ROW], SECTION));
    try {
      const refused = await run(dir, ['passoff', 'claim', '2']);
      expect(refused.code).toBe(1);
      expect(refused.stdout).toContain('--force');
      expect(await Bun.file(join(dir, 'PASSOFF.md')).text()).toContain('| `OPEN` |');

      const forced = await run(dir, ['passoff', 'claim', '2', '--force']);
      expect(forced.code).toBe(0);
      expect(await Bun.file(join(dir, 'PASSOFF.md')).text()).not.toContain('| `OPEN` |');
    } finally {
      await cleanup(dir);
    }
  });

  test('--dry-run shows both edits and writes nothing', async () => {
    const dir = await repoWith(board([OPEN_ROW], SECTION));
    try {
      const before = await Bun.file(join(dir, 'PASSOFF.md')).text();
      const result = await run(dir, ['passoff', 'claim', '2', '--dry-run']);
      expect(result.stdout).toContain('+ | 2 | Build the importer | `IN FLIGHT` |');
      expect(result.stdout).toContain('(new)');
      expect(await Bun.file(join(dir, 'PASSOFF.md')).text()).toBe(before);
    } finally {
      await cleanup(dir);
    }
  });

  test('reads the adopted board name rather than assuming PASSOFF.md (§0.2)', async () => {
    const dir = await repoWith(
      board([OPEN_ROW], SECTION),
      JSON.stringify({ boardFile: 'BOARD.md' }),
    );
    try {
      const result = await run(dir, ['passoff', 'next']);
      expect(result.stdout).toContain('BOARD.md'.replace('BOARD.md', 'item 2'));
      expect(result.code).toBe(0);
    } finally {
      await cleanup(dir);
    }
  });

  test('an edited board acquires no stamp — an edit is not a generated file', async () => {
    const dir = await repoWith(board([OPEN_ROW], SECTION));
    try {
      await run(dir, ['passoff', 'claim', '2']);
      const after = await Bun.file(join(dir, 'PASSOFF.md')).text();
      expect(after).not.toContain('personal-config v');
      expect(after.split('\n')[0]).toBe('# PASSOFF');
    } finally {
      await cleanup(dir);
    }
  });

  test('refuses when the repo keeps no board', async () => {
    const dir = await tempDir('pc-board-');
    try {
      const result = await run(dir, ['passoff', 'next']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('PASSOFF.md');
    } finally {
      await cleanup(dir);
    }
  });
});
