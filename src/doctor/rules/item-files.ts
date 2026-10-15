import { join } from 'node:path';
import { type Board, type BoardRow, parseBoard } from '../../lib/board.ts';
import {
  findItem,
  hasItemsFolder,
  headingNumberOf,
  type ItemContext,
  type ItemEntry,
  isItemName,
  itemNumberOf,
  listItemsSync,
} from '../../lib/items.ts';
import { numberedSection } from '../../lib/markdown.ts';
import type { Finding } from '../../lib/types.ts';
import type { Doc } from '../scan.ts';

/**
 * Per-item-board `DESIGN.md` D11: what only a reader of both the table and the items folder can
 * see. A number in the `#` cell and a number in a file name are two copies of one fact, and two
 * copies drift; this is the one place the drift is detected.
 *
 * Applied to the board, because the board is the one doc that names the folder beside it, and
 * only where that folder exists: a 1.x repo has none, and every rule reads it as it did (D12,
 * BD-5). Built per root because D16's check reads the archive's items folder.
 */
export function itemFiles(context: ItemContext) {
  return {
    id: 'item-files',
    standardId: '§2.1',
    appliesTo: (doc: Doc) =>
      doc.kind === 'board' && doc.itemsDir !== undefined && hasItemsFolder(doc.itemsDir),
    check(doc: Doc): Finding[] {
      const board = parseBoard(doc.text);
      if (!board || doc.itemsDir === undefined) return [];
      const live = listItemsSync(doc.itemsDir);
      const dir = doc.itemsDir;
      return [
        ...live.flatMap((entry) => fileFindings(join(dir, entry.name), entry, board, live)),
        ...board.rows.flatMap((row) => rowFindings(doc, row, live, context.archived)),
      ];
    },
  };
}

/** A file outside the name shape gets that finding alone: its number cannot be trusted. */
function fileFindings(
  path: string,
  entry: ItemEntry,
  board: Board,
  live: ItemEntry[],
): Finding[] {
  if (!isItemName(entry.name)) {
    return [
      finding(path, 1, '`<n>-<slug>.md` is the item file name — a lowercase slug, no spaces'),
    ];
  }
  const number = itemNumberOf(entry.name) ?? '';
  return [
    ...orphan(path, number, board),
    ...duplicate(path, entry, number, live),
    ...headingDisagrees(path, entry, number),
  ];
}

function orphan(path: string, number: string, board: Board): Finding[] {
  if (board.rows.some((row) => row.number === number)) return [];
  return [finding(path, 1, `item ${number} has a file and no row on the board`)];
}

/** Reported on every file after the first, which is the one `findItem` reads. */
function duplicate(
  path: string,
  entry: ItemEntry,
  number: string,
  live: ItemEntry[],
): Finding[] {
  const read = findItem(live, number);
  if (read === null || read.name === entry.name) return [];
  return [
    finding(path, 1, `item ${number} already has a file, ${read.name}, which is the one read`),
  ];
}

function headingDisagrees(path: string, entry: ItemEntry, number: string): Finding[] {
  const heading = headingNumberOf(entry.text);
  if (heading === number) return [];
  return [
    finding(
      path,
      1,
      heading === null
        ? `the first line must be \`# ${number}. <Title>\`, so the number is in the file as well as its name`
        : `the heading says item ${heading} and the name says item ${number}`,
    ),
  ];
}

function rowFindings(
  doc: Doc,
  row: BoardRow,
  live: ItemEntry[],
  archived: ItemEntry[] | null,
): Finding[] {
  if (row.number.trim() === '') return [];
  const file = findItem(live, row.number);
  const section = numberedSection(doc.text, row.number);
  const done = row.status.startsWith('DONE');
  return [
    ...(file === null && section === null && !done
      ? [finding(doc.path, row.line, `item ${row.number} has no file and no section`)]
      : []),
    ...(file !== null && section !== null ? [leftBehind(doc, row, file, section.start)] : []),
    ...(done ? [] : reused(doc, row, archived)),
  ];
}

/** D12: where both exist the file wins, so the section is text nobody reads any more. */
function leftBehind(doc: Doc, row: BoardRow, file: ItemEntry, line: number): Finding {
  return finding(
    doc.path,
    line,
    `item ${row.number} has a file, ${file.name}, so this section is left behind — the file is the one read`,
  );
}

/**
 * D16's hazard is a new row taking a number whose row left the table at a fold. A `DONE` row
 * whose file is archived is the record itself, which `board-status` accepts (D2), not a reuse,
 * so the caller asks this of open rows only.
 */
function reused(doc: Doc, row: BoardRow, archived: ItemEntry[] | null): Finding[] {
  if (archived === null || findItem(archived, row.number) === null) return [];
  return [
    finding(
      doc.path,
      row.line,
      `item ${row.number} is already in the archive — a number is never reused (D16)`,
    ),
  ];
}

function finding(file: string, line: number, message: string): Finding {
  return { rule: 'item-files', standardId: '§2.1', file, line, message, fixable: false };
}
