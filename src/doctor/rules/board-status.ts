import { type Board, type BoardRow, cellAt, isEmptyCell, parseBoard } from '../../lib/board.ts';
import { escaped, numberedSection } from '../../lib/markdown.ts';
import type { Finding } from '../../lib/types.ts';
import type { Doc } from '../scan.ts';

/**
 * §2.3 — the status words carry obligations. `DONE` points at the record, `HELD` names what
 * it waits on, `SUPERSEDED` names its replacement, and `SETTLED AS NO` carries its reason,
 * because its whole job is to not be re-proposed.
 *
 * The table itself is parsed by `src/lib/board.ts`, which `passoff` reads through as well.
 */
export const boardStatus = {
  id: 'board-status',
  standardId: '§2.3',
  appliesTo: (doc: Doc) => doc.kind === 'board',
  check(doc: Doc): Finding[] {
    const board = parseBoard(doc.text);
    if (!board) return [];
    return board.rows.flatMap((row) => checkRow(doc, board, row));
  },
};

/** §2.3 — "these words and no others". Only `DONE` carries a tail, and it must. */
const STANDALONE = new Set(['OPEN', 'IN FLIGHT', 'HELD', 'SETTLED AS NO', 'SUPERSEDED']);

function checkRow(doc: Doc, board: Board, row: BoardRow): Finding[] {
  const status = row.status;
  if (!status.startsWith('DONE') && !STANDALONE.has(status)) {
    return [finding(doc, row.line, unknownMessage(status))];
  }

  // The status cell is excluded from `rest`, or `SUPERSEDED` would satisfy its own test.
  const rest = row.cells.filter((_, index) => index !== board.columns.status).join(' ');

  if (status.startsWith('DONE') && !citesLedger(status, doc.ledgerStem)) {
    return [
      finding(
        doc,
        row.line,
        `\`DONE\` must point at the ledger step — write \`DONE — ${doc.ledgerStem} <n>\``,
      ),
    ];
  }
  if (status === 'HELD' && isEmptyCell(cellAt(row.cells, board.columns.waitsOn))) {
    return [
      finding(doc, row.line, '`HELD` must name what it waits on in the "Waits on" column'),
    ];
  }
  if (status === 'SUPERSEDED' && !/supersed|replac/i.test(rest)) {
    return [finding(doc, row.line, '`SUPERSEDED` must name what replaced it')];
  }
  if (status === 'SETTLED AS NO' && !hasDatedReason(doc, row.number)) {
    return [
      finding(
        doc,
        row.line,
        '`SETTLED AS NO` must carry its reason in a dated paragraph below the board, so it is not re-proposed',
      ),
    ];
  }
  return [];
}

function unknownMessage(status: string): string {
  const seen =
    status === '' ? 'this row carries no status' : `\`${status}\` is not a status word`;
  return `${seen} — §2.3 allows OPEN, IN FLIGHT, DONE — <ledger step>, HELD, SETTLED AS NO, SUPERSEDED, and no others`;
}

/**
 * §2.1: an item settled as *no* "stays on the board with its reason". The reason cannot live in
 * the row — the board has no column for one — so it lives in the item's own dated paragraph
 * below the board, and that is what this looks for. The check this replaced counted the
 * characters left in the row after the dashes were stripped, which any title of twelve
 * characters satisfied: it could not fail, and a check that cannot fail reads as evidence when
 * it is none.
 */
function hasDatedReason(doc: Doc, item: string): boolean {
  // No `#` column means no way to find the item's section. Say nothing rather than guess.
  if (item.trim() === '') return true;
  const section = numberedSection(doc.text, item);
  return section !== null && /\d{4}-\d{2}-\d{2}/.test(section.body);
}

/** `DONE — HANDOFF 24`, or the same shape under whatever name §0.2 adopted. */
function citesLedger(status: string, stem: string): boolean {
  return new RegExp(`${escaped(stem)}\\s+\\d+`, 'i').test(status);
}

function finding(doc: Doc, line: number, message: string): Finding {
  return {
    rule: 'board-status',
    standardId: '§2.3',
    file: doc.path,
    line,
    message,
    fixable: false,
  };
}
