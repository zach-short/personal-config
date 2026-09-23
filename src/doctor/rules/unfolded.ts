import { boardFold, DEFAULT_KEEP, type Fold, foldedLines, ledgerFold } from '../../lib/fold.ts';
import type { Finding } from '../../lib/types.ts';
import type { Doc } from '../scan.ts';

/**
 * §2.1 — a prompt rots the moment it is executed, and a ledger step's body stops being read
 * long before its number stops being cited. Both facts were already written down and neither
 * had a consequence: this repo's own board reached 3,901 lines of which 3,794 were prompts for
 * items that had all closed, and its ledger reached 5,168 lines for 77 steps (2026-09-23).
 *
 * The cost is not tidiness, it is Part 5. Those two files were ~168k tokens together — more
 * than half the runway of a Default session before a line of code is read, and past the Deep
 * tier's landing threshold outright. This rule is the thing that notices.
 */
export const unfolded = {
  id: 'unfolded',
  standardId: '§2.1',
  appliesTo: (doc: Doc) => doc.kind === 'board' || doc.kind === 'ledger',
  check(doc: Doc): Finding[] {
    const fold =
      doc.kind === 'board' ? boardFold(doc.text) : ledgerFold(doc.text, DEFAULT_KEEP, '');
    const lines = foldedLines(fold);
    return lines < THRESHOLD ? [] : [finding(doc, fold, lines)];
  },
};

/**
 * One finding per document rather than one per item, and only past a threshold.
 *
 * A rule that fired on the first closed prompt would be wrong about how people work: the item
 * that just landed is usually the context for the one that follows it, and a session should be
 * able to close two or three before anything asks it to tidy up. A rule that fired 55 times on
 * one board would be noise nobody reads, which is the same as not firing.
 *
 * 400 lines is roughly 10k tokens — the point at which the saving is worth a command and a
 * confirm. Below it the fold is real but not yet worth interrupting anyone for.
 */
const THRESHOLD = 400;

function finding(doc: Doc, fold: Fold, lines: number): Finding {
  return {
    rule: 'unfolded',
    standardId: '§2.1',
    file: doc.path,
    line: firstLine(fold),
    message: message(doc, fold, lines),
    fixable: false,
  };
}

function message(doc: Doc, fold: Fold, lines: number): string {
  const what =
    doc.kind === 'board'
      ? `${fold.folded.length} closed prompt(s) still on the board`
      : `${fold.folded.length} step bod(ies) older than the newest ${DEFAULT_KEEP}`;
  return `${what}, ${lines} line(s) — \`personal-config fold ${doc.kind}\` moves them to the archive, keeping every ${doc.kind === 'board' ? 'row' : 'step number, title and date'}`;
}

/** The finding cites where the dead weight starts, which is where a reader should look. */
function firstLine(fold: Fold): number {
  return fold.folded.reduce(
    (first, block) => Math.min(first, block.start),
    Number.MAX_SAFE_INTEGER,
  );
}
