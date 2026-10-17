import {
  type Board,
  type BoardRow,
  cellAt,
  inFlight,
  type OwnedToken,
  ownedTokens,
  parseBoard,
} from '../../lib/board.ts';
import type { Finding } from '../../lib/types.ts';
import type { Doc } from '../scan.ts';

/**
 * Row 124: a "Files it owns" token the collision check cannot compare, on a row that can still be
 * claimed or is running. `ownedFiles` compares paths by exact string and a trailing `/` as a
 * directory, so a glob, a sentence and a `~/` path collide with nothing, and a `|` inside any cell
 * shifts the row's columns so the check reads the wrong cell. On ezhomesteading's board 106 of
 * 374 tokens were directories, globs or prose on 2026-10-16.
 *
 * Advisory, so it reports and never fails the run (owner decision 17): the standard's text is
 * frozen and names no grammar for the cell, so a board that writes prose there breaks no rule it
 * was given. `DONE` and the other closed rows are skipped, because nothing claims them again.
 * A token is read by `ownedTokens`, the collision check's own reader, so the two cannot disagree.
 */
export const filesGrammar = {
  id: 'files-grammar',
  standardId: '§2.1',
  appliesTo: (doc: Doc) => doc.kind === 'board',
  check(doc: Doc): Finding[] {
    const board = parseBoard(doc.text);
    if (!board || board.columns.files < 0) return [];
    return board.rows
      .filter((row) => row.status === 'OPEN' || inFlight(row.status))
      .flatMap((row) => rowFindings(doc, board, row));
  },
};

function rowFindings(doc: Doc, board: Board, row: BoardRow): Finding[] {
  if (row.cells.length > board.header.length) {
    return [finding(doc, row, pipeMessage(row, board.header.length))];
  }
  return ownedTokens(cellAt(row.cells, board.columns.files))
    .filter((token) => token.kind !== 'path')
    .map((token) => finding(doc, row, tokenMessage(row, token)));
}

/**
 * `cellsOf` splits on every `|`, escaped or inside backticks, so the extra cells are the only
 * trace. The finding cannot name the token, because which cell held the pipe is exactly what
 * the split lost.
 */
function pipeMessage(row: BoardRow, expected: number): string {
  return `item ${row.number}: a \`|\` inside a cell splits it, so this row has ${row.cells.length} cells to the header's ${expected} and the collision check reads the wrong text as "Files it owns" — take the \`|\` out of the row`;
}

function tokenMessage(row: BoardRow, token: OwnedToken): string {
  const what = token.kind === 'glob' ? 'is a glob' : 'is not a repository-relative path';
  const effect = /[./]/.test(token.text)
    ? `${token.kind === 'glob' ? 'does not expand it and ' : ''}compares it as a literal string, so it collides with no file another row names`
    : 'ignores it';
  return `item ${row.number}: "Files it owns" token "${token.text}" ${what}; the collision check ${effect} — name each file, or a directory ending in \`/\``;
}

function finding(doc: Doc, row: BoardRow, message: string): Finding {
  return {
    rule: 'files-grammar',
    standardId: '§2.1',
    file: doc.path,
    line: row.line,
    message,
    fixable: false,
    advisory: true,
  };
}
