import { describe, expect, test } from 'bun:test';
import { stepNumbers } from '../src/doctor/rules/step-numbers.ts';
import type { Doc } from '../src/doctor/scan.ts';
import { ledgerFold } from '../src/lib/fold.ts';
import { duplicateSteps, ledgerSteps, missingSteps, nextFreeStep } from '../src/lib/ledger.ts';

/**
 * A ledger can be written as a top-level ordered list — `15. **Tiers.** Done …`, the number
 * outside the bold and the body indented under the item. Until 2026-10-02 the parser read only
 * `**15. …**`, so a 66-step log in that form had no steps at all: `fold` said "Nothing to fold"
 * on 4,419 lines, `unfolded` never fired, and `step-numbers` took an indented `**15. …**`
 * sub-item inside step 42's body for the first step and reported "expected 1".
 *
 * The list form is ambiguous in a bold-form ledger, where `1. **Thing.**` is an ordinary
 * numbered list, so a log is read in one form only. A file of its own, per X1.
 */

const LIST_LOG = [
  '# Handoff: example',
  '',
  '## Settled',
  '',
  'Nothing numbered here.',
  '',
  '## Next work, in order',
  '',
  '1. **A test target for the rules engine.** Done 2026-09-08: 71 tests over',
  '   the core types. Every later phase adds tests for what it changes.',
  '2. **The rename: Brick became Anchor.** Done 2026-09-08, because the old',
  '   name was taken.',
  '',
  '   A second paragraph of step 2, still indented under the item.',
  '',
  '3. **The six proposed features: five built, one settled as no.** Items 15–20,',
  '    proposed 2026-09-12.',
  '',
  '    **15. The watch: no.** Asked before any code, and recorded here so it is',
  '    not re-proposed as an oversight.',
  '',
  '    **16. StandBy.** The proposal’s first step was wrong.',
  '',
  '4. **The rules engine as vectors.** Done 2026-09-14.',
  '',
  '## Style rules',
  '',
  'Never edit a step after it lands.',
  '',
].join('\n');

/** A bold-form ledger that uses the list form for what it is in most ledgers: a list. */
const BOLD_LOG = [
  '# Handoff: example',
  '',
  '## Invariants',
  '',
  '1. **Rejected input is never retried.** Settled 2026-09-16.',
  '2. **The gate is the test suite.** Settled 2026-09-16.',
  '',
  '## Step log',
  '',
  '**1. Built the thing.** Done 2026-09-15.',
  '',
  '**2. Reviewed it.** Done 2026-09-16. Findings:',
  '',
  '1. **FIXED — the default grant was too wide.**',
  '2. **FIXED — the rename policy let anyone rename.**',
  '',
].join('\n');

function ledger(text: string): Doc {
  return {
    path: '/tmp/HANDOFF.md',
    kind: 'ledger',
    text,
    lines: text.split('\n'),
    isTemplate: false,
    ledgerStem: 'HANDOFF',
  };
}

describe('a list-form ledger is read as one', () => {
  test('violates: list-form steps were invisible, so the log had no steps at all', () => {
    expect(ledgerSteps(LIST_LOG).map((s) => s.number)).toEqual([1, 2, 3, 4]);
  });

  test('every step carries its title, from the bold that opens the item', () => {
    expect(ledgerSteps(LIST_LOG).map((s) => s.title)).toEqual([
      'A test target for the rules engine.',
      'The rename: Brick became Anchor.',
      'The six proposed features: five built, one settled as no.',
      'The rules engine as vectors.',
    ]);
  });

  test('violates: an indented bold sub-item inside a step’s body was taken for a step', () => {
    const numbers = ledgerSteps(LIST_LOG).map((s) => s.number);
    expect(numbers).not.toContain(15);
    expect(numbers).not.toContain(16);
  });

  test('the step-numbers rule passes on it, where it used to report "expected 1"', () => {
    expect(stepNumbers.check(ledger(LIST_LOG))).toEqual([]);
  });

  test('the step-numbers rule still fires on a list-form duplicate', () => {
    const duplicate = LIST_LOG.replace('4. **The rules engine', '3. **The rules engine');
    expect(duplicateSteps(ledgerSteps(duplicate))).toEqual([3]);
    expect(stepNumbers.check(ledger(duplicate))[0]?.message).toContain(
      'step 3 is already used',
    );
  });

  test('`handoff step` hands out the number after the last list-form step', () => {
    expect(nextFreeStep(ledgerSteps(LIST_LOG))).toBe(5);
    expect(missingSteps(ledgerSteps(LIST_LOG))).toEqual([]);
  });
});

describe('a bold-form ledger keeps reading its lists as lists', () => {
  test('passes: numbered bold lists in the invariants and inside a step are not steps', () => {
    expect(ledgerSteps(BOLD_LOG).map((s) => s.number)).toEqual([1, 2]);
    expect(stepNumbers.check(ledger(BOLD_LOG))).toEqual([]);
  });

  test('a mixed log is read as bold, because a bold line standing alone cannot be a list', () => {
    const mixed = `${LIST_LOG}\n**5. Appended in the other form.** Done 2026-09-20.\n`;
    const steps = ledgerSteps(mixed);
    expect(steps.map((s) => s.number)).toEqual([5]);
    expect(steps.every((s) => s.form === 'bold')).toBe(true);
  });

  test('an indented bold step with no list item above it is still a bold step', () => {
    expect(ledgerSteps('**1. A.** x\n\n  **2. B.** y\n').map((s) => s.number)).toEqual([1, 2]);
  });
});

describe('the fold keeps a list-form log in the list form', () => {
  const DATE = '2026-10-02';

  test('violates: a list-form log had nothing to fold', () => {
    expect(ledgerFold(LIST_LOG, 1, DATE).folded.map((f) => f.id)).toEqual(['1', '2', '3']);
  });

  test('the stub is written as a list item, not as a bold heading', () => {
    const { folded } = ledgerFold(LIST_LOG, 1, DATE);
    expect(folded.map((f) => f.stub)).toEqual([
      '1. **A test target for the rules engine.** Done 2026-09-08. Body folded 2026-10-02.',
      '2. **The rename: Brick became Anchor.** Done 2026-09-08. Body folded 2026-10-02.',
      '3. **The six proposed features: five built, one settled as no.** Done 2026-09-12. Body folded 2026-10-02.',
    ]);
  });

  test('a sub-item is body, so step 3’s block runs to step 4 and takes its sub-items along', () => {
    const block = ledgerFold(LIST_LOG, 1, DATE).folded[2];
    expect(block?.text).toContain('**15. The watch: no.**');
    expect(block?.text).toContain('**16. StandBy.**');
  });

  test('the folded log is still a list-form log with every number, and nothing else moved', () => {
    const { trimmed } = ledgerFold(LIST_LOG, 1, DATE);
    const steps = ledgerSteps(trimmed);
    expect(steps.map((s) => s.number)).toEqual([1, 2, 3, 4]);
    expect(steps.every((s) => s.form === 'list')).toBe(true);
    expect(trimmed).toContain('## Style rules\n\nNever edit a step after it lands.');
  });

  test('a list-form title that wraps onto the next line is healed into the stub', () => {
    const wrapped = [
      '## Next work, in order',
      '',
      '1. **A title long enough that the bold runs onto',
      '   the next line.** Done 2026-09-08.',
      '   Body.',
      '2. **Short.** Done 2026-09-09.',
      '',
    ].join('\n');
    expect(ledgerFold(wrapped, 1, DATE).folded[0]?.stub).toBe(
      '1. **A title long enough that the bold runs onto the next line.** Done 2026-09-08. Body folded 2026-10-02.',
    );
  });
});
