import type { Finding } from '../../lib/types.ts';
import { type Doc, proseLines, stripMentions } from '../scan.ts';

/** R4's own two phrasings, and no others — the same reason `relative-dates` stays narrow. */
const ABSENCE = /\b(there is no|nothing does)\b/i;

/**
 * An absence cannot be evidenced by a `file:line`: there is no line to point at. The only
 * evidence R4 accepts is the search that came back empty, so this looks for a backticked span
 * naming a search or a query. The list is deliberately short — a span with no recognisable
 * command in it is a citation, and a citation is what R4 says is not enough.
 */
const EVIDENCE =
  /`[^`]*\b(grep|rg|ripgrep|ag|ast-grep|find|git|ls|select|query|psql|sqlite3)\b[^`]*`/i;

/**
 * R4 — grep before recording an absence. "Nothing does X" is the most expensive kind of wrong
 * claim, because everything downstream is built on it: repo A's handoff recorded that vision
 * was nowhere in the tree while it was live the whole time.
 */
export const absenceEvidence = {
  id: 'absence-evidence',
  standardId: 'R4',
  appliesTo: (doc: Doc) => doc.kind !== 'other',
  check(doc: Doc): Finding[] {
    return proseLines(doc)
      .filter(({ text }) => !isQuotation(text))
      .filter(({ text }) => ABSENCE.test(stripMentions(text)))
      .filter(
        ({ text, line }) => !EVIDENCE.test(text) && !EVIDENCE.test(nextNonEmpty(doc, line)),
      )
      .map(({ text, line }) => ({
        rule: 'absence-evidence',
        standardId: 'R4',
        file: doc.path,
        line,
        message: `"${stripMentions(text).match(ABSENCE)?.[0]}" with no search beside it — R4 asks for the grep or query that produced the absence`,
        fixable: false,
      }));
  },
};

/**
 * A blockquote is quoting a claim, and in these docs it is usually a wrong one being corrected
 * — the standard's own worked examples quote "there is no vision anywhere in the repo" in order
 * to say it was false. The grep belongs with the claim, never with the quotation of it.
 */
function isQuotation(text: string): boolean {
  return text.trimStart().startsWith('>');
}

/**
 * The next line with anything on it, not the next line, so a claim whose grep sits under a
 * blank line still counts. Leniency is the safe direction for a new gate: a false positive is
 * what makes someone stop running it.
 */
function nextNonEmpty(doc: Doc, line: number): string {
  return doc.lines.slice(line).find((text) => text.trim() !== '') ?? '';
}
