import { join } from 'node:path';
import { confirmWrite } from '../lib/ask.ts';
import {
  type Board,
  type BoardRow,
  cellAt,
  isEmptyCell,
  parseBoard,
  rowByNumber,
  sharedFiles,
  stripTypography,
  withStatus,
} from '../lib/board.ts';
import { today } from '../lib/date.ts';
import { exists, readText } from '../lib/disk.ts';
import { numberedSection } from '../lib/markdown.ts';
import { readDocNames } from '../lib/repo-config.ts';
import type { Cli } from '../lib/types.ts';
import { say, short } from '../lib/ui.ts';
import { commitPlan, resolvePlan } from '../lib/write-plan.ts';
import { edit } from '../render/context.ts';

const USAGE = [
  'usage: personal-config passoff next',
  '       personal-config passoff claim <n>',
].join('\n');

/** The one phrase both the writer and the idempotence check look for. */
const CLAIM_MARK = 'Claimed `IN FLIGHT`';

type Loaded = { path: string; text: string; board: Board };

export async function runPassoff(cli: Cli): Promise<number> {
  const [sub, argument] = cli.paths;
  if (sub !== 'next' && sub !== 'claim') return refuse(USAGE);

  const loaded = await loadBoard(process.cwd());
  if (typeof loaded === 'string') return refuse(loaded);

  return sub === 'next' ? printNext(loaded) : claim(cli, loaded, argument);
}

async function loadBoard(root: string): Promise<Loaded | string> {
  const { board: name } = await readDocNames(root);
  const path = join(root, name);
  if (!(await exists(path))) {
    return `${short(path)} is not there — this repo keeps no board, or \`personal-config setup\` has not run here.`;
  }

  const text = await readText(path);
  const board = parseBoard(text);
  if (!board || board.rows.length === 0) {
    return `${short(path)} has no board table — §2.1 opens it with a \`| # | Task | Status | … |\` header.`;
  }
  return { path, text, board };
}

/**
 * The next `OPEN` row in board order, with its prompt. Board order is the answer rather than any
 * ranking of ours: items inside a lane are serial because each changes the shape the next builds
 * on (§2.1), and nothing in the row says which of two lanes matters more.
 */
function printNext({ path, text, board }: Loaded): number {
  const open = board.rows.filter((row) => row.status === 'OPEN');
  const first = open[0];
  if (!first) return nothingOpen(board, path);

  say(summary(board, first));
  for (const line of warnings(board, first)) say(line);
  say(`\n${prompt(text, first)}`);
  say(`\nTo take it: \`personal-config passoff claim ${first.number}\``);
  if (open.length > 1) {
    say(
      `Also open: ${open
        .slice(1)
        .map((row) => row.number)
        .join(', ')}.`,
    );
  }
  return 0;
}

function nothingOpen(board: Board, path: string): number {
  const flight = board.rows.filter((row) => row.status === 'IN FLIGHT');
  say(`No \`OPEN\` item on ${short(path)}.`);
  if (flight.length > 0) {
    say(`In flight: ${flight.map((row) => `${row.number} (${task(board, row)})`).join(', ')}.`);
  }
  return 0;
}

function summary(board: Board, row: BoardRow): string {
  // Printed as written, including a dash's parenthetical: `— (item 3 done, HANDOFF 6)` is a
  // note to the reader even though `isEmptyCell` correctly says it names no blocker.
  const at = (column: number) => stripTypography(cellAt(row.cells, column)) || '—';
  return [
    `item ${row.number} — ${task(board, row)}`,
    `  Model: ${at(board.columns.model)} · Lane: ${at(board.columns.lane)} · Waits on: ${at(board.columns.waitsOn)}`,
    `  Files it owns: ${at(board.columns.files)}`,
  ].join('\n');
}

function task(board: Board, row: BoardRow): string {
  return cellAt(row.cells, board.columns.task) || '(untitled)';
}

function warnings(board: Board, row: BoardRow): string[] {
  const waits = cellAt(row.cells, board.columns.waitsOn);
  const held = isEmptyCell(waits)
    ? []
    : [
        `\nThis item waits on: ${waits}. Check that before starting it — the board says so, not this tool.`,
      ];
  return [...held, ...collisions(board, row)];
}

/**
 * §2.1's collision check, which is the whole reason the column exists: two items naming the same
 * file do not run at the same time, whatever their lanes say. Checked against what is `IN FLIGHT`
 * rather than against every open item, because an open item nobody is running collides with
 * nothing yet.
 */
function collisions(board: Board, row: BoardRow): string[] {
  const mine = cellAt(row.cells, board.columns.files);
  return board.rows
    .filter((other) => other.status === 'IN FLIGHT')
    .flatMap((other) => {
      const shared = sharedFiles(mine, cellAt(other.cells, board.columns.files));
      return shared.length === 0
        ? []
        : [`\nCollision: item ${other.number} is IN FLIGHT and owns ${shared.join(', ')} too.`];
    });
}

function prompt(text: string, row: BoardRow): string {
  const section = numberedSection(text, row.number);
  if (!section) {
    return `This item has no prompt section below the board. §2.1 asks for one — a row alone is not enough to start from.`;
  }
  // The section runs to the next heading, which on a board means it swallows the `---` rule
  // between items. Printing it would read as part of the prompt.
  const body = section.body.replace(/\s*\n-{3,}\s*$/, '').replace(/\n+$/, '');
  return [section.heading, body].join('\n');
}

async function claim(cli: Cli, loaded: Loaded, number: string | undefined): Promise<number> {
  if (number === undefined) return refuse(USAGE);
  const row = claimable(loaded.board, number, cli.force);
  if (typeof row === 'string') return refuse(row);

  const { text, edits } = claimed(loaded, row);
  const [change] = await resolvePlan([
    edit(loaded.path, `board — item ${number} claimed`, text),
  ]);
  if (!change) return refuse('nothing to write.');
  // The board is the one file every parallel session reads, and nothing locks it. Comparing what
  // the plan re-read against what was parsed does not close that window — it narrows it to the
  // milliseconds between the two reads, and turns a silent lost update into a refusal.
  if (change.before !== loaded.text) {
    return refuse(`${short(loaded.path)} changed while this was reading it. Run it again.`);
  }

  say(preview(loaded.path, edits));
  if (cli.dryRun) {
    say('\n--dry-run: nothing was written.');
    return 0;
  }
  if (!(await confirmWrite(`Mark item ${number} IN FLIGHT?`, cli.force))) {
    say('Nothing was written.');
    return 0;
  }
  const result = await commitPlan([change]);
  say(`\nClaimed item ${number}. Wrote ${result.written.length} file(s).`);
  if (result.manifest) say('`personal-config undo` restores the board as it was.');
  return 0;
}

function claimable(board: Board, number: string, force: boolean): BoardRow | string {
  const row = rowByNumber(board, number);
  if (!row) {
    return `No item ${number} on the board. It has: ${board.rows.map((r) => r.number).join(', ')}.`;
  }
  if (row.status !== 'OPEN') {
    return `Item ${number} is \`${row.status}\`. Only an \`OPEN\` item can be claimed (§2.3).`;
  }
  const clash = collisions(board, row);
  return clash.length > 0 && !force
    ? `${clash.join('\n').trim()}\nClaim it anyway with --force.`
    : row;
}

/** Where a line changed, and to what. */
type Edit = { line: number; before: string | null; after: string };

/**
 * The preview the confirm sits behind, written by the command rather than by `renderDiff`.
 * The generic diff trims a shared head and tail and prints everything between, and these two
 * edits are four hundred lines apart on a real board — so it would print four hundred lines of
 * removal and cap out before reaching the additions. The command knows exactly which two lines
 * it touched; nothing here has to be inferred.
 */
function preview(path: string, edits: Edit[]): string {
  return [
    `--- ${short(path)}`,
    ...edits.flatMap((change) => [
      `  line ${change.line}${change.before === null ? ' (new)' : ''}`,
      ...(change.before === null ? [] : [`    - ${change.before}`]),
      `    + ${change.after}`,
    ]),
  ].join('\n');
}

/**
 * Two edits, both minimal: the status cell, and a dated line under the item's heading. The date
 * cannot go in the status cell — §2.3 allows the six words "and no others", so `IN FLIGHT
 * 2026-09-15` is a status `doctor` rejects — and it cannot go in the prompt, which is not edited
 * after it is written (§2.1). The heading's own blockquote is where this board already records a
 * status change, which is why a claim goes there too.
 */
function claimed({ text, board }: Loaded, row: BoardRow): { text: string; edits: Edit[] } {
  const lines = text.split('\n');
  const backticked = cellAt(row.cells, board.columns.status).includes('`');
  const updated = withStatus(row, board.columns, backticked ? '`IN FLIGHT`' : 'IN FLIGHT');
  lines[row.line - 1] = updated;

  const note = claimNote(lines, row);
  return {
    text: note.lines.join('\n'),
    edits: [{ line: row.line, before: row.text, after: updated }, ...note.edits],
  };
}

function claimNote(lines: string[], row: BoardRow): { lines: string[]; edits: Edit[] } {
  const section = numberedSection(lines.join('\n'), row.number);
  if (!section || section.body.includes(CLAIM_MARK)) return { lines, edits: [] };

  // `section.start` is the heading's own 1-based line, so as an index it is already the line
  // after it: the blank and the note go there, above whatever the section opens with.
  const at = section.start;
  const note = `> **${CLAIM_MARK} ${today()}.**`;
  return {
    lines: [...lines.slice(0, at), '', note, ...lines.slice(at)],
    edits: [{ line: at + 2, before: null, after: note }],
  };
}

function refuse(message: string): number {
  say(message);
  return 1;
}
