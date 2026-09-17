/**
 * `{ all: [...] }` — the conjunction `WhenSpec` grew for `track-mode`, which is asked only when
 * the target is owned *and* git is in play (setup-tracks `DESIGN.md` D14).
 *
 * This file is a line-for-line pair with the portfolio's `tests/when-all.test.ts`. The browser
 * evaluates its own port of `matchesWhen`, so a form the two sides disagree about is the site
 * asking a question the terminal would skip — the one invariant this machinery exists to hold.
 */
import { describe, expect, test } from 'bun:test';
import type { Answers, WhenSpec } from '../src/lib/types.ts';
import { matchesWhen } from '../src/lib/when.ts';

describe('the conjunction form', () => {
  test('holds only when every member holds', () => {
    const spec: WhenSpec = {
      all: [
        { key: 'owned', isNot: false },
        { key: 'usesGit', is: 'yes' },
      ],
    };

    expect(matchesWhen(spec, { owned: true, usesGit: 'yes' })).toBe(true);
    expect(matchesWhen(spec, { owned: false, usesGit: 'yes' })).toBe(false);
    expect(matchesWhen(spec, { owned: true, usesGit: 'no' })).toBe(false);
    expect(matchesWhen(spec, { owned: false, usesGit: 'no' })).toBe(false);
  });

  /**
   * The live case, and the reason `isNot` is the first member rather than `is`. `owned` is
   * derived from a git remote by `planRepo`, so in a browser — which has no repos — it is
   * `undefined`, and `isNot: false` is what lets the site ask the question anyway.
   */
  test('an `isNot` on an absent key passes, so a derived key does not silence the site', () => {
    const spec: WhenSpec = {
      all: [
        { key: 'owned', isNot: false },
        { key: 'usesGit', is: 'yes' },
      ],
    };

    expect(matchesWhen(spec, { usesGit: 'yes' })).toBe(true);
    expect(matchesWhen(spec, { usesGit: 'no' })).toBe(false);
    // And an absent `is` key still fails: an unasked question has not met a condition.
    expect(matchesWhen(spec, {})).toBe(false);
  });

  test('an empty `all` holds, the way no `when` at all does', () => {
    expect(matchesWhen({ all: [] }, {})).toBe(true);
    expect(matchesWhen({ all: [] }, { owned: false })).toBe(true);
  });

  test('nests, because a member is a spec and not a leaf', () => {
    const spec: WhenSpec = {
      all: [{ key: 'workKind', is: 'code' }, { all: [{ key: 'usesGit', is: 'yes' }] }],
    };

    expect(matchesWhen(spec, { workKind: 'code', usesGit: 'yes' })).toBe(true);
    expect(matchesWhen(spec, { workKind: 'code', usesGit: 'no' })).toBe(false);
    expect(matchesWhen(spec, { workKind: 'non-code', usesGit: 'yes' })).toBe(false);
  });

  test('a `never` inside an `all` still never holds', () => {
    const answers: Answers = { usesGit: 'yes' };
    expect(
      matchesWhen({ all: [{ never: true }, { key: 'usesGit', is: 'yes' }] }, answers),
    ).toBe(false);
  });
});
