import type { Finding } from '../../lib/types.ts';
import { type Doc, eachLine, stripMentions } from '../scan.ts';

/**
 * R1 states its own test as one grep, and this is that grep and nothing wider:
 * `grep -niE 'today|yesterday|recently|last (week|month)|this (week|month)'`. A doc that passes
 * the standard's stated test must not fail here — a gate stricter than the rule it enforces is
 * the worst way for a gate to be wrong, because the doc is correct and the tool says otherwise.
 * `tomorrow`, `last year`, `this year`, `a few days ago` and `currently` were in this pattern
 * until 2026-09-15 and were removed for that reason; widening is R1's side to do, not this
 * file's (raised on board item 9).
 */
const PATTERN = /\b(today|yesterday|recently|last (?:week|month)|this (?:week|month))\b/i;

/**
 * R1 — absolute dates only. These docs are read months later by an agent with no idea when
 * they were written, so "recently" is not vague, it is wrong.
 */
export const relativeDates = {
  id: 'relative-dates',
  standardId: 'R1',
  appliesTo: (doc: Doc) => doc.kind !== 'other',
  check(doc: Doc): Finding[] {
    return eachLine(doc)
      .filter(({ text }) => PATTERN.test(stripMentions(text)))
      .map(({ text, line }) => ({
        rule: 'relative-dates',
        standardId: 'R1',
        file: doc.path,
        line,
        message: `relative date "${stripMentions(text).match(PATTERN)?.[0]}" — use an absolute date (YYYY-MM-DD)`,
        fixable: false,
      }));
  },
};
