import { describe, expect, test } from 'bun:test';
import { duplicateSteps, ledgerSteps, nextFreeStep } from '../src/lib/ledger.ts';

/**
 * §2.1's step log is written by hand, and four shapes of step heading are in use. Only the first
 * was parsed before 2026-09-17, so a duplicate written in any of the other three was invisible to
 * `doctor` — and `handoff step` would hand out a number the log had already taken, which is the
 * exact failure the "read the file for the next number" rule exists to prevent.
 *
 * A file of its own rather than more cases in `ledger.test.ts`, per X1.
 */

function log(...steps: string[]): string {
  return ['# NOTES', '', '## Step log', '', ...steps].join('\n\n');
}

const BOLD = '**1. Built the thing.** Done 2026-09-15, Default.';
/** The bold stops after the number, so the title is the sentence that follows it. */
const BOLD_NUMBER_ONLY = '**2.** Fixed the parser. Done 2026-09-16, Default.';
const INDENTED = '  **3. Widened the regex.** Done 2026-09-16, Default.';
const LIST_ITEM = '- **4. Chased the flake.** Done 2026-09-17, Default.';

describe('the step log’s four shapes are one kind of thing', () => {
  test('violates: a step whose bold stops after the number is invisible to the parser', () => {
    expect(ledgerSteps(log(BOLD, BOLD_NUMBER_ONLY)).map((s) => s.number)).toEqual([1, 2]);
  });

  test('violates: an indented step is invisible to the parser', () => {
    expect(ledgerSteps(log(BOLD, INDENTED)).map((s) => s.number)).toEqual([1, 3]);
  });

  test('violates: a list-item step is invisible to the parser', () => {
    expect(ledgerSteps(log(BOLD, LIST_ITEM)).map((s) => s.number)).toEqual([1, 4]);
  });

  test('every shape carries its title', () => {
    const steps = ledgerSteps(log(BOLD, BOLD_NUMBER_ONLY, INDENTED, LIST_ITEM));
    expect(steps.map((s) => s.title)).toEqual([
      'Built the thing.',
      'Fixed the parser.',
      'Widened the regex.',
      'Chased the flake.',
    ]);
  });
});

describe('a duplicate is a duplicate whichever shape it is written in', () => {
  test('violates: the repeat is a list item and the first is not', () => {
    const steps = ledgerSteps(log(BOLD, '- **1. Again.** Done 2026-09-16, Default.'));
    expect(duplicateSteps(steps)).toEqual([1]);
  });

  test('violates: `handoff step` would hand out a number an indented step already took', () => {
    expect(nextFreeStep(ledgerSteps(log(BOLD, '  **2. Taken.** Done 2026-09-16.')))).toBe(3);
  });
});

describe('the widening stops where a step stops', () => {
  test('a step quoted inside a fenced block is still not a step', () => {
    const fenced = ['```', '- **9. Pasted from somewhere else.** Done 2026-09-16.', '```'];
    expect(ledgerSteps(log(BOLD, fenced.join('\n')))).toHaveLength(1);
  });

  test('an ordinary numbered list is not a step log', () => {
    expect(ledgerSteps(log(BOLD, '1. Read the ledger.\n2. Append a step.'))).toHaveLength(1);
  });

  test('a bold number mid-sentence is not a step heading', () => {
    expect(ledgerSteps(log(BOLD, 'Carried over from **2. Two.** above.'))).toHaveLength(1);
  });
});
