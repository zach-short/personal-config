import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  type Board,
  type BoardRow,
  cellAt,
  isEmptyCell,
  parseBoard,
  stripTypography,
} from '../../lib/board.ts';
import {
  findItem,
  hasItemsFolder,
  type ItemContext,
  type ItemEntry,
  itemBody,
  itemText,
  listItemsSync,
  UNMIGRATED,
} from '../../lib/items.ts';
import { ledgerSteps } from '../../lib/ledger.ts';
import { escaped } from '../../lib/markdown.ts';
import type { Finding } from '../../lib/types.ts';
import type { Doc } from '../scan.ts';

/**
 * §2.3 — the status words carry obligations. `DONE` points at the record, `HELD` names what
 * it waits on, `SUPERSEDED` names its replacement, and `SETTLED AS NO` carries its reason,
 * because its whole job is to not be re-proposed.
 *
 * Each of those four was once checked by shape alone, and a shape-only check reads as evidence
 * when it is none: `DONE — HANDOFF 999` cited a step that did not exist, `SUPERSEDED` was
 * satisfied by the word sitting in the row's own title, `HELD` by a waits-on cell saying
 * "nothing", and `SETTLED AS NO` by any paragraph carrying a date. Each check below now asks
 * for the thing itself.
 *
 * The table itself is parsed by `src/lib/board.ts`, which `passoff` reads through as well, and
 * an item's text is found by `src/lib/items.ts`, which `passoff` and `unfolded` read through
 * (per-item-board `DESIGN.md` D11).
 *
 * Built per root, like `ledger-fold-ceiling`, because a 2.0.0 board's `DONE — <date>` is checked
 * against the archive and its `DONE — <LEDGER> n` against the frozen log, and both are read from
 * the repo's config rather than from the one doc a rule is handed.
 */
export function boardStatusRule(context: ItemContext) {
  return {
    id: 'board-status',
    standardId: '§2.3',
    appliesTo: (doc: Doc) => doc.kind === 'board',
    check(doc: Doc): Finding[] {
      const board = parseBoard(doc.text);
      if (!board) return [];
      const view = boardView(doc, context);
      return board.rows.flatMap((row) => checkRow(view, board, row));
    },
  };
}

/** How every rule read a board before item files, and still reads a 1.x one (D12). */
export const boardStatus = boardStatusRule(UNMIGRATED);

/** Everything a row's check reads beyond the row, gathered once per board. */
type BoardView = {
  doc: Doc;
  /** The live items folder exists, which is what makes a repo a 2.0.0 one (D12, G53). */
  migrated: boolean;
  live: ItemEntry[];
  archived: ItemEntry[] | null;
  frozenAt: number | null;
  steps: Set<number> | null;
};

function boardView(doc: Doc, context: ItemContext): BoardView {
  const migrated = doc.itemsDir !== undefined && hasItemsFolder(doc.itemsDir);
  return {
    doc,
    migrated,
    live: migrated && doc.itemsDir !== undefined ? listItemsSync(doc.itemsDir) : [],
    archived: context.archived,
    frozenAt: context.ledgerFrozenAt,
    // D5: a frozen log is in the archive, so there is nothing beside the board to read.
    steps: context.ledgerFrozenAt === null ? ledgerNumbers(doc) : null,
  };
}

/** §2.3 — "these words and no others". Only `DONE` carries a tail, and it must. */
const STANDALONE = new Set(['OPEN', 'IN FLIGHT', 'HELD', 'SETTLED AS NO', 'SUPERSEDED']);

function checkRow(view: BoardView, board: Board, row: BoardRow): Finding[] {
  const problem = rowProblem(view, board, row);
  return problem === null ? [] : [finding(view.doc, row.line, problem)];
}

function rowProblem(view: BoardView, board: Board, row: BoardRow): string | null {
  const status = row.status;
  if (status.startsWith('DONE')) return doneProblem(view, row);
  if (!STANDALONE.has(status)) return unknownMessage(status, view.migrated);
  if (status === 'HELD') return heldProblem(board, row);
  if (status === 'SUPERSEDED') return supersededProblem(view, board, row);
  if (status === 'SETTLED AS NO') return settledProblem(view, row);
  return null;
}

function unknownMessage(status: string, migrated: boolean): string {
  const seen =
    status === '' ? 'this row carries no status' : `\`${status}\` is not a status word`;
  const done = migrated ? 'DONE — <date>' : 'DONE — <ledger step>';
  return `${seen} — §2.3 allows OPEN, IN FLIGHT, ${done}, HELD, SETTLED AS NO, SUPERSEDED, and no others`;
}

/**
 * `DONE` points at the record, and a citation that names a step the ledger does not have points
 * at nothing while reading exactly like one that does. The shape is checked first, then the
 * number against the log itself.
 *
 * A 2.0.0 board has a second shape, `DONE — <date>`, whose record is the item's own file (D2).
 * It is accepted only where the items folder exists, so a 1.x board reads exactly as it did
 * (D12): ezhomesteading carries `DONE 2026-10-13: …`, a finding before and after (G53).
 */
function doneProblem(view: BoardView, row: BoardRow): string | null {
  const stem = view.doc.ledgerStem;
  const cited = citedStep(row.status, stem);
  if (cited !== null) return stepProblem(view, cited);
  const date = closedOn(row.status);
  if (date !== null && view.migrated) return dateProblem(view, row, date);
  return view.migrated
    ? `\`DONE\` must point at the record — write \`DONE — <date>\`, the day the item closed`
    : `\`DONE\` must point at the ledger step — write \`DONE — ${stem} <n>\``;
}

function stepProblem(view: BoardView, cited: Citation): string | null {
  const { doc, frozenAt, steps } = view;
  if (!cited.ours) return null;
  // D5: every step up to the freeze is in the archive's log now, so it is taken as read.
  if (frozenAt !== null) {
    return cited.step <= frozenAt
      ? null
      : `\`DONE — ${doc.ledgerStem} ${cited.step}\` cites a step after the log froze at ${frozenAt} — a closed item now reads \`DONE — <date>\``;
  }
  if (steps === null || steps.size === 0 || steps.has(cited.step)) return null;
  const highest = Math.max(...steps);
  return `\`DONE — ${doc.ledgerStem} ${cited.step}\` cites a step the ledger does not have — its log ends at ${highest}`;
}

/** The whole cell, so `DONE 2026-10-13: P0 to P6 committed` is not mistaken for the new shape. */
function closedOn(status: string): string | null {
  return status.match(/^DONE\s*[—-]\s*(\d{4}-\d{2}-\d{2})$/)?.[1] ?? null;
}

/**
 * D2: the date is a real one, and the item file the row's number names exists, live or in the
 * archive. An archive this machine cannot read is "cannot verify", so the row passes on a live
 * file or on nothing at all, the way a missing ledger leaves a step citation alone.
 */
function dateProblem(view: BoardView, row: BoardRow, date: string): string | null {
  if (!isIsoDate(date))
    return `\`DONE — ${date}\` is not a date — write the day the item closed`;
  if (findItem(view.live, row.number) !== null) return null;
  if (view.archived === null || findItem(view.archived, row.number) !== null) return null;
  return `\`DONE — ${date}\` points at item ${row.number}'s file, and there is none, live or in the archive`;
}

function isIsoDate(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date);
}

/** A cited step, and whether it is a step of *this* repo's ledger — the only one checkable here. */
type Citation = { step: number; ours: boolean };

/**
 * The step this row cites, or null where it cites none. A word in front of the stem —
 * `DONE — portfolio HANDOFF 21` — makes it another repo's ledger, whose numbering this repo
 * cannot answer for: cited, and deliberately not checked for existence.
 */
function citedStep(status: string, stem: string): Citation | null {
  const cited = status.match(new RegExp(`(\\w+\\s+)?${escaped(stem)}\\s+(\\d+)`, 'i'));
  if (!cited) return null;
  return { step: Number(cited[2]), ours: cited[1] === undefined };
}

/**
 * A waits-on cell that merely is not empty names nothing — "nothing" itself passed that test.
 * A row reference carries a number (`item 3`, `items 42, 43`, `#4`); an external dependency is
 * recognizable by the artifact it turns on — a path, a file, a version, a date. Prose with
 * neither is an answer-shaped cell, and a reader cannot act on it.
 */
const NAMES_SOMETHING = /\d|\/|\.\w/;

function heldProblem(board: Board, row: BoardRow): string | null {
  const cell = stripTypography(cellAt(row.cells, board.columns.waitsOn));
  if (!isEmptyCell(cell) && NAMES_SOMETHING.test(cell)) return null;
  return '`HELD` must name what it waits on in the "Waits on" column — a row number, or the artifact an external dependency turns on';
}

/**
 * The replacement has to be named somewhere that is not the row's own title: a row titled
 * "Replace the board parser" satisfied a whole-row match by existing, and so did every row whose
 * title happened to carry the word. The status cell is excluded for the same reason —
 * `SUPERSEDED` would otherwise satisfy its own test — and the item's section below the board is
 * included, because that is where a board with no column for a reason writes one.
 */
function supersededProblem(view: BoardView, board: Board, row: BoardRow): string | null {
  const elsewhere = row.cells.filter(
    (_, index) => index !== board.columns.status && index !== board.columns.task,
  );
  const named = [...elsewhere, itemProse(view, row.number)].join(' ');
  return /supersed|replac/i.test(named) ? null : '`SUPERSEDED` must name what replaced it';
}

/**
 * §2.1: an item settled as *no* "stays on the board with its reason". The reason cannot live in
 * the row — the board has no column for one — so it lives in the item's own dated paragraph
 * below the board, and that is what this looks for. The check this replaced counted the
 * characters left in the row after the dashes were stripped, which any title of twelve
 * characters satisfied: it could not fail, and a check that cannot fail reads as evidence when
 * it is none.
 */
function settledProblem(view: BoardView, row: BoardRow): string | null {
  // No `#` column means no way to find the item's section. Say nothing rather than guess.
  if (row.number.trim() === '') return null;
  const body = itemProse(view, row.number);
  if (!/\d{4}-\d{2}-\d{2}/.test(body)) {
    return '`SETTLED AS NO` must carry its reason in a dated paragraph below the board, so it is not re-proposed';
  }
  if (explains(body)) return null;
  return "`SETTLED AS NO`'s paragraph must say why the answer was no — a date and an item number is a stamp, not a reason";
}

/**
 * Whether the paragraph says anything once the stamp is taken out of it. HANDOFF 4 found this
 * rule counting characters; the fix that replaced it asked only for a date, so a paragraph
 * reading "*2026-09-08.* Item 4." still passed. Dates, status words, the item reference, the
 * citations in backticks and the markdown all come out, and what is left has to be words.
 *
 * Deliberately cheap: only a reader can judge whether a reason is honest, and a heuristic that
 * tried to would fail an honest short one. This catches the empty.
 */
const REASON_WORDS = 6;

function explains(body: string): boolean {
  const prose = body
    .replaceAll(/`[^`]*`/g, ' ')
    .replaceAll(/\d{4}-\d{2}-\d{2}/g, ' ')
    .replaceAll(/\b(SETTLED AS NO|SUPERSEDED|IN FLIGHT|OPEN|HELD|DONE|item|row)\b/gi, ' ')
    .replaceAll(/[^A-Za-z]+/g, ' ');
  return prose.split(' ').filter((word) => word.length > 2).length >= REASON_WORDS;
}

/**
 * The item's own text below its heading: its file on a 2.0.0 board, its section below a 1.x one
 * (D12). That is where a reason too long for a cell is written.
 */
function itemProse(view: BoardView, item: string): string {
  if (item.trim() === '') return '';
  const found = itemText(view.live, view.doc.text, item);
  return found === null ? '' : itemBody(found);
}

/**
 * The ledger's step numbers, read from beside the board: §0.2 keeps the two in one directory,
 * and a `doctor` rule is handed one doc at a time, so this is the only place the board's rule
 * can reach the log its rows cite. Null where there is no ledger to read — a fresh clone, a repo
 * that keeps none — and null means "cannot verify", which leaves the shape check alone rather
 * than reporting a violation nobody can act on.
 */
function ledgerNumbers(doc: Doc): Set<number> | null {
  const text = readLedger(join(dirname(doc.path), `${doc.ledgerStem}.md`));
  return text === null ? null : new Set(ledgerSteps(text).map((step) => step.number));
}

/** Sync because every rule's `check` is: one small file, read once per board rather than per row. */
function readLedger(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
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
