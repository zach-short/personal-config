import { describe, expect, test } from 'bun:test';
import { absenceEvidence } from '../src/doctor/rules/absence-evidence.ts';
import type { Doc } from '../src/doctor/scan.ts';

/** R4 — an absence is only a fact when the search that produced it is beside it. */
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

describe('R4 — grep before recording an absence', () => {
  test('violates: "there is no" with nothing beside it', () => {
    const found = absenceEvidence.check(ledger('There is no vision code in this tree.'));
    expect(found).toHaveLength(1);
    expect(found[0]?.standardId).toBe('R4');
  });

  test('violates: "nothing does" with nothing beside it', () => {
    expect(
      absenceEvidence.check(ledger('Nothing does retries on the upload path.')),
    ).toHaveLength(1);
  });

  test('violates: a path citation is not evidence — there is no line to point at', () => {
    const found = absenceEvidence.check(ledger('There is no cache layer (`internal/cache/`).'));
    expect(found).toHaveLength(1);
  });

  test('passes: the grep sits on the same line', () => {
    const text = 'There is no vision code — `grep -rni vision .` returns nothing.';
    expect(absenceEvidence.check(ledger(text))).toHaveLength(0);
  });

  test('passes: the grep sits under a blank line', () => {
    const text =
      'There is no vision code anywhere.\n\nVerified with `git grep -n vision` 2026-09-15.';
    expect(absenceEvidence.check(ledger(text))).toHaveLength(0);
  });

  test('passes: a blockquote is quoting a claim, not making one', () => {
    const text =
      '> A handoff recorded "there is no vision anywhere in the repo". It was wrong.';
    expect(absenceEvidence.check(ledger(text))).toHaveLength(0);
  });

  test('passes: the phrase quoted as a short mention, the way R4 states itself', () => {
    expect(absenceEvidence.check(ledger('R4 governs "there is no X" claims.'))).toHaveLength(0);
  });

  test('passes: a fenced code block is not prose', () => {
    const text = '```sh\necho "there is no spoon"\n```\n';
    expect(absenceEvidence.check(ledger(text))).toHaveLength(0);
  });

  test('passes: a doc with no absence claim at all', () => {
    expect(
      absenceEvidence.check(ledger('Vision runs at `helpers/listing.go:326`.')),
    ).toHaveLength(0);
  });

  test('a doc kind nothing else checks is skipped here too', () => {
    expect(absenceEvidence.appliesTo({ ...ledger('x'), kind: 'other' })).toBe(false);
    expect(absenceEvidence.appliesTo({ ...ledger('x'), kind: 'project' })).toBe(true);
  });
});
