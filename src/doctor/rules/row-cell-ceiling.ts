import { type Board, type BoardRow, cellAt, parseBoard } from '../../lib/board.ts';
import type { Finding } from '../../lib/types.ts';
import type { Doc } from '../scan.ts';
import { ceilingFrom } from './always-on-weight.ts';

/**
 * Per-item-board `DESIGN.md` D9: every board cell is one line and at most 200 characters. The
 * table is the part of the board every session reads in full, and ezhomesteading's was 101,016
 * characters in 180 rows on 2026-10-15, 28,610 of them past 200 in some cell (G39). A cell that
 * long is a paragraph, and a paragraph belongs in the item's file.
 *
 * "Files it owns" is exempt (D17): it is the collision check's data, which compares exact paths
 * (G42), and a writer shortening it to fit would trade `src/lib/x.ts` for `src/` and miss the
 * collisions the check exists for.
 *
 * Not fixable: only a person can decide which words leave a cell and where they go. Built per
 * root from the `doctor.rowCellCeiling` answer, the way `ledger-fold-ceiling` is (G38).
 */
export const ROW_CELL_CEILING = 200;

export function rowCellCeiling(override: unknown) {
  const ceiling = ceilingFrom(override, ROW_CELL_CEILING);
  return {
    id: 'row-cell-ceiling',
    standardId: '§2.1',
    appliesTo: (doc: Doc) => doc.kind === 'board',
    check(doc: Doc): Finding[] {
      const board = parseBoard(doc.text);
      if (!board) return [];
      return board.rows.flatMap((row) => rowFindings(doc, board, row, ceiling));
    },
  };
}

function rowFindings(doc: Doc, board: Board, row: BoardRow, ceiling: number): Finding[] {
  const broken = brokenRow(row) ? [finding(doc, row.line, BROKEN)] : [];
  const long = row.cells.flatMap((cell, column) =>
    column === board.columns.files || cell.length <= ceiling
      ? []
      : [finding(doc, row.line, longMessage(board, column, cell.length, ceiling))],
  );
  return [...broken, ...long];
}

/**
 * The table syntax cannot carry a line break, so a cell whose source holds one leaves its row
 * without the closing pipe, and everything after the break is a second line the table does not
 * read. A row that does not end in `|` is the one trace of it left on the row's own line.
 */
function brokenRow(row: BoardRow): boolean {
  return !row.text.trimEnd().endsWith('|');
}

const BROKEN =
  'a cell in this row breaks onto the next line, so the table ends here — one line per row, and the rest belongs in the item file';

function longMessage(board: Board, column: number, length: number, ceiling: number): string {
  const name = cellAt(board.header, column) || `column ${column + 1}`;
  return `"${name}" is ${length} characters, over the ${ceiling} ceiling — move the detail into the item file and keep the cell to one line`;
}

function finding(doc: Doc, line: number, message: string): Finding {
  return {
    rule: 'row-cell-ceiling',
    standardId: '§2.1',
    file: doc.path,
    line,
    message,
    fixable: false,
  };
}
