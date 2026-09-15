import { proseLines } from './markdown.ts';

/**
 * The board table (§2.1), parsed once for everyone who reads it.
 *
 * `doctor`'s §2.3 rule and the `passoff` command have to agree about which rows exist and what
 * each one's status is. Two parsers of one table drift, and the drift is silent in the worst
 * direction: a row `passoff` hands out as `OPEN` that the rule never saw at all.
 */

export type BoardColumns = {
  number: number;
  task: number;
  status: number;
  model: number;
  lane: number;
  waitsOn: number;
  files: number;
};

export type BoardRow = {
  cells: string[];
  text: string;
  line: number;
  /** The `#` cell as written, which is a label rather than an integer — `1`, `15`, `1.5`. */
  number: string;
  /** The status cell with the board's backtick typography stripped. */
  status: string;
};

export type Board = { columns: BoardColumns; rows: BoardRow[] };

/**
 * The board is the *first* table under the board's own header, and only the rows touching it.
 * A prompt below the board may carry tables of its own, and reading those as board rows made
 * every one of them an item with no status the moment an unknown status became a finding.
 */
export function parseBoard(markdown: string): Board | null {
  const lines = proseLines(markdown);
  const index = lines.findIndex(({ text }) => isHeaderRow(text));
  const header = lines[index];
  if (!header) return null;

  const columns = headerColumns(header.text);
  const rows: BoardRow[] = [];
  let previous = header.line;

  for (const line of lines.slice(index + 1)) {
    if (line.line !== previous + 1 || !line.text.trimStart().startsWith('|')) break;
    previous = line.line;
    const cells = cellsOf(line.text);
    if (!isSeparator(cells)) rows.push(rowOf(cells, line.text, line.line, columns));
  }
  return { columns, rows };
}

function rowOf(cells: string[], text: string, line: number, columns: BoardColumns): BoardRow {
  return {
    cells,
    text,
    line,
    number: cellAt(cells, columns.number),
    status: stripTypography(cellAt(cells, columns.status)),
  };
}

export function cellAt(cells: string[], column: number): string {
  return column >= 0 ? (cells[column] ?? '') : '';
}

export function cellsOf(text: string): string[] {
  return text
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
}

/** Column positions come from the header, so a board with extra columns still reads correctly. */
function headerColumns(header: string): BoardColumns {
  const names = cellsOf(header).map((c) => c.toLowerCase());
  return {
    number: names.indexOf('#'),
    task: names.indexOf('task'),
    status: names.indexOf('status'),
    model: names.indexOf('model'),
    lane: names.indexOf('lane'),
    waitsOn: names.findIndex((n) => n.startsWith('waits')),
    files: names.findIndex((n) => n.startsWith('files')),
  };
}

function isHeaderRow(text: string): boolean {
  return /\|\s*#\s*\|/.test(text) && /status/i.test(text);
}

/** `` `OPEN` `` and `OPEN` are the same status; the backticks are the board's typography. */
export function stripTypography(cell: string): string {
  return cell.replaceAll('`', '').trim();
}

function isSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

/**
 * A cell that names nothing. Blank and a bare dash are the obvious two; the third is a dash
 * carrying a parenthetical — `— (item 3 done, HANDOFF 6)` — which is how a real board records
 * *why* a row waits on nothing. Reading that as a live blocker made `passoff next` warn that an
 * item was waiting on the note explaining that it was not.
 */
export function isEmptyCell(cell: string | undefined): boolean {
  const value = stripTypography(cell ?? '');
  return value === '' || /^[—-](\s*\(.*\))?$/s.test(value);
}

export function rowByNumber(board: Board, number: string): BoardRow | null {
  return board.rows.find((row) => row.number === number.trim()) ?? null;
}

/**
 * Rewrites one row's status cell and nothing else — same column count, same spacing either side
 * of the text, so the diff a person confirms is one cell wide. The row is rebuilt from its own
 * split rather than from a regex over the line, because a task title is free text and may itself
 * contain the old status word.
 */
export function withStatus(row: BoardRow, columns: BoardColumns, status: string): string {
  const parts = row.text.split('|');
  const target = columns.status + 1;
  const original = parts[target];
  if (original === undefined) return row.text;

  const [, leading = ' ', trailing = ' '] = original.match(/^(\s*).*?(\s*)$/s) ?? [];
  parts[target] = `${leading}${status}${trailing}`;
  return parts.join('|');
}

/**
 * "Files it owns" is the board's collision check (§2.1): two items naming the same file do not
 * run at the same time, whatever their lanes say. The cell is prose — comma-separated paths,
 * often in backticks, sometimes with a trailing clause — so a token is anything that looks like
 * a path, and the comparison is deliberately loose. A false warning costs a glance; a missed
 * collision costs two sessions editing one file.
 */
export function ownedFiles(cell: string): string[] {
  if (isEmptyCell(cell)) return [];
  return cell
    .split(/[,;]/)
    .map((part) => stripTypography(part).trim())
    .filter((part) => part !== '' && /[./]/.test(part));
}

export function sharedFiles(left: string, right: string): string[] {
  const other = new Set(ownedFiles(right));
  return ownedFiles(left).filter((file) => other.has(file));
}
