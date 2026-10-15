import { basename, join } from 'node:path';
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
import {
  hasItemsFolder,
  type ItemEntry,
  itemText,
  listItems,
  loadItemContext,
  nextFreeItem,
} from '../lib/items.ts';
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

/**
 * The board and, on a 2.0.0 repo, the items folder beside it (per-item-board `DESIGN.md` D1).
 * `items` is empty on a 1.x repo, and every item is then read from its board section (D12).
 */
type Loaded = {
  root: string;
  path: string;
  text: string;
  board: Board;
  itemsDir: string;
  items: ItemEntry[];
};

export async function runPassoff(cli: Cli): Promise<number> {
  const [sub, argument] = cli.paths;
  if (sub !== 'next' && sub !== 'claim') return refuse(USAGE);

  const loaded = await loadBoard(process.cwd());
  if (typeof loaded === 'string') return refuse(loaded);

  return sub === 'next' ? await printNext(loaded) : claim(cli, loaded, argument);
}

async function loadBoard(root: string): Promise<Loaded | string> {
  const { board: name, items: itemsName } = await readDocNames(root);
  const path = join(root, name);
  if (!(await exists(path))) {
    return `${short(path)} is not there — this repo keeps no board, or \`personal-config setup\` has not run here.`;
  }

  const text = await readText(path);
  const board = parseBoard(text);
  if (!board || board.rows.length === 0) {
    return `${short(path)} has no board table — §2.1 opens it with a \`| # | Task | Status | … |\` header.`;
  }
  const itemsDir = join(root, itemsName);
  return { root, path, text, board, itemsDir, items: await listItems(itemsDir) };
}

/**
 * The next `OPEN` row in board order, with its prompt. Board order is the answer rather than any
 * ranking of ours: items inside a lane are serial because each changes the shape the next builds
 * on (§2.1), and nothing in the row says which of two lanes matters more.
 */
async function printNext(loaded: Loaded): Promise<number> {
  const { path, board } = loaded;
  const open = board.rows.filter((row) => row.status === 'OPEN');
  const first = open[0];
  if (!first) return nothingOpen(board, path);

  say(summary(board, first));
  for (const line of warnings(board, first)) say(line);
  say(`\n${prompt(loaded, first)}`);
  say(`\nTo take it: \`personal-config passoff claim ${first.number}\``);
  if (open.length > 1) {
    say(
      `Also open: ${open
        .slice(1)
        .map((row) => row.number)
        .join(', ')}.`,
    );
  }
  if (hasItemsFolder(loaded.itemsDir)) say(await nextFree(loaded));
  return 0;
}

/**
 * D16: a closed row leaves the table at the fold, so the board alone no longer knows every
 * number taken. Printed only on a 2.0.0 repo; a 1.x board's highest row is the answer, as it was.
 */
async function nextFree({ root, board, itemsDir, items }: Loaded): Promise<string> {
  const { archived } = await loadItemContext(root, basename(itemsDir));
  const rows = board.rows.map((row) => row.number);
  const next = nextFreeItem(rows, items, archived ?? []);
  const unread =
    archived === null ? ' The archive could not be read, so check it before taking it.' : '';
  return `A new item takes number ${next}: the highest of the board, ${basename(itemsDir)}/ and the archive's.${unread}`;
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

/**
 * The item's own file when it has one, with its path, so a session knows which one file to open;
 * otherwise its section below the board (D12). Both come through `itemText`, the one reader.
 */
function prompt({ text, items, itemsDir }: Loaded, row: BoardRow): string {
  const item = itemText(items, text, row.number);
  if (!item) {
    return `This item has no prompt section below the board. §2.1 asks for one — a row alone is not enough to start from.`;
  }
  if (item.from === 'file') {
    return [
      `From ${short(join(itemsDir, item.name))}:`,
      '',
      item.text.replace(/\n+$/, ''),
    ].join('\n');
  }
  // The section runs to the next heading, which on a board means it swallows the `---` rule
  // between items. Printing it would read as part of the prompt.
  return item.text.replace(/\s*\n-{3,}\s*$/, '').replace(/\n+$/, '');
}

async function claim(cli: Cli, loaded: Loaded, number: string | undefined): Promise<number> {
  if (number === undefined) return refuse(USAGE);
  const row = claimable(loaded.board, number, cli.force);
  if (typeof row === 'string') return refuse(row);

  const targets = claimed(loaded, row);
  const changes = await resolvePlan(
    targets.map((target) =>
      edit(target.path, `${target.label} — item ${number} claimed`, target.after),
    ),
  );
  if (changes.length === 0) return refuse('nothing to write.');
  // The board is the one file every parallel session reads, and nothing locks it or the item
  // file. Comparing what the plan re-read against what was parsed does not close that window —
  // it narrows it to the milliseconds between the two reads, and turns a silent lost update into
  // a refusal. Both files are guarded, because a claim note lost from either is the same bug.
  const moved = targets.find((target, index) => changes[index]?.before !== target.before);
  if (moved)
    return refuse(`${short(moved.path)} changed while this was reading it. Run it again.`);

  say(targets.map((target) => preview(target.path, target.edits)).join('\n'));
  if (cli.dryRun) {
    say('\n--dry-run: nothing was written.');
    return 0;
  }
  if (!(await confirmWrite(`Mark item ${number} IN FLIGHT?`, cli.force))) {
    say('Nothing was written.');
    return 0;
  }
  const result = await commitPlan(changes);
  say(`\nClaimed item ${number}. Wrote ${result.written.length} file(s).`);
  if (result.manifest) say('`personal-config undo` restores what this changed.');
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

/** One file a claim writes: what was read, what it becomes, and the lines that changed. */
type Target = { path: string; label: string; before: string; after: string; edits: Edit[] };

/**
 * Two edits, both minimal: the status cell, and a dated line under the item's heading. The date
 * cannot go in the status cell — §2.3 allows the six words "and no others", so `IN FLIGHT
 * 2026-09-15` is a status `doctor` rejects — and it cannot go in the prompt, which is not edited
 * after it is written (§2.1). The heading's own blockquote is where this board already records a
 * status change, which is why a claim goes there too.
 *
 * On a 2.0.0 repo the heading is the item file's first line, so the note goes there and the
 * board gets the status cell alone (per-item-board `DESIGN.md` §4.1, §4.5).
 */
function claimed(loaded: Loaded, row: BoardRow): Target[] {
  const { path, text, board, items, itemsDir } = loaded;
  const lines = text.split('\n');
  const backticked = cellAt(row.cells, board.columns.status).includes('`');
  const updated = withStatus(row, board.columns, backticked ? '`IN FLIGHT`' : 'IN FLIGHT');
  lines[row.line - 1] = updated;
  const status: Edit = { line: row.line, before: row.text, after: updated };

  const item = itemText(items, text, row.number);
  if (item?.from !== 'file') return [noteInSection(path, text, lines, row, status)];
  const boardOnly = {
    path,
    label: 'board',
    before: text,
    after: lines.join('\n'),
    edits: [status],
  };
  return [boardOnly, noteInFile(join(itemsDir, item.name), item.text)];
}

/** A 1.x board: the status cell and the note both land in the board (D12). */
function noteInSection(
  path: string,
  before: string,
  lines: string[],
  row: BoardRow,
  status: Edit,
): Target {
  const section = numberedSection(lines.join('\n'), row.number);
  const note =
    section && !section.body.includes(CLAIM_MARK)
      ? claimNote(lines, section.start)
      : { lines, edits: [] };
  return {
    path,
    label: 'board',
    before,
    after: note.lines.join('\n'),
    edits: [status, ...note.edits],
  };
}

/** A 2.0.0 item: the note goes under the file's `# <n>.` line, which is its line 1. */
function noteInFile(path: string, before: string): Target {
  const lines = before.split('\n');
  const note = before.includes(CLAIM_MARK) ? { lines, edits: [] } : claimNote(lines, 1);
  return { path, label: 'item file', before, after: note.lines.join('\n'), edits: note.edits };
}

/**
 * The note under the heading at 1-based line `heading`. That line number, as an index, is
 * already the line after it, so the blank and the note go there, above whatever follows.
 */
function claimNote(lines: string[], heading: number): { lines: string[]; edits: Edit[] } {
  const note = `> **${CLAIM_MARK} ${today()}.**`;
  return {
    lines: [...lines.slice(0, heading), '', note, ...lines.slice(heading)],
    edits: [{ line: heading + 2, before: null, after: note }],
  };
}

function refuse(message: string): number {
  say(message);
  return 1;
}
