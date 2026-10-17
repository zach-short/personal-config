import { describe, expect, test } from 'bun:test';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkUsage, parseCli } from '../src/lib/args.ts';
import { parseBoard } from '../src/lib/board.ts';
import { itemFold, withoutRows } from '../src/lib/fold.ts';
import { LOG_DAYS } from '../src/lib/log.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { stampLine } from '../src/lib/stamp.ts';
import { cleanup, tempDir } from './helpers.ts';
import { FIXTURE_BOARD, FIXTURE_ITEMS, makeItemRepo } from './item-fixture.ts';

/**
 * The fold on a migrated repo (per-item-board `DESIGN.md` D6, D14, D16, D4): a `COMMITTED` item's
 * file and row move to the archive, and old log lines move to the archive's log. The hazard is a live
 * file deleted whose bytes are not in the archive, or a removal `undo` cannot restore, and no
 * gate sees either in an untracked folder. So every end-to-end case below reads bytes.
 */

const CLI = join(repoRoot(), 'src', 'cli.ts');
const SPAWN_TIMEOUT = 30_000;

const ITEM_1 = FIXTURE_ITEMS['1'] ?? { name: '', text: '' };

/** The BD-3 board with item 1 closed: its file is live, so the fold has one item to move. */
const CLOSED_BOARD = FIXTURE_BOARD.replace(
  '| 1 | Write the first thing | `OPEN` |',
  '| 1 | Write the first thing | `COMMITTED, 2026-10-14, a1b2c3d` |',
);

/** The same item built and recorded, and not yet in a commit (§2.3). */
const UNCOMMITTED_BOARD = CLOSED_BOARD.replace(
  '`COMMITTED, 2026-10-14, a1b2c3d`',
  '`DONE, 2026-10-14`',
);

describe('itemFold', () => {
  const listing = Object.values(FIXTURE_ITEMS);

  test('moves a `COMMITTED` row with a live file, with its task cell and its date', () => {
    const moves = itemFold(CLOSED_BOARD, listing);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({
      number: '1',
      task: 'Write the first thing',
      closed: '2026-10-14',
      name: ITEM_1.name,
      text: ITEM_1.text,
    });
  });

  test('item 1 never takes 1.5 or 15, whose names also start with 1', () => {
    const moves = itemFold(CLOSED_BOARD, listing);
    expect(moves.map((move) => move.name)).toEqual([ITEM_1.name]);
  });

  test('a `DONE` row keeps its live file: the code is not in a commit yet', () => {
    expect(itemFold(UNCOMMITTED_BOARD, listing)).toEqual([]);
    expect(
      itemFold(
        CLOSED_BOARD.replace('`COMMITTED, 2026-10-14, a1b2c3d`', '`DONE` — 2026-10-14'),
        listing,
      ),
    ).toEqual([]);
  });

  test('a `DONE` row whose file is already archived has nothing to move', () => {
    expect(itemFold(FIXTURE_BOARD, listing)).toEqual([]);
  });

  test('two live files for one number hold that item rather than orphan one of them', () => {
    const twice = [...listing, { name: '1-write-it-again.md', text: '# 1. Write it again\n' }];
    expect(itemFold(CLOSED_BOARD, twice)).toEqual([]);
  });

  test('a status with no date gives a null date, for the caller to fill', () => {
    const board = CLOSED_BOARD.replace('`COMMITTED, 2026-10-14, a1b2c3d`', '`COMMITTED`');
    expect(itemFold(board, listing)[0]?.closed).toBeNull();
  });
});

describe('withoutRows', () => {
  test('cuts the named rows and keeps every other byte', () => {
    const row = parseBoard(CLOSED_BOARD)?.rows.find((r) => r.number === '1');
    const cut = withoutRows(CLOSED_BOARD, [row?.line ?? 0]);
    expect(parseBoard(cut)?.rows.map((r) => r.number)).toEqual(['1.5', '7', '10', '15']);
    expect(cut).toBe(CLOSED_BOARD.replace(`${row?.text}\n`, ''));
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

/** Every file in a folder, name to bytes, so two snapshots compare as one value. */
async function snapshot(dir: string): Promise<Record<string, string>> {
  const names = (await readdir(dir)).sort();
  const pairs = await Promise.all(
    names.map(async (name) => [name, await readFile(join(dir, name), 'utf8')] as const),
  );
  return Object.fromEntries(pairs);
}

async function closedRepo() {
  const repo = await makeItemRepo();
  const home = await tempDir('pc-home-');
  await writeFile(join(repo.dir, 'PASSOFF.md'), CLOSED_BOARD);
  return {
    ...repo,
    home,
    done: async () => {
      await cleanup(home);
      await repo.done();
    },
  };
}

describe('fold board, on a migrated repo', () => {
  test(
    'writes the file to the archive, indexes it, and only then cuts the row and the file',
    async () => {
      const repo = await closedRepo();
      try {
        const { code } = await run(repo.dir, ['fold', 'board', '--force'], repo.home);
        expect(code).toBe(0);

        expect(await readFile(join(repo.archiveItems, ITEM_1.name), 'utf8')).toBe(ITEM_1.text);
        expect(await Bun.file(join(repo.itemsDir, ITEM_1.name)).exists()).toBe(false);

        const board = await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8');
        expect(parseBoard(board)?.rows.map((r) => r.number)).toEqual(['1.5', '7', '10', '15']);

        const index = await readFile(join(repo.archive, 'INDEX.md'), 'utf8');
        expect(index).toContain(
          `- **passoff/${ITEM_1.name}** ✅ — item 1, Write the first thing, closed 2026-10-14.`,
        );
        expect(index).toMatch(/^- \*\*passoff\/\*\* /m);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'undo after the fold restores the live folder and the board byte for byte',
    async () => {
      const repo = await closedRepo();
      try {
        const before = await snapshot(repo.itemsDir);
        await run(repo.dir, ['fold', 'board', '--force'], repo.home);
        expect(await snapshot(repo.itemsDir)).not.toEqual(before);

        const { code } = await run(repo.dir, ['undo', '--force'], repo.home);
        expect(code).toBe(0);
        expect(await snapshot(repo.itemsDir)).toEqual(before);
        expect(await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8')).toBe(CLOSED_BOARD);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'folding again after undo finds the archive copy identical and moves the item anyway',
    async () => {
      const repo = await closedRepo();
      try {
        await run(repo.dir, ['fold', 'board', '--force'], repo.home);
        await run(repo.dir, ['undo', '--force'], repo.home);
        const { code } = await run(repo.dir, ['fold', 'board', '--force'], repo.home);
        expect(code).toBe(0);
        expect(await Bun.file(join(repo.itemsDir, ITEM_1.name)).exists()).toBe(false);

        const index = await readFile(join(repo.archive, 'INDEX.md'), 'utf8');
        expect(index.split(`**passoff/${ITEM_1.name}**`)).toHaveLength(2);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'an archive copy with different bytes holds the item: file, row and archive untouched',
    async () => {
      const repo = await closedRepo();
      try {
        const other = '# 1. Write the first thing\n\nA different copy.\n';
        await writeFile(join(repo.archiveItems, ITEM_1.name), other);

        const { code, stdout } = await run(repo.dir, ['fold', 'board', '--force'], repo.home);
        expect(code).toBe(0);
        expect(stdout).toContain('different bytes');
        expect(await readFile(join(repo.itemsDir, ITEM_1.name), 'utf8')).toBe(ITEM_1.text);
        expect(await readFile(join(repo.archiveItems, ITEM_1.name), 'utf8')).toBe(other);
        expect(await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8')).toBe(CLOSED_BOARD);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    '--dry-run previews the removal and writes nothing',
    async () => {
      const repo = await closedRepo();
      try {
        const archived = await snapshot(repo.archiveItems);
        const { code, stdout } = await run(repo.dir, ['fold', 'board', '--dry-run'], repo.home);
        expect(code).toBe(0);
        expect(stdout).toContain('removed, 3 lines');
        expect(await readFile(join(repo.itemsDir, ITEM_1.name), 'utf8')).toBe(ITEM_1.text);
        expect(await snapshot(repo.archiveItems)).toEqual(archived);
        expect(await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8')).toBe(CLOSED_BOARD);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'a `DONE` item is left where it is: file, row and archive untouched',
    async () => {
      const repo = await closedRepo();
      try {
        await writeFile(join(repo.dir, 'PASSOFF.md'), UNCOMMITTED_BOARD);
        const archived = await snapshot(repo.archiveItems);
        const { code } = await run(repo.dir, ['fold', 'board', '--force'], repo.home);
        expect(code).toBe(0);
        expect(await readFile(join(repo.itemsDir, ITEM_1.name), 'utf8')).toBe(ITEM_1.text);
        expect(await snapshot(repo.archiveItems)).toEqual(archived);
        expect(await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8')).toBe(UNCOMMITTED_BOARD);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'the archive passes its own index rule after the first item fold',
    async () => {
      const repo = await closedRepo();
      try {
        await run(repo.dir, ['fold', 'board', '--force'], repo.home);
        const { stdout } = await run(repo.dir, ['doctor', repo.archive], repo.home);
        expect(stdout).not.toContain('exists but has no line');
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );
});

describe('what the board fold refuses', () => {
  test(
    'a byte that is not valid UTF-8 fails the read-back: nothing is cut, the live file stays',
    async () => {
      const repo = await closedRepo();
      try {
        const live = join(repo.itemsDir, ITEM_1.name);
        // `caf\xe9`: 0xE9 alone is not UTF-8, so a decoded copy of it is EF BF BD.
        const bytes = Buffer.concat([
          Buffer.from('# 1. Write the first thing\n\ncaf'),
          Buffer.from([0xe9]),
          Buffer.from('\n'),
        ]);
        await writeFile(live, bytes);

        const { code, stdout } = await run(repo.dir, ['fold', 'board', '--force'], repo.home);
        expect(code).toBe(1);
        expect(stdout).toContain('missing 1 block(s)');
        expect((await readFile(live)).equals(bytes)).toBe(true);
        expect(await readFile(join(repo.dir, 'PASSOFF.md'), 'utf8')).toBe(CLOSED_BOARD);
        expect(await readFile(join(repo.archive, 'INDEX.md'), 'utf8')).not.toContain(
          ITEM_1.name,
        );
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  const adapted = stampLine({
    version: '1.0.0',
    date: '2026-10-01',
    configHash: 'abcdef12',
    standardVersion: '1.2.0',
    adapted: true,
  });

  for (const which of ['board', 'index'] as const) {
    test(
      `an adapted ${which} holds the item whole: no file removed, no row cut, no archive copy`,
      async () => {
        const repo = await closedRepo();
        try {
          const target =
            which === 'board' ? join(repo.dir, 'PASSOFF.md') : join(repo.archive, 'INDEX.md');
          const text = `${adapted}\n${await readFile(target, 'utf8')}`;
          await writeFile(target, text);

          const { code, stdout } = await run(repo.dir, ['fold', 'board', '--force'], repo.home);
          expect(code).toBe(1);
          expect(stdout).toContain('Held the item files');
          expect(await readFile(join(repo.itemsDir, ITEM_1.name), 'utf8')).toBe(ITEM_1.text);
          expect(await Bun.file(join(repo.archiveItems, ITEM_1.name)).exists()).toBe(false);
          expect(await readFile(target, 'utf8')).toBe(text);
        } finally {
          await repo.done();
        }
      },
      SPAWN_TIMEOUT,
    );
  }
});

describe('fold ledger, on a migrated ledger', () => {
  test(
    'appends the old log lines to the archive log, cuts them, and undo puts them back',
    async () => {
      const repo = await makeItemRepo();
      const home = await tempDir('pc-home-');
      try {
        const recent = new Date().toISOString().slice(0, 10);
        const ledger = [
          '# HANDOFF',
          '',
          '## Log',
          '',
          '- 2020-01-01 · closed item 3',
          `- ${recent} · closed item 5`,
          '',
          '## Style rules',
          '',
          '- Short sentences.',
          '',
        ].join('\n');
        await writeFile(join(repo.dir, 'HANDOFF.md'), ledger);
        await writeFile(
          join(repo.dir, '.personal-config.json'),
          `${JSON.stringify({ archiveHome: repo.archive, ledgerFrozenAt: 105 })}\n`,
        );

        const { code } = await run(repo.dir, ['fold', 'ledger', '--force'], home);
        expect(code).toBe(0);

        const log = await readFile(join(repo.archive, 'HANDOFF-log.md'), 'utf8');
        expect(log).toContain('- 2020-01-01 · closed item 3');
        expect(log).not.toContain('closed item 5');

        const live = await readFile(join(repo.dir, 'HANDOFF.md'), 'utf8');
        expect(live).not.toContain('2020-01-01');
        expect(live).toContain(`- ${recent} · closed item 5`);
        expect(live).toContain('## Style rules');
        expect(await readFile(join(repo.archive, 'INDEX.md'), 'utf8')).toContain(
          '**HANDOFF-log.md**',
        );

        await run(repo.dir, ['undo', '--force'], home);
        expect(await readFile(join(repo.dir, 'HANDOFF.md'), 'utf8')).toBe(ledger);
      } finally {
        await cleanup(home);
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    '--log-days reaches the ledger fold: a ten-day-old line stays at the default, goes at 5',
    async () => {
      const repo = await makeItemRepo();
      const home = await tempDir('pc-home-');
      try {
        const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
        const ledger = `# HANDOFF\n\n## Log\n\n- ${tenDaysAgo} · closed item 4\n`;
        await writeFile(join(repo.dir, 'HANDOFF.md'), ledger);
        await writeFile(
          join(repo.dir, '.personal-config.json'),
          `${JSON.stringify({ archiveHome: repo.archive, ledgerFrozenAt: 105 })}\n`,
        );

        const kept = await run(repo.dir, ['fold', 'ledger', '--force'], home);
        expect(kept.stdout).toContain(`no log line is older than ${LOG_DAYS} days`);
        expect(await readFile(join(repo.dir, 'HANDOFF.md'), 'utf8')).toBe(ledger);

        const { code } = await run(
          repo.dir,
          ['fold', 'ledger', '--log-days', '5', '--force'],
          home,
        );
        expect(code).toBe(0);
        expect(await readFile(join(repo.dir, 'HANDOFF.md'), 'utf8')).not.toContain(tenDaysAgo);
        expect(await readFile(join(repo.archive, 'HANDOFF-log.md'), 'utf8')).toContain(
          `- ${tenDaysAgo} · closed item 4`,
        );
      } finally {
        await cleanup(home);
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );
});

describe('--log-days on the command line', () => {
  test('is a whole number of days, and defaults to the dial', () => {
    expect(parseCli(['fold', 'ledger', '--log-days', '30']).logDays).toBe(30);
    expect(parseCli(['fold', 'ledger']).logDays).toBe(LOG_DAYS);
    expect(checkUsage(['fold', 'ledger', '--log-days', '30'])).toBeNull();
  });

  test('a value that is not a whole number is refused, not read as the default', () => {
    for (const bad of ['ninety', '1.5']) {
      expect(checkUsage(['fold', 'ledger', '--log-days', bad])).toContain(
        `--log-days needs a whole number of days, not '${bad}'`,
      );
    }
    // `--log-days -3` is refused by `parseArgs` as ambiguous before this check sees it; the
    // `=` form is how a negative value reaches it.
    expect(checkUsage(['fold', 'ledger', '--log-days=-3'])).toContain(
      `--log-days needs a whole number of days, not '-3'`,
    );
  });
});
