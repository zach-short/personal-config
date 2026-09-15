import type { Finding } from '../../lib/types.ts';
import { type Doc, proseLines } from '../scan.ts';

/**
 * §2.3 — the status words carry obligations. `DONE` points at the record, `HELD` names what
 * it waits on, `SUPERSEDED` names its replacement, and `SETTLED AS NO` carries its reason,
 * because its whole job is to not be re-proposed.
 */
export const boardStatus = {
  id: 'board-status',
  standardId: '§2.3',
  appliesTo: (doc: Doc) => doc.kind === 'board',
  check(doc: Doc): Finding[] {
    const table = boardTable(doc);
    if (!table) return [];

    return table.rows.flatMap(({ text, line }) =>
      checkRow(doc, cells(text), table.columns, line),
    );
  },
};

type Columns = { number: number; status: number; waitsOn: number };
type Table = { columns: Columns; rows: Array<{ text: string; line: number }> };

/**
 * The board is the *first* table under the board's own header, and only the rows touching it.
 * A prompt below the board may carry tables of its own, and reading those as board rows made
 * every one of them an item with no status the moment an unknown status became a finding.
 */
function boardTable(doc: Doc): Table | null {
  const lines = proseLines(doc);
  const header = lines[lines.findIndex(({ text }) => isHeaderRow(text))];
  if (!header) return null;

  const rows: Array<{ text: string; line: number }> = [];
  let previous = header.line;
  for (const row of lines.slice(lines.indexOf(header) + 1)) {
    if (row.line !== previous + 1 || !row.text.trimStart().startsWith('|')) break;
    rows.push(row);
    previous = row.line;
  }
  return { columns: headerColumns(header.text), rows };
}

function cells(text: string): string[] {
  return text
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
}

/** Column positions come from the header, so a board with extra columns still reads correctly. */
function headerColumns(header: string): Columns {
  const names = cells(header).map((c) => c.toLowerCase());
  return {
    number: names.indexOf('#'),
    status: names.indexOf('status'),
    waitsOn: names.findIndex((n) => n.startsWith('waits')),
  };
}

function isHeaderRow(text: string): boolean {
  return /\|\s*#\s*\|/.test(text) && /status/i.test(text);
}

/** `` `OPEN` `` and `OPEN` are the same status; the backticks are the board's typography. */
function statusOf(row: string[], columns: Columns): string {
  const cell = columns.status >= 0 ? (row[columns.status] ?? '') : '';
  return cell.replaceAll('`', '').trim();
}

/** §2.3 — "these words and no others". Only `DONE` carries a tail, and it must. */
const STANDALONE = new Set(['OPEN', 'IN FLIGHT', 'HELD', 'SETTLED AS NO', 'SUPERSEDED']);

function checkRow(doc: Doc, row: string[], columns: Columns, line: number): Finding[] {
  if (isSeparator(row)) return [];
  const status = statusOf(row, columns);

  if (!status.startsWith('DONE') && !STANDALONE.has(status)) {
    return [finding(doc, line, unknownMessage(status))];
  }

  // The status cell is excluded from `rest`, or `SUPERSEDED` would satisfy its own test.
  const rest = row.filter((_, index) => index !== columns.status).join(' ');

  if (status.startsWith('DONE') && !citesLedger(status, doc.ledgerStem)) {
    return [
      finding(
        doc,
        line,
        `\`DONE\` must point at the ledger step — write \`DONE — ${doc.ledgerStem} <n>\``,
      ),
    ];
  }
  if (status === 'HELD' && isEmpty(row[columns.waitsOn])) {
    return [finding(doc, line, '`HELD` must name what it waits on in the "Waits on" column')];
  }
  if (status === 'SUPERSEDED' && !/supersed|replac/i.test(rest)) {
    return [finding(doc, line, '`SUPERSEDED` must name what replaced it')];
  }
  if (status === 'SETTLED AS NO' && !hasDatedReason(doc, row[columns.number])) {
    return [
      finding(
        doc,
        line,
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
function hasDatedReason(doc: Doc, item: string | undefined): boolean {
  const number = (item ?? '').trim();
  // No `#` column means no way to find the item's section. Say nothing rather than guess.
  if (number === '') return true;

  const heading = new RegExp(`^#{2,4}\\s*${escaped(number)}[.):]`);
  const start = doc.lines.findIndex((text) => heading.test(text));
  if (start === -1) return false;

  const after = doc.lines.slice(start + 1);
  const next = after.findIndex((text) => /^#{1,4}\s/.test(text));
  return /\d{4}-\d{2}-\d{2}/.test((next === -1 ? after : after.slice(0, next)).join('\n'));
}

/** `DONE — HANDOFF 24`, or the same shape under whatever name §0.2 adopted. */
function citesLedger(status: string, stem: string): boolean {
  return new RegExp(`${escaped(stem)}\\s+\\d+`, 'i').test(status);
}

/** An adopted name is a filename, not a pattern: `C++.md` must not compile to one. */
function escaped(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSeparator(row: string[]): boolean {
  return row.length > 0 && row.every((cell) => /^:?-{2,}:?$/.test(cell));
}

function isEmpty(cell: string | undefined): boolean {
  const value = (cell ?? '').trim();
  return value === '' || value === '—' || value === '-';
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
