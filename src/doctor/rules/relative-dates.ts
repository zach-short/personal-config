import type { Finding } from '../../lib/types.ts';
import { type Doc, eachLine, stripMentions } from '../scan.ts';

const PATTERN =
  /\b(today|yesterday|tomorrow|recently|last (?:week|month|year)|this (?:week|month|year)|a few days ago|currently)\b/i;

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
