import { type Board, type BoardRow, cellAt, parseBoard } from './board.ts';
import { type ItemEntry, isItemFor, itemFileName } from './items.ts';
import { type LedgerStep, ledgerSteps, type StepForm, stepHeading } from './ledger.ts';
import { staleLogLines } from './log.ts';
import { headingBlock, proseLines } from './markdown.ts';
import { docStem } from './repo-config.ts';
import { isClosed, isFoldable } from './status.ts';

/**
 * What a fold lifts out of a live document, computed as data before anything is planned or
 * written. §2.1 already says the two halves are dead weight; this is the arithmetic of removing
 * them, and it touches no disk so that the part worth testing is testable by calling it.
 *
 * The board and the ledger fold differently on purpose. A `COMMITTED` prompt is *replaced* by its
 * ledger step and leaves nothing behind, so it goes whole. A ledger step is cited forever —
 * "HANDOFF 24" is how every other document refers to work — so its body goes and a one-line
 * stub stays, which keeps the number taken, the log contiguous and the citation resolvable.
 */

/**
 * How many of the newest ledger steps keep their bodies by default.
 *
 * A dial (`--keep`) rather than a constant, for Part 5's reason — what a session can afford is
 * a property of the model driving it, not of the repo. Twenty because that is where this repo's
 * own ledger stops being the largest thing a session reads: at 77 steps it is 99k tokens, and
 * keeping 20 leaves 44k (measured 2026-09-23).
 */
export const DEFAULT_KEEP = 20;

export type Folded = {
  /** The item or step this was, as written — `12`, `1.5`. */
  id: string;
  /** Its own first line, which is what the archive entry and the report are titled by. */
  heading: string;
  /** Every line lifted out, heading included. */
  text: string;
  /** 1-based first and last line in the source. */
  start: number;
  end: number;
  /** The line that takes its place, or null where nothing does. */
  stub: string | null;
};

export type Fold = {
  folded: Folded[];
  trimmed: string;
  /**
   * What the archive header counts, where the blocks are not the units: `fold migrate` hands the
   * whole step log over as one block, so the block count would read `1 step(s)` over 117 steps.
   * Left unset, the header counts the blocks, which is right for `fold ledger` and `fold board`.
   */
  count?: number;
};

const EMPTY: Fold = { folded: [], trimmed: '' };

/**
 * The board half: a `COMMITTED` item's prompt, lifted whole.
 *
 * Not a `DONE` one (§2.3): its code is not in a commit yet, and the prompt is the only way to
 * rebuild the work if it is lost before the owner commits it. Once git has the commit, the row
 * says `COMMITTED` and the prompt is dead weight.
 *
 * Not the open words either, and that is not a preference — `doctor`'s own §2.3 rule reads the two
 * sections. `supersededProblem` looks in the item's section for what replaced it, and
 * `settledProblem` requires a dated paragraph there carrying the reason, because §2.1's whole
 * point for that status is that it is never re-proposed (`src/doctor/rules/board-status.ts`).
 * Folding either would make this tool's checker fire on the file this tool just wrote.
 *
 * `doneProblem` and `committedProblem`, next to them, read the status cell, the ledger and git,
 * and never the section.
 * That asymmetry is §2.1 restated in code: a prompt rots the moment it is executed, and the
 * ledger step is the truth.
 *
 * `git` is false only where no `.git` sits at or above the root. There `DONE` is final and folds
 * too (`isFoldable`). It defaults to true, the guess that never folds uncommitted work.
 */
export function boardFold(markdown: string, git = true): Fold {
  const board = parseBoard(markdown);
  if (board === null) return { ...EMPTY, trimmed: markdown };

  const folded = board.rows
    .filter((row) => isFoldable(row.status, git))
    .flatMap((row) => itemBlock(markdown, row));
  return { folded, trimmed: applyFold(markdown, folded) };
}

/** A row whose prompt was never written has nothing to fold, and that is not an error. */
function itemBlock(markdown: string, row: BoardRow): Folded[] {
  const block = headingBlock(markdown, row.number);
  if (block === null || row.number.trim() === '') return [];
  return [
    {
      id: row.number,
      heading: block.heading,
      text: [block.heading, block.body].join('\n'),
      start: block.start,
      end: block.end,
      stub: null,
    },
  ];
}

/**
 * The ledger half: every step but the most recent `keep` loses its body and keeps one line.
 *
 * The boundary is a count rather than a date because the log is numbered, not dated, and a
 * count is the one boundary a reader can check against the file in front of them. It is a
 * dial (`--keep`) for the reason Part 5 gives: what a session can afford is a property of the
 * model driving it, not of the repo.
 */
export function ledgerFold(markdown: string, keep: number, date: string): Fold {
  const steps = ledgerSteps(markdown);
  if (steps.length === 0) return { ...EMPTY, trimmed: markdown };

  const newest = steps.reduce((high, step) => Math.max(high, step.number), 0);
  const lines = markdown.split('\n');
  const stops = blockStops(markdown, steps);
  const folded = steps
    .filter((step) => step.number <= newest - keep)
    .flatMap((step) => stepBlock(lines, step, stops, date));
  return { folded, trimmed: applyFold(markdown, folded) };
}

function stepBlock(lines: string[], step: LedgerStep, stops: number[], date: string): Folded[] {
  const end = (stops.find((line) => line > step.line) ?? lines.length + 1) - 1;
  // A step already reduced to a stub has no body left to lift, and lifting it again would
  // append a second, identical archive entry on every run.
  if (end <= step.line) return [];

  const text = lines.slice(step.line - 1, end).join('\n');
  return [
    {
      id: String(step.number),
      heading: lines[step.line - 1] ?? '',
      text,
      start: step.line,
      end,
      stub: stubFor(step, text, date),
    },
  ];
}

/**
 * The line that stays. It has to keep three things working at once: `ledgerSteps` must still
 * see the number, or `handoff step` hands out a number the log has taken and `doctor`'s
 * contiguity check reports a gap that is not one; the board's `DONE — HANDOFF n` must still
 * resolve, which is the same read; and a person scanning the log must still learn what the
 * step was. So: the original bold heading, its own date, and where the body went.
 *
 * The heading is written in the log's own form. A list-form log is only read as one while no
 * bold step stands outside a list item, so a `**1. …**` stub at column 0 would flip the whole
 * file to the bold form, and every step the fold kept would vanish from the parser.
 */
function stubFor(step: LedgerStep, text: string, date: string): string {
  const done = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  const when = done === undefined ? '' : ` Done ${done}.`;
  const title = titleFrom(text, step.title, step.form);
  return `${stepHeading(step.form, step.number, title)}${when} Body folded ${date}.`;
}

/** `**12. Built it.**` or `12. **Built it.**`, with the bold allowed to run onto the next line. */
const WRAPPED_TITLE: Record<StepForm, RegExp> = {
  bold: /^\s*(?:[-*+]\s+)?\*\*\d+\.\s+([\s\S]*?)\*\*/,
  list: /^ {0,3}\d+\.\s+\*\*([\s\S]*?)\*\*/,
};

/**
 * The step's title, healed back into one line where the heading wrapped.
 *
 * `ledgerSteps` reads the log line by line, so a `**N. Title**` whose bold closes on a *second*
 * line leaves `step.title` empty and the stub reads `**4. ** Done 2026-09-15.` — 18 of this
 * repo's own 58 steps, found folding it for the first time on 2026-09-23. The block text holds
 * the rest of the heading, and the search is bounded to its first paragraph so a heading whose
 * bold is never closed cannot pull body prose into the stub.
 *
 * The fallback is not dead: `**12.** Built it.` closes its bold before the title starts, which
 * this pattern deliberately does not match and `PLAIN_TITLE` already reads.
 */
function titleFrom(text: string, fallback: string, form: StepForm): string {
  const heading = text.split(/\n\s*\n/)[0] ?? '';
  const wrapped = heading.match(WRAPPED_TITLE[form])?.[1]?.replace(/\s+/g, ' ').trim();
  return wrapped === undefined || wrapped === '' ? fallback : wrapped;
}

/**
 * Where a step's block can end: the next step, or the next heading — whichever comes first.
 *
 * The heading matters and is easy to miss. This repo's log runs to `HANDOFF.md:5075` and
 * `## Style rules` opens at 5076, so a last step bounded only by the next step swallows a
 * standing section — one the standard says is edited in place and never archived.
 */
function blockStops(markdown: string, steps: LedgerStep[]): number[] {
  const headings = proseLines(markdown)
    .filter(({ text }) => /^#{1,6}\s/.test(text))
    .map(({ line }) => line);
  return [...steps.map((step) => step.line), ...headings].sort((a, b) => a - b);
}

/**
 * The splice. Stubs are emitted where their block opened, so a folded log keeps its steps in
 * the order it had them.
 *
 * The healing is deliberately seam-local. Removing a block takes its trailing blank lines with
 * it while the line above keeps its own, which leaves a double gap exactly where the cut was —
 * so a blank is dropped only when the line before it was cut away. An earlier draft filtered
 * every repeated blank in the file, which reformatted paragraphs the fold never touched: the
 * diff a person is asked to confirm has to be the fold and nothing else.
 */
export function applyFold(markdown: string, folded: Folded[]): string {
  const { cut, stubs } = spliceOf(folded);
  const kept: string[] = [];
  let atSeam = false;

  for (const [index, text] of markdown.split('\n').entries()) {
    const stub = stubs.get(index + 1);
    if (stub !== undefined) kept.push(stub);
    if (cut.has(index + 1)) {
      atSeam = stub === undefined;
      continue;
    }
    if (atSeam && isSeamBlank(text, kept)) continue;
    atSeam = false;
    kept.push(text);
  }
  return kept.join('\n');
}

/** The lines a fold removes, and the lines it puts back, keyed by where they go. */
function spliceOf(folded: Folded[]): { cut: Set<number>; stubs: Map<number, string> } {
  const cut = new Set<number>();
  const stubs = new Map<number, string>();
  for (const block of folded) {
    for (let line = block.start; line <= block.end; line += 1) cut.add(line);
    if (block.stub !== null) stubs.set(block.start, block.stub);
  }
  return { cut, stubs };
}

/** A blank that would be the second of a pair, the first having survived the cut above it. */
function isSeamBlank(text: string, kept: string[]): boolean {
  return text.trim() === '' && (kept.at(-1) ?? 'x').trim() === '';
}

/**
 * One `COMMITTED` item whose file is still in the live folder (per-item-board `DESIGN.md` D6, D16):
 * the file to move, and what its row said, which the archive index line carries once the row
 * leaves the table.
 */
export type ItemMove = {
  number: string;
  /** The row's task cell as written. */
  task: string;
  /** The date in the status cell (`COMMITTED, 2026-10-15, a1b2c3d`), or null where it has none. */
  closed: string | null;
  /** The live file's name, which is also its name in the archive. */
  name: string;
  /** The live file's bytes, as read for this fold. */
  text: string;
  /** The row's 1-based line on the board, which the fold cuts. */
  line: number;
};

/**
 * The board half on a migrated board: every `COMMITTED` row with exactly one live file.
 *
 * Where `git` is false, every `DONE` row with one live file as well (`isFoldable`).
 *
 * Exactly one, not "the first": with two files for one number, moving one leaves the other
 * live under a row that is gone, an orphan nothing points at. Two files is `item-files`'s
 * finding to report; the fold leaves that item alone until it is resolved.
 */
export function itemFold(markdown: string, listing: ItemEntry[], git = true): ItemMove[] {
  const board = parseBoard(markdown);
  if (board === null) return [];
  const numbers = board.rows.map((row) => row.number.trim());
  return board.rows
    .filter((row) => isFoldable(row.status, git))
    .flatMap((row) => {
      const files = listing.filter((entry) => isItemFor(entry.name, row.number));
      const file = files[0];
      if (files.length !== 1 || file === undefined || row.number.trim() === '') return [];
      // Two rows for one number would both be cut while the one file moves once, and the second
      // row's line would be in no archive file (item 107's audit, F2).
      if (numbers.indexOf(numberOf(row)) !== numbers.lastIndexOf(numberOf(row))) return [];
      return [
        {
          number: row.number.trim(),
          task: cellAt(row.cells, board.columns.task),
          closed: row.status.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? null,
          name: file.name,
          text: file.text,
          line: row.line,
        },
      ];
    });
}

function numberOf(row: BoardRow): string {
  return row.number.trim();
}

/**
 * The board with these rows cut (D16). Table rows are consecutive lines with no blank between,
 * so cutting one leaves no seam to heal, and every other byte stays where it was.
 */
export function withoutRows(markdown: string, lines: number[]): string {
  const cut = new Set(lines);
  return markdown
    .split('\n')
    .filter((_, index) => !cut.has(index + 1))
    .join('\n');
}

/**
 * One `DONE` row on a migrated board that has no item file, live or archived (per-item-board
 * `DESIGN.md` D18): the archive file written for it, and what its row said, which the archive
 * index line carries once the row leaves the table.
 */
export type RowFile = {
  number: string;
  /** The row's task cell as written. */
  task: string;
  /** The row's status cell as written, typography and all. */
  status: string;
  /** D7's name, which the archive file takes. */
  name: string;
  /** The file's whole text: the row as it stood, then where its record is. */
  text: string;
  /** The row's own line on the board, which the read-back finds whole in the archive file. */
  row: string;
  /** The row's 1-based line on the board, which the fold cuts. */
  line: number;
};

/** Where a 1.x row's record went, for the pointers its archive file carries. */
export type RowRecord = {
  /** The ledger's file name, `HANDOFF.md`. */
  ledger: string;
  /** `ledgerFrozenAt`, or null where the ledger still holds its step log. */
  frozenAt: number | null;
  /** The closed archive's file name, `PASSOFF-closed.md`. */
  closedName: string;
  /** Its text, or `''` where the archive has none. */
  closed: string;
};

/** A row number a file can be named for: D7's `<n>`, one decimal part allowed. */
const ITEM_NUMBER = /^\d+(?:\.\d+)?$/;

/**
 * D18: every closed row, `DONE` or `COMMITTED`, with no item file anywhere. Such a row was
 * closed under 1.x, when the record was a ledger step and not a file, so D16's move has nothing
 * to move, and the row would stay on the table for good. A `DONE` row folds here although
 * `isFoldable` holds it back elsewhere: what `DONE` protects is the item file, and there is none. A number the archive already holds is left alone unless it is this
 * very file, name and text, which is a fold run again after `undo`. Any other file there is a row
 * D16 already moved, or a second copy, and either is `item-files`'s finding, not this fold's.
 * A number on two rows is left alone too: one file cannot hold both, and cutting both by line
 * would lose the one the file does not hold.
 */
export function rowFold(
  markdown: string,
  live: ItemEntry[],
  archived: ItemEntry[],
  record: RowRecord,
): RowFile[] {
  const board = parseBoard(markdown);
  if (board === null) return [];
  const numbers = board.rows.map((row) => row.number.trim());
  return board.rows
    .filter((row) => isClosed(row.status))
    .flatMap((row) => {
      const number = row.number.trim();
      if (!ITEM_NUMBER.test(number) || numbers.indexOf(number) !== numbers.lastIndexOf(number))
        return [];
      if (live.some((entry) => isItemFor(entry.name, number))) return [];
      const file = rowFileOf(row, board, record);
      const there = archived.filter((entry) => isItemFor(entry.name, number));
      return there.every((entry) => entry.name === file.name && entry.text === file.text)
        ? [file]
        : [];
    });
}

function rowFileOf(row: BoardRow, board: Board, record: RowRecord): RowFile {
  const number = row.number.trim();
  const task = cellAt(row.cells, board.columns.task);
  const status = cellAt(row.cells, board.columns.status);
  const text = [
    `# ${number}. ${task}`.trimEnd(),
    '',
    'This row closed before the board kept one file per item, so it had no file of its own.',
    '`personal-config fold board` wrote this file when the row left the table.',
    '',
    '## The row, as it stood when it left the table',
    '',
    ...rowTable(row, board.header),
    '',
    '## Where its record is',
    '',
    ...recordPointers(number, status, record),
    '',
  ].join('\n');
  return {
    number,
    task,
    status,
    name: itemFileName(number, task),
    text,
    row: row.text,
    line: row.line,
  };
}

/** The header rebuilt from its cells, a separator, then the row's own line, byte for byte. */
function rowTable(row: BoardRow, header: string[]): string[] {
  return [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, row.text];
}

function recordPointers(number: string, status: string, record: RowRecord): string[] {
  const steps = stepsNamed(status, docStem(record.ledger));
  const sections = closedSections(number, record.closed);
  const log = `the archive's \`${docStem(record.ledger)}-log.md\``;
  return [
    ...steps.map(
      (step) =>
        `- Ledger step ${step}: ${record.frozenAt !== null && step <= record.frozenAt ? log : `\`${record.ledger}\``}.`,
    ),
    ...(steps.length === 0 ? ['- Its status cell names no ledger step.'] : []),
    ...sections.map(
      (opening) =>
        `- The section that opens \`${opening}\` in the archive's \`${record.closedName}\`.`,
    ),
    ...(sections.length === 0
      ? [`- The archive's \`${record.closedName}\` has no section for it.`]
      : []),
  ];
}

/**
 * The step numbers a status cell cites: `HANDOFF 24`, `HANDOFF step 24`, `HANDOFF 97 + 98` and
 * `HANDOFF 46 and 47`. A comma is not read as a joiner, because a cell such as `HANDOFF 24, 2026-…`
 * goes on with a date, not a step.
 */
function stepsNamed(status: string, stem: string): number[] {
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cite = new RegExp(
    `\\b${escaped}\\s+(?:step\\s+)?(\\d+)((?:\\s*(?:\\+|and)\\s*\\d+)*)`,
    'g',
  );
  const found = [...status.matchAll(cite)].flatMap(
    (match) => `${match[1]} ${match[2] ?? ''}`.match(/\d+/g)?.map(Number) ?? [],
  );
  return [...new Set(found)];
}

/**
 * How each closed-archive section for this row opens: its own `### <n>.` prompt, or a range
 * section `### <a>–<b>.` whose span holds it. Only the opening, which a search finds: the rest of
 * the heading is the archive's own text, and a copy here is one more place for it to be read as
 * live (an undated "today" in a heading is `relative-dates`'s finding wherever it is copied).
 */
function closedSections(number: string, closed: string): string[] {
  const value = Number(number);
  const openings = closed.split('\n').flatMap((text) => {
    const item = text.match(ITEM_HEADING);
    if (item?.[1] === number) return [item[0]];
    const range = text.match(RANGE_HEADING);
    const holds = range !== null && value >= Number(range[1]) && value <= Number(range[2]);
    return holds ? [range[0]] : [];
  });
  return [...new Set(openings)];
}

/**
 * The ledger half on a migrated ledger (D4): every `## Log` line dated more than `days` before
 * `date`, each lifted as its own block with nothing left in its place. A log line carries no
 * number for anything to cite, so unlike a step it needs no stub.
 */
export function logFold(markdown: string, days: number, date: string): Fold {
  const folded = staleLogLines(markdown, date, days).map((line) => ({
    id: line.date,
    heading: line.text,
    text: line.text,
    start: line.line,
    end: line.line,
    stub: null,
  }));
  return { folded, trimmed: folded.length === 0 ? markdown : applyFold(markdown, folded) };
}

/** What the fold is worth, for the report — the one number that answers "is this worth it". */
export function foldedLines(fold: Fold): number {
  return fold.folded.reduce((total, block) => total + (block.end - block.start + 1), 0);
}

/** One open item's section, as the file it becomes (D5 step 3, D7). */
export type ItemFile = {
  number: string;
  /** `<n>-<slug>.md`, the slug from the row's task cell. */
  name: string;
  /** `# <n>. <Title>`, then the section's body as it stood, without the board's separator. */
  text: string;
};

/**
 * `fold migrate`'s four outputs (per-item-board `DESIGN.md` D5), computed touching no disk.
 * `problems` is non-empty where the conversion would lose or misplace text, and then nothing
 * else here may be written.
 */
export type Migration = {
  /** The highest step in the log, which `ledgerFrozenAt` records; 0 for a log with none. */
  frozenAt: number;
  /** The number of steps in that section, which the archive header names; 0 when there is none. */
  steps: number;
  /** The whole step log section, heading included, for `<LEDGER>-log.md`; null when empty. */
  log: Folded | null;
  /** Every `COMMITTED` item's section still on the board, for `<BOARD>-closed.md`. */
  closed: Folded[];
  /**
   * Every range section (`### 26–30.`), whole, also for `<BOARD>-closed.md`: it leaves the board,
   * and a range whose rows are all `DONE` has no item file to carry it.
   */
  shared: Folded[];
  items: ItemFile[];
  board: string;
  ledger: string;
  /** Numbered sections with no row, left on the board where they are. */
  unrowed: string[];
  /** Level-2 headings below the table, which are prose and stay on the board untouched. */
  prose: string[];
  problems: string[];
};

/** A numbered item heading, as `headingBlock` opens one. */
const ITEM_HEADING = /^#{2,4}\s*(\d+(?:\.\d+)?)[.):]/;

/**
 * A level-3 heading that is shared context for a run of rows, `### 26–30.` with an en dash or a
 * hyphen. One board files items this way (G59): the section is the reason for rows 26 to 30, and
 * no row has a heading of its own below it, so `ITEM_HEADING` sees nothing and those rows got no
 * file. Level 3 only, as that board writes it: a range at any other level is left where it is.
 */
const RANGE_HEADING = /^###\s*(\d+)\s*[–-]\s*(\d+)\./;

/**
 * The conversion as data. The board loses every section a row names, `COMMITTED` ones to the
 * closed archive and the rest to their own files, `DONE` ones included, since a `DONE` item's
 * code is not in a commit yet (§2.3). The ledger loses its step log section whole, which goes to
 * the archive log, and gains an empty `## Log` with the one line D5 names in its place. Where
 * `git` is false, `DONE` sections go to the closed archive too, because no commit will follow.
 */
export function migrateFold(
  board: string,
  ledger: string,
  date: string,
  ledgerName: string,
  git = true,
): Migration {
  const boardPart = migrateBoard(board, git);
  const ledgerPart = migrateLedger(ledger, date, ledgerName);
  return {
    ...boardPart,
    ...ledgerPart,
    problems: [...boardPart.problems, ...ledgerPart.problems],
  };
}

type BoardPart = Pick<
  Migration,
  'closed' | 'shared' | 'items' | 'board' | 'unrowed' | 'prose' | 'problems'
>;

function migrateBoard(markdown: string, git: boolean): BoardPart {
  const parsed = parseBoard(markdown);
  const empty: BoardPart = {
    closed: [],
    shared: [],
    items: [],
    board: markdown,
    unrowed: [],
    prose: [],
    problems: [],
  };
  if (parsed === null) return empty;

  const numbers = sectionNumbers(markdown);
  const twice = [...new Set(numbers.filter((n, i) => numbers.indexOf(n) !== i))];
  const rowNumbers = parsed.rows.map((row) => row.number.trim()).filter((n) => n !== '');
  const unrowed = [...new Set(numbers.filter((n) => !rowNumbers.includes(n)))];
  const rowTwice = [...new Set(rowNumbers.filter((n, i) => rowNumbers.indexOf(n) !== i))];

  // `headingBlock` opens on `### 5.1.` for item 5, so a block counts only where its heading
  // names the row's own number: a row whose section is not there gets no file, never 5.1's.
  const blocks = parsed.rows.flatMap((row) =>
    itemBlock(markdown, row)
      .filter((block) => block.heading.match(ITEM_HEADING)?.[1] === row.number.trim())
      .map((block) => ({ row, block })),
  );
  const ranges = rangeSections(markdown);
  const problems = [
    ...twice.map((n) => `the board has two sections for item ${n}`),
    ...rowTwice.map((n) => `the board has two rows for item ${n}`),
    ...rangeProblems(ranges, parsed.rows),
    ...overlaps([...blocks.map(({ block }) => block), ...ranges.map((range) => range.block)]),
  ];
  if (problems.length > 0) return { ...empty, problems };

  const closed = blocks
    .filter(({ row }) => isFoldable(row.status, git))
    .map(({ block }) => block);
  const items = parsed.rows
    .filter((row) => !isFoldable(row.status, git))
    .flatMap((row) => openItem(row, blocks, ranges, parsed));
  const cut = withoutTrailingRules(
    applyFold(markdown, [...blocks.map(({ block }) => block), ...ranges.map((r) => r.block)]),
  );
  const shared = ranges.map((range) => range.block);
  return { closed, shared, items, board: cut, unrowed, prose: proseBelow(cut), problems: [] };
}

/**
 * One open row's file, or none. Its own section wins, as before ranges were read; a range it sits
 * in is appended to that file as shared context, or, where the row has no section of its own,
 * is the file's body, with the row's cells after it.
 */
function openItem(
  row: BoardRow,
  blocks: { row: BoardRow; block: Folded }[],
  ranges: RangeSection[],
  board: Board,
): ItemFile[] {
  const own = blocks.find((entry) => entry.row === row)?.block;
  const range = ranges.find((r) => inRange(row, r));
  const task = cellAt(row.cells, board.columns.task);
  if (own !== undefined) {
    const file = itemFileOf(row, own, task);
    return [range === undefined ? file : { ...file, text: `${file.text}\n${sharedOf(range)}` }];
  }
  if (range === undefined) return [];
  return [rangeItemOf(row, range, task, board.header)];
}

/** A range heading's number pair and its block, which ends where `headingBlock`'s would. */
type RangeSection = { first: number; last: number; block: Folded };

function rangeSections(markdown: string): RangeSection[] {
  const lines = markdown.split('\n');
  return lines.flatMap((text, index) => {
    const match = text.match(RANGE_HEADING);
    if (match === null) return [];
    const after = lines.slice(index + 1);
    const next = after.findIndex((line) => /^#{1,3}\s/.test(line));
    const body = next === -1 ? after : after.slice(0, next);
    const [first, last] = [Number(match[1]), Number(match[2])];
    const block: Folded = {
      id: `${first}–${last}`,
      heading: text,
      text: [text, ...body].join('\n'),
      start: index + 1,
      end: index + 1 + body.length,
      stub: null,
    };
    return [{ first, last, block }];
  });
}

/** A row belongs to a range by its number's value, so `92.5` sits inside `92–119`. */
function inRange(row: BoardRow, range: RangeSection): boolean {
  const value = Number(row.number.trim());
  return row.number.trim() !== '' && value >= range.first && value <= range.last;
}

/** A range that runs backwards, or a row two ranges claim, has no one right file. */
function rangeProblems(ranges: RangeSection[], rows: BoardRow[]): string[] {
  const backwards = ranges
    .filter((range) => range.first > range.last)
    .map((range) => `the range heading \`${range.block.heading}\` runs backwards`);
  const claimed = rows
    .filter((row) => ranges.filter((range) => inRange(row, range)).length > 1)
    .map((row) => `row ${row.number.trim()} sits in two range sections`);
  return [...backwards, ...claimed];
}

/** The range section whole, heading included, under the heading item 105 named. */
function sharedOf(range: RangeSection): string {
  const text = withoutTrailingRules(range.block.text);
  return `## Shared context (rows ${range.first} to ${range.last})\n\n${text}`;
}

/**
 * A row with no section of its own, inside a range: `# <n>. <task>`, the shared context, then
 * the row as it stood, header and all, so the cells read as a table and not as bare pipes.
 */
function rangeItemOf(
  row: BoardRow,
  range: RangeSection,
  task: string,
  header: string[],
): ItemFile {
  const number = row.number.trim();
  const table = rowTable(row, header);
  return {
    number,
    name: itemFileName(number, task),
    text: `# ${number}. ${task}\n\n${sharedOf(range)}\n## The row, as it stood at migration\n\n${table.join('\n')}\n`,
  };
}

/** Level-2 headings below the table: prose the board keeps, which the dry run names. */
function proseBelow(board: string): string[] {
  const top = parseBoard(board)?.rows[0]?.line ?? 0;
  return proseLines(board)
    .filter(({ text, line }) => line > top && /^##\s/.test(text))
    .map(({ text }) => text);
}

/** Every numbered item heading's number, in file order, repeats included. */
function sectionNumbers(markdown: string): string[] {
  return markdown.split('\n').flatMap((text) => {
    const number = text.match(ITEM_HEADING)?.[1];
    return number === undefined ? [] : [number];
  });
}

/** One item's block inside another's would land in two files, so it stops the migration. */
function overlaps(blocks: Folded[]): string[] {
  return blocks.flatMap((a) =>
    blocks
      .filter((b) => a !== b && b.start > a.start && b.start <= a.end)
      .map((b) => `item ${b.id}'s section sits inside item ${a.id}'s`),
  );
}

/**
 * D7: the name from the row's task cell, the first line `# <n>. <Title>` from the section's own
 * heading. The body keeps every byte but the trailing blank lines and the `---` the board puts
 * between items, which is the board's layout and not the item's text.
 */
function itemFileOf(row: BoardRow, block: Folded, task: string): ItemFile {
  const number = row.number.trim();
  const title = block.heading.replace(/^#{2,4}\s*/, '');
  const body = block.text.split('\n').slice(1).join('\n');
  return {
    number,
    name: itemFileName(number, task === '' ? title : task),
    text: `# ${title}\n${withoutTrailingRules(body)}`,
  };
}

/** Trailing blank lines and `---` separators off, and one newline to end the file. */
function withoutTrailingRules(text: string): string {
  const lines = text.split('\n');
  while (lines.length > 0 && /^\s*(?:-{3,}\s*)?$/.test(lines.at(-1) ?? '')) lines.pop();
  return `${lines.join('\n')}\n`;
}

type LedgerPart = Pick<Migration, 'frozenAt' | 'steps' | 'log' | 'ledger' | 'problems'>;

/**
 * The step log's section runs from the `##` heading above its first step to the next heading of
 * level two or above after its last, so a standing section after the log, Style rules included,
 * stays where it is. A level-two heading between two steps means the log is split, and no cut
 * can keep both halves' neighbours, so that is a problem and not a guess.
 */
function migrateLedger(markdown: string, date: string, ledgerName: string): LedgerPart {
  const steps = ledgerSteps(markdown);
  const lines = markdown.split('\n');
  const frozenAt = steps.reduce((high, step) => Math.max(high, step.number), 0);
  const logLine = `- ${date} · log frozen at step ${frozenAt} · ${docStem(ledgerName)}-log.md in the archive`;
  const fresh = ['## Log', '', logLine, ''];

  if (/^##\s+Log\s*$/m.test(markdown)) {
    return {
      frozenAt,
      steps: steps.length,
      log: null,
      ledger: markdown,
      problems: ['the ledger already has a `## Log`'],
    };
  }
  if (steps.length === 0)
    return {
      frozenAt,
      steps: 0,
      log: null,
      ledger: withLogSection(lines, fresh),
      problems: [],
    };

  const tops = proseLines(markdown)
    .filter(({ text }) => /^#{1,2}\s/.test(text))
    .map(({ text, line }) => ({ text, line, level: (text.match(/^#+/)?.[0] ?? '').length }));
  const first = Math.min(...steps.map((step) => step.line));
  const last = Math.max(...steps.map((step) => step.line));
  const opener = tops.filter((h) => h.line < first).at(-1);
  const start = opener !== undefined && opener.level === 2 ? opener.line : first;
  const split = tops.filter((h) => h.line > first && h.line < last);
  if (split.length > 0) {
    return {
      frozenAt,
      steps: steps.length,
      log: null,
      ledger: markdown,
      problems: split.map((h) => `the step log is split by \`${h.text}\` at line ${h.line}`),
    };
  }
  // Any heading after the last step ends the log, as `blockStops` has it for the 1.x fold: a
  // `### ` standing section below the log is the ledger's, not the log's.
  const next = proseLines(markdown).find(
    ({ text, line }) => line > last && /^#{1,6}\s/.test(text),
  );
  const end = (next?.line ?? lines.length + 1) - 1;
  // Only blank lines come off the end: a `---` inside the log is the log's own text, and so are
  // two trailing spaces on its last line, which are a markdown line break (item 105's audit).
  const text = lines
    .slice(start - 1, end)
    .join('\n')
    .replace(/\n+$/, '');
  const log: Folded = {
    id: `1-${frozenAt}`,
    heading: lines[start - 1] ?? '',
    text,
    start,
    end,
    stub: null,
  };
  const after = lines.slice(end);
  const ledger = [
    ...lines.slice(0, start - 1),
    ...(after.length === 0 ? fresh.slice(0, 3) : fresh),
    ...after,
  ];
  return {
    frozenAt,
    steps: steps.length,
    log,
    ledger: endWithNewline(ledger.join('\n')),
    problems: [],
  };
}

/** A ledger with no steps gains its `## Log` before Style rules, or at the end. */
function withLogSection(lines: string[], fresh: string[]): string {
  const style = lines.findIndex((text) => /^##\s+Style rules/.test(text));
  if (style !== -1)
    return [...lines.slice(0, style), ...fresh, ...lines.slice(style)].join('\n');
  const body = withoutTrailingRules(lines.join('\n'));
  return `${body}\n${fresh.slice(0, 3).join('\n')}\n`;
}

function endWithNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}
