import { describe, expect, test } from 'bun:test';
import { boardStatus } from '../src/doctor/rules/board-status.ts';
import type { Doc } from '../src/doctor/scan.ts';

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
      '| 5 | E — superseded by item 1 | `SUPERSEDED` | — | — | — | — |',
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
