import { describe, expect, test } from 'bun:test';
import { ledgerFold } from '../src/lib/fold.ts';

/**
 * A step heading is prose, and prose wraps. `ledgerSteps` reads the log line by line, so until
 * 2026-09-23 a title whose bold closed on the second line folded to `**4. ** Done 2026-09-15.`
 * — 18 of this repo's own 58 steps, found the first time it folded itself. The fold's whole
 * claim about the ledger is that it keeps every number, title and date.
 */

const DATE = '2026-09-23';

function logOf(...steps: string[]): string {
  return ['# HANDOFF — example', '', '## Step log', '', ...steps, '## Style rules', ''].join(
    '\n',
  );
}

const WRAPPED = logOf(
  "**1. Closed `doctor`'s coverage gaps, made the hooks parse, and fixed the conventions",
  'catalog.** Done 2026-09-15, Opus 5, commit `abc1234`.',
  'Body line one.',
  '',
  '**2. Did the next thing.** Done 2026-09-16, Opus 5.',
  'Body line two.',
  '',
);

describe('a wrapped step title survives the fold', () => {
  test('the stub rebuilds it as one line, wrap healed', () => {
    const { folded } = ledgerFold(WRAPPED, 0, DATE);
    expect(folded[0]?.stub).toBe(
      "**1. Closed `doctor`'s coverage gaps, made the hooks parse, and fixed the conventions " +
        'catalog.** Done 2026-09-15. Body folded 2026-09-23.',
    );
  });

  test('a title that never wrapped is untouched', () => {
    const { folded } = ledgerFold(WRAPPED, 0, DATE);
    expect(folded[1]?.stub).toBe(
      '**2. Did the next thing.** Done 2026-09-16. Body folded 2026-09-23.',
    );
  });

  test('the trimmed log carries the healed title, not an empty one', () => {
    const { trimmed } = ledgerFold(WRAPPED, 0, DATE);
    expect(trimmed).toContain('conventions catalog.** Done 2026-09-15.');
    expect(trimmed).not.toContain('**1. **');
  });
});

describe('the heading search stays inside the heading', () => {
  /** `**12.** Built it.` closes its bold before the title starts; `PLAIN_TITLE` reads that one. */
  test('a bold that closes after the number still gets its title', () => {
    const { folded } = ledgerFold(
      logOf('**1.** Built the thing. Done 2026-09-15.', 'Body line.', ''),
      0,
      DATE,
    );
    expect(folded[0]?.stub).toBe(
      '**1. Built the thing.** Done 2026-09-15. Body folded 2026-09-23.',
    );
  });

  test('an unclosed bold pulls no body prose into the stub', () => {
    const { folded } = ledgerFold(
      logOf(
        '**1. A heading whose bold never closes. Done 2026-09-15.',
        'Body prose that must not become a title.',
        '',
        'More body **with bold** in it.',
        '',
      ),
      0,
      DATE,
    );
    expect(folded[0]?.stub).not.toContain('Body prose');
    expect(folded[0]?.stub).not.toContain('with bold');
  });
});
