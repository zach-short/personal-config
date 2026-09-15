import type { Finding } from '../../lib/types.ts';
import { type Doc, proseLines, stripMentions } from '../scan.ts';

/**
 * The standard's own test for "adapted": `grep -nE '\{\{'` returns hits only inside Appendix
 * A's table. A token left in place is a bug; `none` written in the slot is information.
 */
export const placeholders = {
  id: 'placeholders',
  standardId: '§0.3',
  appliesTo: (doc: Doc) => doc.kind !== 'other',
  check(doc: Doc): Finding[] {
    const appendixA = doc.text.indexOf('# Appendix A');
    const boilerplate = doc.path.includes('boilerplate');

    return proseLines(doc)
      .filter(({ text }) => /\{\{\w+\}\}/.test(stripMentions(text)))
      .filter(({ line }) => !boilerplate && !inAppendixA(doc, line, appendixA))
      .map(({ text, line }) => ({
        rule: 'placeholders',
        standardId: '§0.3',
        file: doc.path,
        line,
        message: `unfilled placeholder ${stripMentions(text).match(/\{\{\w+\}\}/)?.[0]} outside Appendix A`,
        fixable: false,
      }));
  },
};

function inAppendixA(doc: Doc, line: number, appendixStart: number): boolean {
  if (appendixStart === -1) return false;
  const offset = doc.lines.slice(0, line - 1).join('\n').length;
  return offset >= appendixStart;
}
