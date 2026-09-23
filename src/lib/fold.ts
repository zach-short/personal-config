import { type BoardRow, parseBoard } from './board.ts';
import { type LedgerStep, ledgerSteps } from './ledger.ts';
import { headingBlock, proseLines } from './markdown.ts';

/**
 * What a fold lifts out of a live document, computed as data before anything is planned or
 * written. §2.1 already says the two halves are dead weight; this is the arithmetic of removing
 * them, and it touches no disk so that the part worth testing is testable by calling it.
 *
 * The board and the ledger fold differently on purpose. A `DONE` prompt is *replaced* by its
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

export type Fold = { folded: Folded[]; trimmed: string };

const EMPTY: Fold = { folded: [], trimmed: '' };

/**
 * The board half: a `DONE` item's prompt, lifted whole.
 *
 * Only `DONE`, and that is not a preference — `doctor`'s own §2.3 rule reads the other two
 * sections. `supersededProblem` looks in the item's section for what replaced it, and
 * `settledProblem` requires a dated paragraph there carrying the reason, because §2.1's whole
 * point for that status is that it is never re-proposed (`src/doctor/rules/board-status.ts`).
 * Folding either would make this tool's checker fire on the file this tool just wrote.
 *
 * `doneProblem`, next to them, reads the status cell and the ledger and never the section.
 * That asymmetry is §2.1 restated in code: a prompt rots the moment it is executed, and the
 * ledger step is the truth.
 */
export function boardFold(markdown: string): Fold {
  const board = parseBoard(markdown);
  if (board === null) return { ...EMPTY, trimmed: markdown };

  const folded = board.rows.filter(isDone).flatMap((row) => itemBlock(markdown, row));
  return { folded, trimmed: applyFold(markdown, folded) };
}

function isDone(row: BoardRow): boolean {
  return row.status.startsWith('DONE');
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
 */
function stubFor(step: LedgerStep, text: string, date: string): string {
  const done = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  const when = done === undefined ? '' : ` Done ${done}.`;
  return `**${step.number}. ${step.title}**${when} Body folded ${date}.`;
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

/** What the fold is worth, for the report — the one number that answers "is this worth it". */
export function foldedLines(fold: Fold): number {
  return fold.folded.reduce((total, block) => total + (block.end - block.start + 1), 0);
}
