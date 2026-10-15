import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { runDoctorOn } from '../src/doctor/index.ts';
import { ROW_CELL_CEILING, rowCellCeiling } from '../src/doctor/rules/row-cell-ceiling.ts';
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

const LONG = 'x'.repeat(ROW_CELL_CEILING + 1);
const RULE_AT_DEFAULT = rowCellCeiling(undefined);

describe('D9 — every cell is one line and at most the ceiling', () => {
  test('violates: a task cell one character over, cited at its row and named by column', () => {
    const findings = RULE_AT_DEFAULT.check(board(`| 1 | ${LONG} | \`OPEN\` | D | A | — | — |`));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(5);
    expect(findings[0]?.message).toContain('"Task" is 201 characters');
  });

  test('violates: one finding per long cell, not one per row', () => {
    const row = `| 1 | ${LONG} | \`OPEN\` | D | A | ${LONG} | — |`;
    expect(RULE_AT_DEFAULT.check(board(row)).map((f) => f.message)).toEqual([
      expect.stringContaining('"Task"'),
      expect.stringContaining('"Waits on"'),
    ]);
  });

  test('violates: a cell that breaks onto a second source line', () => {
    const findings = RULE_AT_DEFAULT.check(
      board(
        '| 1 | A task that runs on | `OPEN` | D | A | — | — |',
        '| 2 | Broken | `OPEN` | D | A',
      ),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('breaks onto the next line');
  });

  test('passes: every cell at the ceiling exactly', () => {
    const exact = 'x'.repeat(ROW_CELL_CEILING);
    expect(RULE_AT_DEFAULT.check(board(`| 1 | ${exact} | \`OPEN\` | D | A | — | — |`))).toEqual(
      [],
    );
  });

  test('passes: "Files it owns" is exempt, however long (D17)', () => {
    const files = Array.from({ length: 20 }, (_, i) => `\`src/lib/module-${i}.ts\``).join(', ');
    expect(files.length).toBeGreaterThan(ROW_CELL_CEILING);
    expect(
      RULE_AT_DEFAULT.check(board(`| 1 | Short | \`OPEN\` | D | A | — | ${files} |`)),
    ).toEqual([]);
  });

  test('the ceiling is the `doctor.rowCellCeiling` answer where one is saved', () => {
    const row = '| 1 | Twelve chars | `OPEN` | D | A | — | — |';
    expect(rowCellCeiling('10').check(board(row))).toHaveLength(1);
    expect(rowCellCeiling('nonsense').check(board(row))).toEqual([]);
  });
});

describe('doctor builds the rule per root from the saved answer', () => {
  test('a repo whose answer raises the ceiling gets no finding', async () => {
    const dir = await tempDir();
    try {
      await Bun.write(
        join(dir, 'PASSOFF.md'),
        board(`| 1 | ${LONG} | \`OPEN\` | D | A | — | — |`).text,
      );
      const rules = async (answer: string | undefined) => {
        const config = testConfig();
        if (answer !== undefined) config.answers['doctor.rowCellCeiling'] = answer;
        const report = await runDoctorOn(dir, { standardVersion: '1.0.0', config });
        return report.findings.map((f) => f.rule);
      };
      expect(await rules(undefined)).toContain('row-cell-ceiling');
      expect(await rules('400')).not.toContain('row-cell-ceiling');
    } finally {
      await cleanup(dir);
    }
  });
});
