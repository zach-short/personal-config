import type { Answers, AnswerValue, WhenSpec } from './types.ts';

/**
 * Whether a question's condition holds for the answers so far. The wizard and `catalog.json`
 * read the same spec through this one function, so the browser cannot ask a question the
 * terminal would skip.
 */
export function matchesWhen(spec: WhenSpec | undefined, answers: Answers): boolean {
  if (spec === undefined) return true;
  if ('never' in spec) return false;
  const actual = answers[spec.key];
  return 'is' in spec ? sameAnswer(actual, spec.is) : !sameAnswer(actual, spec.isNot);
}

/** `undefined` never equals a spec's value — an unasked question has not met a condition. */
function sameAnswer(actual: AnswerValue | undefined, expected: AnswerValue): boolean {
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
    return actual.length === expected.length && actual.every((v, i) => v === expected[i]);
  }
  return actual === expected;
}
