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
    const rows = proseLines(doc).filter(({ text }) => text.trimStart().startsWith('|'));
    const columns = headerColumns(rows.map((r) => r.text));

    return rows
      .filter(({ text }) => !isHeaderRow(text))
      .flatMap(({ text, line }) => checkRow(doc, cells(text), columns, line));
  },
};

type Columns = { status: number; waitsOn: number };

function cells(text: string): string[] {
  return text
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
}

/** Column positions come from the header, so a board with extra columns still reads correctly. */
function headerColumns(rows: string[]): Columns {
  const header = rows.find(isHeaderRow);
  if (!header) return { status: -1, waitsOn: -1 };
  const names = cells(header).map((c) => c.toLowerCase());
  return {
    status: names.indexOf('status'),
    waitsOn: names.findIndex((n) => n.startsWith('waits')),
  };
}

function isHeaderRow(text: string): boolean {
  return /\|\s*#\s*\|/.test(text) && /status/i.test(text);
}

function checkRow(doc: Doc, row: string[], columns: Columns, line: number): Finding[] {
  if (isSeparator(row)) return [];
  const status = columns.status >= 0 ? (row[columns.status] ?? '') : '';
  if (!/OPEN|IN FLIGHT|DONE|HELD|SETTLED AS NO|SUPERSEDED/.test(status)) return [];

  // The status cell is excluded from `rest`, or `SUPERSEDED` would satisfy its own test.
  const rest = row.filter((_, index) => index !== columns.status).join(' ');

  if (/DONE/.test(status) && !citesLedger(status, doc.ledgerStem)) {
    return [
      finding(
        doc,
        line,
        `\`DONE\` must point at the ledger step — write \`DONE — ${doc.ledgerStem} <n>\``,
      ),
    ];
  }
  if (/HELD/.test(status) && isEmpty(row[columns.waitsOn])) {
    return [finding(doc, line, '`HELD` must name what it waits on in the "Waits on" column')];
  }
  if (/SUPERSEDED/.test(status) && !/supersed|replac/i.test(rest)) {
    return [finding(doc, line, '`SUPERSEDED` must name what replaced it')];
  }
  if (/SETTLED AS NO/.test(status) && rest.replaceAll(/[—\-\s]/g, '').length < 12) {
    return [
      finding(doc, line, '`SETTLED AS NO` must carry its reason, so it is not re-proposed'),
    ];
  }
  return [];
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
