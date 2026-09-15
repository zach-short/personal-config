import { describe, expect, test } from 'bun:test';
import { relativeDates } from '../src/doctor/rules/relative-dates.ts';
import type { Doc } from '../src/doctor/scan.ts';

/**
 * R1 states its own test as a grep. These assert the rule matches that grep and nothing wider:
 * a doc that passes the standard must not fail the tool that claims to enforce it.
 */
function ledger(text: string): Doc {
  return {
    path: 'HANDOFF.md',
    kind: 'ledger',
    text,
    lines: text.split('\n'),
    isTemplate: false,
    ledgerStem: 'HANDOFF',
  };
}

const STATED = [
  'today',
  'yesterday',
  'recently',
  'last week',
  'last month',
  'this week',
  'this month',
];
const NOT_STATED = ['tomorrow', 'last year', 'this year', 'a few days ago', 'currently'];

describe('R1 — the rule matches the stated test', () => {
  for (const word of STATED) {
    test(`violates: "${word}" is in R1's grep and is flagged`, () => {
      expect(relativeDates.check(ledger(`We shipped it ${word}.`))).toHaveLength(1);
    });
  }

  for (const word of NOT_STATED) {
    test(`passes: "${word}" is outside R1's grep and is not flagged`, () => {
      expect(relativeDates.check(ledger(`We ship it ${word}.`))).toHaveLength(0);
    });
  }

  test('passes: an absolute date', () => {
    expect(relativeDates.check(ledger('Shipped 2026-09-15.'))).toHaveLength(0);
  });

  test('the message names the word it found', () => {
    const [found] = relativeDates.check(ledger('We fixed it recently.'));
    expect(found?.message).toContain('recently');
    expect(found?.standardId).toBe('R1');
  });
});
