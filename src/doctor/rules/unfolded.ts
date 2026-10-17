import { basename } from 'node:path';
import { parseBoard } from '../../lib/board.ts';
import { today } from '../../lib/date.ts';
import { boardFold, DEFAULT_KEEP, type Fold, foldedLines, ledgerFold } from '../../lib/fold.ts';
import {
  findItem,
  hasItemsFolder,
  type ItemContext,
  listItemsSync,
  UNMIGRATED,
} from '../../lib/items.ts';
import { LOG_DAYS, staleLogLines } from '../../lib/log.ts';
import { isFoldable } from '../../lib/status.ts';
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
 *
 * A 2.0.0 repo has two more things to fold (per-item-board `DESIGN.md` DIAL-8, D4): a
 * `COMMITTED` item's file still in the live folder, and log lines past the retention dial. A
 * `DONE` item's file is not one: its code is not in a commit yet, and the file is the only way
 * to rebuild the work if it is lost before the owner commits it (§2.3), except where no `.git`
 * sits at or above the root: there `DONE` is final and its file is dead weight too (2.2.0). Built
 * per root, because whether the ledger's log is frozen is read from the repo's config and
 * whether git can hold a commit is read from the filesystem.
 */
export function unfoldedRule(context: ItemContext, on: string = today()) {
  return {
    id: 'unfolded',
    standardId: '§2.1',
    appliesTo: (doc: Doc) => doc.kind === 'board' || doc.kind === 'ledger',
    check(doc: Doc): Finding[] {
      return [...foldFindings(doc, context.git), ...itemFindings(doc, context, on)];
    },
  };
}

/** How every repo was read before item files, and how a 1.x one still is (D12). */
export const unfolded = unfoldedRule(UNMIGRATED);

function foldFindings(doc: Doc, git: boolean): Finding[] {
  const fold =
    doc.kind === 'board' ? boardFold(doc.text, git) : ledgerFold(doc.text, DEFAULT_KEEP, '');
  const lines = foldedLines(fold);
  return lines < THRESHOLD ? [] : [finding(doc, firstLine(fold), message(doc, fold, lines))];
}

/**
 * One finding per document, as for the 1.x fold, but with no threshold: a live `COMMITTED` file costs
 * nothing until a session lists the folder, and it is one move to fix, so the finding is cheap
 * (DIAL-8). A log line is the same: it is one line, and ninety days is the dial.
 */
function itemFindings(doc: Doc, context: ItemContext, on: string): Finding[] {
  if (doc.kind === 'board') return closedFilesLive(doc, context.git);
  if (context.ledgerFrozenAt === null) return [];
  const stale = staleLogLines(doc.text, on, LOG_DAYS);
  const first = stale[0];
  if (first === undefined) return [];
  return [
    finding(
      doc,
      first.line,
      `${stale.length} log line(s) older than ${LOG_DAYS} days — \`personal-config fold ledger\` moves them to the archive's log`,
    ),
  ];
}

function closedFilesLive(doc: Doc, git: boolean): Finding[] {
  const board = parseBoard(doc.text);
  if (!board || doc.itemsDir === undefined || !hasItemsFolder(doc.itemsDir)) return [];
  const live = listItemsSync(doc.itemsDir);
  const done = board.rows.filter(
    (row) => isFoldable(row.status, git) && findItem(live, row.number) !== null,
  );
  const first = done[0];
  if (first === undefined) return [];
  return [
    finding(
      doc,
      first.line,
      `${done.length} ${git ? '`COMMITTED`' : 'closed'} item file(s) still in ${basename(doc.itemsDir)}/ (${done.map((row) => row.number).join(', ')}) — \`personal-config fold board\` moves them to the archive`,
    ),
  ];
}

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

function finding(doc: Doc, line: number, message: string): Finding {
  return {
    rule: 'unfolded',
    standardId: '§2.1',
    file: doc.path,
    line,
    message,
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
