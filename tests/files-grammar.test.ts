import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import { filesGrammar } from '../src/doctor/rules/files-grammar.ts';
import type { Doc } from '../src/doctor/scan.ts';
import { cleanup, tempDir, testConfig } from './helpers.ts';

const HEADER = '| # | Task | Status | Model | Lane | Waits on | Files it owns |';
const RULE = '|---|---|---|---|---|---|---|';

function board(...rows: string[]): Doc {
  const text = ['# PASSOFF', '', HEADER, RULE, ...rows].join('\n');
  return {
    path: 'PASSOFF.md',
    kind: 'board',
    text,
    lines: text.split('\n'),
    isTemplate: false,
    ledgerStem: 'HANDOFF',
  };
}

const row = (number: number, status: string, files: string) =>
  `| ${number} | A task | \`${status}\` | Opus 5.5 | A | — | ${files} |`;

describe('files-grammar — a token the collision check cannot compare (row 124)', () => {
  test('violates: a glob, a sentence and a home path, one finding each, at the row', () => {
    const findings = filesGrammar.check(
      board(row(7, 'OPEN', '`src/*.ts`, the land-step skill, `~/.wk/wk.toml`, `src/cli.ts`')),
    );
    expect(findings.map((f) => f.line)).toEqual([5, 5, 5]);
    expect(findings.map((f) => f.message)).toEqual([
      expect.stringContaining('item 7: "Files it owns" token "src/*.ts" is a glob'),
      expect.stringContaining('token "the land-step skill" is not a repository-relative path'),
      expect.stringContaining('token "~/.wk/wk.toml" is not a repository-relative path'),
    ]);
  });

  test('violates: the finding says what the collision check does with the token', () => {
    const [glob, word] = filesGrammar.check(
      board(row(3, 'IN FLIGHT', '`src/*.ts`; new tests')),
    );
    expect(glob?.message).toContain('compares it as a literal string');
    expect(word?.message).toContain('the collision check ignores it');
  });

  test('violates: a `|` inside a cell, reported once for the row by its cell count', () => {
    const findings = filesGrammar.check(board(row(4, 'OPEN', '`a.ts` | `b.ts`')));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("this row has 8 cells to the header's 7");
  });

  test('violates: a brace list is one glob, not two broken tokens', () => {
    const findings = filesGrammar.check(board(row(5, 'OPEN', '`web/{a,b}.tsx`')));
    expect(findings.map((f) => f.message)).toEqual([
      expect.stringContaining('token "web/{a,b}.tsx" is a glob'),
    ]);
  });

  test('every finding is advisory: it reports and never fails the run (decision 17)', () => {
    const findings = filesGrammar.check(board(row(7, 'OPEN', 'whatever we touch')));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.advisory).toBe(true);
  });

  test('passes: files, directories, notes in parentheses, route folders, empty and nothing', () => {
    const doc = board(
      row(
        1,
        'OPEN',
        '`src/lib/board.ts` (`sharedFiles`), `tests/`, `docs/x.md` (As built, P2)',
      ),
      row(2, 'IN FLIGHT', '`web/app/(no-nav)/checkout/`, `go.mod`, `Makefile`'),
      row(3, 'OPEN', '—'),
      row(4, 'OPEN', 'nothing'),
      row(5, 'OPEN', ''),
    );
    expect(filesGrammar.check(doc)).toEqual([]);
  });

  test('passes: a closed row is not read, whatever its cell holds', () => {
    const doc = board(
      `| 1 | Done | \`DONE — 2026-10-16\` | D | A | — | the whole repo |`,
      `| 2 | Held | \`HELD\` | D | A | item 1 | \`src/*.ts\` |`,
    );
    expect(filesGrammar.check(doc)).toEqual([]);
  });
});

describe('doctor runs the rule and stays green on it', () => {
  test('a board with a prose token reports the finding and fails nothing', async () => {
    const dir = await tempDir();
    try {
      await Bun.write(join(dir, 'PASSOFF.md'), board(row(1, 'OPEN', 'the land step')).text);
      const report = await runDoctorOn(dir, {
        standardVersion: '1.0.0',
        config: testConfig(),
      });
      const mine = report.findings.filter((f) => f.rule === 'files-grammar');
      expect(mine).toHaveLength(1);
      expect(mine.every((f) => f.advisory)).toBe(true);
    } finally {
      await cleanup(dir);
    }
  });
});
