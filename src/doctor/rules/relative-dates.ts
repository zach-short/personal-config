import type { Finding } from '../../lib/types.ts';
import { type Doc, eachLine, stripMentions } from '../scan.ts';

/**
 * R1 states its own test as one grep, and this is that grep and nothing wider — standard 1.0.2:
 * `grep -niE 'today|yesterday|tomorrow|recently|currently|last (week|month|year)|this (week|month|year)|(days|weeks|months) ago'`.
 * A doc that passes the standard's stated test must not fail here — a gate stricter than the
 * rule it enforces is the worst way for a gate to be wrong, because the doc is correct and the
 * tool says otherwise. On 2026-09-15 this pattern was first narrowed to R1's then-stated grep
 * (board item 6) and then widened again when 1.0.2 widened the test itself (board item 9): the
 * pattern follows the standard, never the other way round.
 */
const PATTERN =
  /\b(today|yesterday|tomorrow|recently|currently|last (?:week|month|year)|this (?:week|month|year)|(?:days|weeks|months) ago)\b/i;

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
