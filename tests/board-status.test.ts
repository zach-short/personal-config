import { describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { boardStatus, boardStatusRule } from '../src/doctor/rules/board-status.ts';
import type { Doc } from '../src/doctor/scan.ts';
import { type ItemContext, loadItemContext } from '../src/lib/items.ts';
import {
  FIXTURE_ARCHIVED_ITEM,
  FIXTURE_BOARD,
  type ItemRepo,
  makeItemRepo,
} from './item-fixture.ts';

const HEADER = '| # | Task | Status | Model | Lane | Waits on | Files it owns |';
const RULE = '|---|------|--------|-------|------|----------|---------------|';

function board(...body: string[]): Doc {
  const text = [HEADER, RULE, ...body].join('\n');
  return {
    path: 'PASSOFF.md',
    kind: 'board',
    text,
    lines: text.split('\n'),
    isTemplate: false,
    ledgerStem: 'HANDOFF',
  };
}

function messages(doc: Doc): string[] {
  return boardStatus.check(doc).map((f) => f.message);
}

describe('§2.3 — a status outside the vocabulary', () => {
  test('violates: an invented status word', () => {
    expect(messages(board('| 1 | X | `WIP` | D | A | — | — |'))[0]).toContain(
      'not a status word',
    );
  });

  test('violates: a row with an empty status cell', () => {
    expect(messages(board('| 1 | X |  | D | A | — | — |'))[0]).toContain('carries no status');
  });

  test('violates: the right word in the wrong case — the vocabulary is scanned by grep', () => {
    expect(messages(board('| 1 | X | `Open` | D | A | — | — |'))).toHaveLength(1);
  });

  test('passes: every one of the six', () => {
    const rows = [
      '| 1 | A | `OPEN` | D | A | — | — |',
      '| 2 | B | `IN FLIGHT` | D | A | — | — |',
      '| 3 | C | `DONE — HANDOFF 4` | D | A | — | — |',
      '| 4 | D | `HELD` | D | A | item 1 | — |',
      // The replacement is named outside the title on purpose: a title carrying the word
      // satisfied this check by existing, which `board-status-shapes.test.ts` now pins.
      '| 5 | E | `SUPERSEDED` | — | — | **replaced by item 1** | — |',
    ];
    expect(messages(board(...rows))).toEqual([]);
  });
});

describe('§2.3 — SETTLED AS NO carries its reason', () => {
  const row = '| 4 | Rate-limit the redirect path too | `SETTLED AS NO` | — | — | — | — |';

  test('violates: no paragraph under the board for the item', () => {
    expect(messages(board(row))[0]).toContain('dated paragraph');
  });

  test('violates: a section exists but carries no date', () => {
    const doc = board(
      row,
      '',
      '### 4. Rate-limit the redirect path too',
      '',
      'It costs too much.',
    );
    expect(messages(doc)[0]).toContain('dated paragraph');
  });

  test('violates: a title long enough to satisfy the old character count still fails', () => {
    // The check this replaced stripped dashes and spaces from the rest of the row and asked for
    // twelve characters, which this title alone supplies.
    expect(messages(board(row))).toHaveLength(1);
  });

  test('passes: a dated section below the board names the item', () => {
    const doc = board(
      row,
      '',
      '### 4. Rate-limit the redirect path too',
      '',
      '*Opened 2026-09-06.* **`SETTLED AS NO`, 2026-09-08.** The redirect path makes one read.',
    );
    expect(messages(doc)).toEqual([]);
  });
});

describe('§2.3 — the obligations the status words carry', () => {
  test('violates: DONE with no ledger step', () => {
    expect(messages(board('| 1 | X | `DONE` | D | A | — | — |'))[0]).toContain('ledger step');
  });

  test('violates: HELD with nothing in the waits-on column', () => {
    expect(messages(board('| 1 | X | `HELD` | D | A | — | — |'))[0]).toContain('waits on');
  });

  test('violates: SUPERSEDED naming no replacement', () => {
    expect(messages(board('| 1 | X | `SUPERSEDED` | — | — | — | — |'))[0]).toContain(
      'replaced',
    );
  });
});

describe('the board is the table under the board header, and only that', () => {
  test('passes: a table inside a prompt below the board is not read as board rows', () => {
    const doc = board(
      '| 1 | X | `OPEN` | D | A | — | — |',
      '',
      '### 1. X',
      '',
      '| Stage | Artifact |',
      '|---|---|',
      '| 2 · Scope | `SCOPE.md` |',
    );
    expect(messages(doc)).toEqual([]);
  });

  test('a file with no board header is checked as nothing', () => {
    const text = '# PASSOFF\n\nNo table yet.\n';
    expect(
      boardStatus.check({
        path: 'PASSOFF.md',
        kind: 'board',
        text,
        lines: text.split('\n'),
        isTemplate: false,
        ledgerStem: 'HANDOFF',
      }),
    ).toEqual([]);
  });
});

/**
 * A 2.0.0 board (per-item-board `DESIGN.md` D2, D5): the BD-3 fixture, whose item 7 reads
 * `DONE — 2026-10-15` with its file in the archive. Each case rewrites one row of it.
 */
describe('D2, D5 — DONE on a board with item files', () => {
  async function onFixture(
    rows: Record<string, string>,
    run: (
      check: (context?: Partial<ItemContext>) => Promise<string[]>,
      repo: ItemRepo,
    ) => Promise<void>,
  ): Promise<void> {
    const repo = await makeItemRepo();
    try {
      const text = Object.entries(rows).reduce(
        (board, [from, to]) => board.replace(from, to),
        FIXTURE_BOARD,
      );
      const doc: Doc = {
        path: join(repo.dir, 'PASSOFF.md'),
        kind: 'board',
        text,
        lines: text.split('\n'),
        isTemplate: false,
        ledgerStem: 'HANDOFF',
        itemsDir: repo.itemsDir,
      };
      await run(async (context = {}) => {
        const loaded = await loadItemContext(repo.dir, 'passoff');
        return boardStatusRule({ ...loaded, ...context })
          .check(doc)
          .map((f) => f.message);
      }, repo);
    } finally {
      await repo.done();
    }
  }

  const SEVEN = '| 7 | Close the old thing | `DONE` — 2026-10-15 |';

  test('passes: the fixture, whose DONE row has its file in the archive', async () => {
    await onFixture({}, async (check) => expect(await check()).toEqual([]));
  });

  test('passes: the file still live, with no archive to read', async () => {
    await onFixture({}, async (check, repo) => {
      await Bun.write(
        join(repo.itemsDir, FIXTURE_ARCHIVED_ITEM.name),
        FIXTURE_ARCHIVED_ITEM.text,
      );
      await rm(repo.archiveItems, { recursive: true });
      expect(await check({ archived: null })).toEqual([]);
      expect(await check({ archived: [] })).toEqual([]);
    });
  });

  test('violates: a date whose item has no file, live or archived', async () => {
    await onFixture({}, async (check, repo) => {
      await rm(repo.archiveItems, { recursive: true });
      expect(await check()).toEqual([
        expect.stringContaining("item 7's file, and there is none"),
      ]);
    });
  });

  test('passes: the same row where the archive cannot be read — cannot verify is not missing', async () => {
    await onFixture({}, async (check, repo) => {
      await rm(repo.archiveItems, { recursive: true });
      expect(await check({ archived: null })).toEqual([]);
    });
  });

  test('violates: a date that is not one', async () => {
    await onFixture(
      { [SEVEN]: '| 7 | Close the old thing | `DONE` — 2026-13-40 |' },
      async (check) =>
        expect(await check()).toEqual([expect.stringContaining('is not a date')]),
    );
  });

  test('violates: a DONE with neither a date nor a step names the new shape', async () => {
    await onFixture({ [SEVEN]: '| 7 | Close the old thing | `DONE` |' }, async (check) =>
      expect(await check()).toEqual([expect.stringContaining('`DONE, <date>`')]),
    );
  });

  test('a step at or below the freeze passes without a ledger; one above it does not', async () => {
    const rows = { [SEVEN]: '| 7 | Close the old thing | `DONE — HANDOFF 105` |' };
    await onFixture(rows, async (check) => {
      expect(await check({ ledgerFrozenAt: 105 })).toEqual([]);
      expect(await check({ ledgerFrozenAt: 104 })).toEqual([
        expect.stringContaining('after the log froze at 104'),
      ]);
    });
  });

  test('passes on 1.x as before: no folder, so a bare date is the old finding (D12)', async () => {
    await onFixture({}, async (check, repo) => {
      await rm(repo.itemsDir, { recursive: true });
      expect(await check({ archived: null })).toEqual([
        expect.stringContaining('`DONE` must point at the ledger step'),
      ]);
    });
  });
});

describe('D11 — SETTLED AS NO and SUPERSEDED read the item file', () => {
  async function onRepo(status: string, file: string): Promise<string[]> {
    const repo = await makeItemRepo();
    try {
      const text = FIXTURE_BOARD.replace(
        '| 1 | Write the first thing | `OPEN` |',
        `| 1 | Write the first thing | \`${status}\` |`,
      );
      await Bun.write(join(repo.itemsDir, '1-write-the-first-thing.md'), file);
      const doc: Doc = {
        path: join(repo.dir, 'PASSOFF.md'),
        kind: 'board',
        text,
        lines: text.split('\n'),
        isTemplate: false,
        ledgerStem: 'HANDOFF',
        itemsDir: repo.itemsDir,
      };
      return boardStatusRule(await loadItemContext(repo.dir, 'passoff'))
        .check(doc)
        .map((f) => f.message);
    } finally {
      await repo.done();
    }
  }

  const REASON =
    '*Opened 2026-10-01.* **`SETTLED AS NO`, 2026-10-02.** The first thing costs more than the bug it fixes.';

  test('passes: the dated reason is in the file', async () => {
    expect(await onRepo('SETTLED AS NO', `# 1. Write the first thing\n\n${REASON}\n`)).toEqual(
      [],
    );
  });

  test('violates: the file carries no dated reason', async () => {
    expect(await onRepo('SETTLED AS NO', '# 1. Write the first thing\n\nNo.\n')).toEqual([
      expect.stringContaining('dated paragraph'),
    ]);
  });

  test('passes: SUPERSEDED names its replacement in the file', async () => {
    expect(
      await onRepo('SUPERSEDED', '# 1. Write the first thing\n\nReplaced by item 15.\n'),
    ).toEqual([]);
  });

  test('violates: a title that says "replace" is not a replacement named', async () => {
    const file = '# 1. Replace the first thing\n\nNothing else.\n';
    expect(await onRepo('SUPERSEDED', file)).toEqual([
      expect.stringContaining('what replaced it'),
    ]);
  });
});
