import type { Finding } from '../../lib/types.ts';
import type { Doc } from '../scan.ts';
import { ceilingFrom } from './always-on-weight.ts';
import { unfolded } from './unfolded.ts';

/**
 * `unfolded` asks whether there is dead weight to move out; this asks whether what is left is
 * still too big to read. They differ because folding keeps every step title and every board
 * row: this repo's own ledger was 145,950 characters on 2026-10-13 and a fold would have left
 * 123,774 of them. A ledger past this size is read in part or not at all, and an agent told to
 * read it first spends a third of its runway doing so.
 *
 * 60,000 characters is ~15k tokens. It reuses `unfolded`'s scope (a board or a ledger) rather
 * than restating it, so the two cannot disagree about which files they judge. Override it with
 * the `doctor.ledgerCharCeiling` answer.
 */
export const LEDGER_CHAR_CEILING = 60_000;

export function ledgerFoldCeiling(override: unknown) {
  const ceiling = ceilingFrom(override, LEDGER_CHAR_CEILING);
  return {
    id: 'ledger-fold-ceiling',
    standardId: '§2.1',
    appliesTo: unfolded.appliesTo,
    check(doc: Doc): Finding[] {
      return doc.text.length <= ceiling ? [] : [finding(doc, ceiling)];
    },
  };
}

function finding(doc: Doc, ceiling: number): Finding {
  return {
    rule: 'ledger-fold-ceiling',
    standardId: '§2.1',
    file: doc.path,
    line: 1,
    message: `${doc.text.length} characters, over the ${ceiling} ceiling — run \`personal-config fold ${doc.kind}\`, then archive or shorten what a fold keeps`,
    fixable: false,
  };
}
