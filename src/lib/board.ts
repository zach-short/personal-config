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

/**
 * `header` is the header row's cells as written, so a rule that reports a cell can name its
 * column (`row-cell-ceiling`, per-item-board `DESIGN.md` D9) without a second parse of the table.
 */
export type Board = { columns: BoardColumns; header: string[]; rows: BoardRow[] };

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
  return { columns, header: cellsOf(header.text), rows };
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
 *
 * What counts as a token is `ownedTokens`'s answer, so `doctor`'s `files-grammar` rule reports
 * against the same reading the collision check makes (row 124). Every token the old split kept
 * whole is still kept, so a pair that collided on one before still collides.
 */
export function ownedFiles(cell: string): string[] {
  return ownedTokens(cell)
    .filter((token) => token.kind === 'path' || /[./]/.test(token.text))
    .map((token) => token.text);
}

/**
 * A token the collision check can compare (`path`, with a trailing `/` for a directory), one it
 * cannot (`glob`, `prose`), and why. A path is repository-relative: no leading `/` or `~`, no
 * `.` or `..` segment. Its characters are the ones row 124 named — letters, digits, `.`, `_`,
 * `-`, `/` — plus the four route-folder ones, `(`, `)`, `[`, `]`, and `@` and `+`, because
 * ezhomesteading's board names `web/app/(no-nav)/checkout/`, a real Next.js path, and an exact
 * comparison handles them as well as any other character.
 */
export type OwnedToken = { text: string; kind: 'path' | 'glob' | 'prose' };

const SEGMENT = /^[A-Za-z0-9._()[\]@+-]+$/;

/**
 * The cell split on `,` and `;` where they separate tokens, which is outside backticks,
 * parentheses and braces: `{a,b}.tsx` is one glob and `(As built, P2)` is one note, and the old
 * split cut both in two (ezhomesteading's and wk's boards, 2026-10-16). A note in parentheses
 * after a path, set off by a space, is the board's way of saying which part of the file it means,
 * and it is dropped: `src/lib/board.ts (\`sharedFiles\`)` owns `src/lib/board.ts`. An empty cell
 * and `nothing` own nothing.
 */
export function ownedTokens(cell: string): OwnedToken[] {
  if (isEmptyCell(cell) || /^nothing\b/i.test(stripTypography(cell))) return [];
  return splitOutside(cell)
    .map((part) => withoutNote(stripTypography(part)))
    .filter((text) => text !== '')
    .map((text) => ({ text, kind: tokenKind(text) }));
}

function splitOutside(cell: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let code = false;
  let start = 0;
  for (let i = 0; i < cell.length; i++) {
    const char = cell[i] ?? '';
    if (char === '`') code = !code;
    if (code) continue;
    depth = Math.max(0, depth + nesting(char));
    if (depth === 0 && (char === ',' || char === ';')) {
      parts.push(cell.slice(start, i));
      start = i + 1;
    }
  }
  return [...parts, cell.slice(start)];
}

function nesting(char: string): number {
  if (char === '(' || char === '{') return 1;
  return char === ')' || char === '}' ? -1 : 0;
}

function withoutNote(text: string): string {
  return text.replace(/\s+\([^()]*\)$/, '').trim();
}

function tokenKind(text: string): OwnedToken['kind'] {
  if (/\s/.test(text)) return 'prose';
  if (/[*?{}]/.test(text) || text.split('/').includes('...')) return 'glob';
  return isRepoPath(text) ? 'path' : 'prose';
}

function isRepoPath(text: string): boolean {
  const segments = (text.endsWith('/') ? text.slice(0, -1) : text).split('/');
  return segments.every((s) => s !== '.' && s !== '..' && SEGMENT.test(s));
}

/**
 * What two cells both own. A token ending in `/` is a directory and owns everything under it, so
 * `src/lib/` collides with `src/lib/board.ts` (row 124); every other token matches only itself,
 * as before. The name reported for a pair is the narrower of the two, because that is what both
 * items would edit.
 */
export function sharedFiles(left: string, right: string): string[] {
  const theirs = ownedFiles(right);
  const shared = ownedFiles(left).flatMap((mine) =>
    theirs.flatMap((other) => {
      if (mine === other || (mine.endsWith('/') && other.startsWith(mine))) return [other];
      return other.endsWith('/') && mine.startsWith(other) ? [mine] : [];
    }),
  );
  return [...new Set(shared)];
}

/**
 * `IN FLIGHT` with a tail (`IN FLIGHT 2026-10-16: GATE 2 passed`) is a `board-status` finding
 * and still an item somebody is running. The collision check and `passoff next` read it as in
 * flight, so a board that fails `doctor` cannot hide a running item from them (owner decision
 * 19, 2026-10-16; ezhomesteading item 200 had such a cell).
 */
export function inFlight(status: string): boolean {
  return status.startsWith('IN FLIGHT');
}
