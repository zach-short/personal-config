import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { withIndexLine } from '../lib/archive-index.ts';
import { confirmWrite } from '../lib/ask.ts';
import { today } from '../lib/date.ts';
import { exists, readText } from '../lib/disk.ts';
import {
  type Fold,
  type Folded,
  foldedLines,
  type ItemMove,
  itemFold,
  ledgerFold,
  logFold,
  type Migration,
  migrateFold,
  boardFold as sectionFold,
  withoutRows,
} from '../lib/fold.ts';
import { hasItemsFolder, isItemFor, listItems } from '../lib/items.ts';
import { LOG_DAYS } from '../lib/log.ts';
import { expandHome } from '../lib/paths.ts';
import {
  type DocNames,
  docStem,
  readArchiveHome,
  readDocNames,
  readLedgerFrozenAt,
} from '../lib/repo-config.ts';
import type { Cli, PlannedFile } from '../lib/types.ts';
import { previewTree, renderDiff, say, short } from '../lib/ui.ts';
import {
  commitPlan,
  type PlannedChange,
  resolvePlan,
  resolveRemoval,
  type WriteResult,
} from '../lib/write-plan.ts';
import { edit } from '../render/context.ts';

const USAGE = [
  'usage: personal-config fold [board|ledger|migrate] [--keep <n>] [--log-days <n>]',
  '',
  'Moves what §2.1 already calls dead weight out of the live documents and into the archive:',
  "a `DONE` item's prompt, and every ledger step body but the newest --keep (default 20).",
  'The board keeps every row; the ledger keeps every step number, title and date.',
  `In a repo with an items folder, a \`DONE\` item's file and its row move to the archive, and`,
  `ledger log lines older than --log-days (default ${LOG_DAYS}) move to the archive's log.`,
  'With no target it does both.',
  '',
  '`fold migrate` converts a 1.x repo once: the step log and the `DONE` prompts to the archive,',
  "every other item's section to its own file, then the live board and ledger cut.",
].join('\n');

type Which = 'board' | 'ledger';

/** One archive file this half writes, with its whole new text. */
type ArchiveWrite = { path: string; text: string; label: string };

/**
 * What the read-back looks for before a single live byte goes. An item file (`bytes` set) must
 * be the archive file whole; otherwise `text` must be somewhere in an appended file. `live`,
 * where set, is the file the fold will remove, and it must still hold those bytes too: an edit
 * made after the fold read it would otherwise leave the live folder with no archive copy.
 */
type Check = {
  id: string;
  archive: string;
  text: string;
  /**
   * An item file's raw bytes as the fold read them, or null for an appended block. Where set,
   * the archive file and the live file must both equal these bytes exactly (D6). A decoded
   * compare is not enough: a byte that is not valid UTF-8 decodes to U+FFFD on both sides, the
   * strings match, and the live file would go with different bytes in the archive.
   */
  bytes: Buffer | null;
  live: string | null;
};

/** A line `INDEX.md` gains when nothing in it yet names `key` in bold. */
type IndexEntry = { key: string; line: string };

type Half = {
  which: Which;
  /** The document being trimmed. */
  livePath: string;
  trimmed: string;
  writes: ArchiveWrite[];
  checks: Check[];
  /** Live files deleted once their archive copy is read back (D6, D14). */
  removals: string[];
  index: IndexEntry[];
  /** For the report: what moved, how much, and where to. */
  ids: string[];
  moved: string;
  dest: string;
  /** Items the fold leaves alone, each with the reason. */
  held: string[];
};

/**
 * Part 7's closing steps for Profile L, as one command.
 *
 * It writes in two passes, and the order is the whole safety argument. A ledger and a board are
 * routinely **untracked** — this repo's own are, and §2.1's note says why: they are personal
 * process, not part of the public repo — so git is not holding a copy of what is about to be
 * cut. The archive append is committed first and read back before a single line leaves the live
 * document, which is Part 7 step 3 applied to text rather than to files: "verify each file
 * actually arrived before trusting the deletion". One commit in repo A deleted five docs and
 * archived three.
 *
 * A migrated repo (per-item-board `DESIGN.md` D6, D16, D4) keeps that order with whole files: each
 * `DONE` item file is written to the archive and read back, and only then do the index line, the
 * row's removal and the live file's removal go, in one `commitPlan` that backs all of them up
 * first. The log retention is `--log-days` (DIAL-4), 90 days when the flag is absent.
 */
export async function runFold(cli: Cli): Promise<number> {
  const targets = cli.paths[0] === 'migrate' ? [] : which(cli.paths[0]);
  if (targets === null) return refuse(USAGE);

  const root = process.cwd();
  const home = await readArchiveHome(root);
  if (home === null) return refuse(noArchiveHome(root));

  const archiveHome = expandHome(home);
  if (!(await exists(join(archiveHome, 'INDEX.md')))) return refuse(noIndex(archiveHome));
  if (targets.length === 0) return runMigrate(cli, root, archiveHome);

  const prepared = await prepareAll(root, archiveHome, targets, cli.keep, cli.logDays);
  const halves = prepared.filter((half) => half.ids.length > 0);
  reportHeld(prepared);
  if (halves.length === 0) return note(nothingToFold(targets, cli.keep, cli.logDays));

  report(halves);
  return write(cli, archiveHome, halves);
}

function which(target: string | undefined): Which[] | null {
  if (target === undefined || target === 'all') return ['board', 'ledger'];
  if (target === 'board' || target === 'ledger') return [target];
  return null;
}

async function prepareAll(
  root: string,
  archiveHome: string,
  targets: Which[],
  keep: number,
  logDays: number,
): Promise<Half[]> {
  const names = await readDocNames(root);
  const prepared = await Promise.all(
    targets.map((target) =>
      target === 'board'
        ? prepareBoard(root, archiveHome, names)
        : prepareLedger(root, archiveHome, names.ledger, keep, logDays),
    ),
  );
  return prepared.filter((half): half is Half => half !== null);
}

/** Null where there is no board, or where it holds nothing this would move or hold. */
async function prepareBoard(
  root: string,
  archiveHome: string,
  names: DocNames,
): Promise<Half | null> {
  const livePath = join(root, names.board);
  if (!(await exists(livePath))) return null;
  const text = await readText(livePath);
  const itemsDir = join(root, names.items);
  // D12: migrated is read from the folder on disk, never from the config's default name.
  if (hasItemsFolder(itemsDir)) {
    return prepareItems(livePath, text, itemsDir, join(archiveHome, names.items), names.items);
  }
  return prepareAppend(livePath, 'board', sectionFold(text), archiveHome, names.board, 'board');
}

async function prepareLedger(
  root: string,
  archiveHome: string,
  name: string,
  keep: number,
  logDays: number,
): Promise<Half | null> {
  const livePath = join(root, name);
  if (!(await exists(livePath))) return null;
  const text = await readText(livePath);
  // A migrated ledger has no step log left to fold; its `## Log` is what ages out (D4).
  const frozen = (await readLedgerFrozenAt(root)) !== null;
  const fold = frozen ? logFold(text, logDays, today()) : ledgerFold(text, keep, today());
  return prepareAppend(livePath, 'ledger', fold, archiveHome, name, frozen ? 'log' : 'ledger');
}

/** How a half's lifted text is appended: the 1.x board, the 1.x ledger, or the `## Log`. */
type AppendKind = 'board' | 'ledger' | 'log';

async function prepareAppend(
  livePath: string,
  which: Which,
  fold: Fold,
  archiveHome: string,
  source: string,
  kind: AppendKind,
): Promise<Half | null> {
  if (fold.folded.length === 0) return null;
  const archivePath = join(
    archiveHome,
    `${docStem(source)}-${which === 'board' ? 'closed' : 'log'}.md`,
  );
  const name = basename(archivePath);
  const noun = { board: 'prompt(s)', ledger: 'step bod(ies)', log: 'log line(s)' }[kind];
  return {
    which,
    livePath,
    trimmed: fold.trimmed,
    writes: [
      {
        path: archivePath,
        text: await appended(archivePath, kind, source, fold),
        label: `archive — ${which} entries from this run`,
      },
    ],
    checks: fold.folded.map((block) => ({
      id: `${which} ${block.id}`,
      archive: archivePath,
      text: bodyOf(block),
      bytes: null,
      live: null,
    })),
    removals: [],
    index: [{ key: name, line: `- **${name}** ✅ — ${indexWhat(kind)}. Opened ${today()}.` }],
    ids: fold.folded.map((block) => block.id),
    moved: `${fold.folded.length} ${noun}, ${foldedLines(fold)} line(s)`,
    dest: archivePath,
    held: [],
  };
}

function indexWhat(kind: AppendKind): string {
  if (kind === 'board') return 'closed board prompts, appended as items are folded';
  if (kind === 'ledger') return 'folded ledger step bodies, appended as the log is folded';
  return 'folded ledger log lines, appended as the log is folded';
}

/**
 * The board half on a migrated board (D6, D16). An archive file that already holds the same bytes
 * is not written again, which is what makes a fold after `undo` safe; one with different bytes
 * holds that item, because no tool can judge which copy is the real one.
 */
async function prepareItems(
  livePath: string,
  board: string,
  itemsDir: string,
  archiveItems: string,
  itemsName: string,
): Promise<Half | null> {
  const moves = itemFold(board, await listItems(itemsDir));
  if (moves.length === 0) return null;

  const found = await Promise.all(
    moves.map(async (move) => ({
      move,
      raw: await rawBytes(join(itemsDir, move.name)),
      there: await rawBytes(join(archiveItems, move.name)),
    })),
  );
  const moving = found.flatMap(({ move, raw, there }) =>
    raw !== null && (there === null || there.equals(raw)) ? [{ move, raw, there }] : [],
  );
  const fresh = moving.filter(({ there }) => there === null).map(({ move }) => move);
  const go = moving.map(({ move }) => move);
  const held = found
    .filter(({ raw, there }) => raw !== null && there !== null && !there.equals(raw))
    .map(({ move }) => move);

  return {
    which: 'board',
    livePath,
    trimmed: withoutRows(
      board,
      go.map((move) => move.line),
    ),
    writes: fresh.map((move) => ({
      path: join(archiveItems, move.name),
      text: move.text,
      label: `archive — item ${move.number}`,
    })),
    checks: moving.map(({ move, raw }) => ({
      id: `item ${move.number}`,
      archive: join(archiveItems, move.name),
      text: move.text,
      bytes: raw,
      live: join(itemsDir, move.name),
    })),
    removals: go.map((move) => join(itemsDir, move.name)),
    index: [folderEntry(itemsName), ...go.map((move) => itemEntry(itemsName, move))],
    ids: go.map((move) => move.number),
    moved: `${go.length} item file(s) and their row(s)`,
    dest: `${archiveItems}/`,
    held: held.map((move) => heldNote(move, join(archiveItems, move.name))),
  };
}

/**
 * `archive-index` clears a folder only on a line whose bold text is the folder name and a slash,
 * so the item lines below, which name a file inside it, do not. Without this line the first fold
 * turns the archive's own doctor red.
 */
function folderEntry(itemsName: string): IndexEntry {
  return {
    key: `${itemsName}/`,
    line: `- **${itemsName}/** ✅ — closed board item files, one per item, moved here by \`personal-config fold\`. Opened ${today()}.`,
  };
}

/** D16's line: the row's task text goes with it, because the row leaves the table. */
function itemEntry(itemsName: string, move: ItemMove): IndexEntry {
  const key = `${itemsName}/${move.name}`;
  return {
    key,
    line: `- **${key}** ✅ — item ${move.number}, ${move.task}, closed ${move.closed ?? today()}.`,
  };
}

function heldNote(move: ItemMove, archived: string): string {
  return `item ${move.number}: ${short(archived)} already exists with different bytes. Neither copy can be judged the real one, so the item, its file and its row stay.`;
}

/**
 * The archive file's new contents: whatever it already held, then this run's entries under a
 * dated header. Built here rather than through the `append-lines` strategy, which exists for
 * ignore files and adds only lines the file does not already have — deduplicating *prose* would
 * silently drop a repeated sentence out of the middle of an archived prompt.
 *
 * Log lines are joined one to a line, as they stood in the ledger; prompts and step bodies are
 * blocks, so a blank line separates them.
 */
async function appended(
  path: string,
  kind: AppendKind,
  source: string,
  fold: Fold,
): Promise<string> {
  const existing = (await exists(path)) ? await readText(path) : preamble(kind, source);
  const fresh = fold.folded.filter((block) => !existing.includes(bodyOf(block)));
  if (fresh.length === 0) return existing;

  const noun = { board: 'prompt', ledger: 'step', log: 'log line' }[kind];
  const header = `## Folded ${today()} from \`${source}\` — ${fold.count ?? fresh.length} ${noun}(s)`;
  const joiner = kind === 'log' ? '\n' : '\n\n';
  return `${existing.replace(/\n+$/, '')}\n\n${header}\n\n${fresh.map(bodyOf).join(joiner)}\n`;
}

/**
 * One spelling of a block's archived text, shared by the append and the verification that
 * follows it. Two spellings would drift, and the drift is silent in the worst direction: a
 * verification that looks for text the append never wrote refuses a fold that worked, and one
 * that looks for less than was written passes a fold that did not.
 */
function bodyOf(block: Folded): string {
  return block.text.replace(/\n+$/, '');
}

/** Written once, when the file is created. It says what the file is *for*, which is not obvious. */
function preamble(kind: AppendKind, source: string): string {
  if (kind === 'board') return boardPreamble(source);
  return kind === 'ledger' ? ledgerPreamble(source) : logPreamble(source);
}

function boardPreamble(source: string): string {
  return [
    `# Closed prompts — \`${source}\``,
    '',
    'Prompts lifted off the board by `personal-config fold`, oldest run first. Each is the',
    'prompt as it stood when its item closed.',
    '',
    '**Do not paste one.** §2.1: a prompt rots the moment it is executed, and the ledger step',
    'its board row cites is the record. These are kept so that a question about how something',
    'was once asked has an answer — not so the work can be run again.',
  ].join('\n');
}

function ledgerPreamble(source: string): string {
  return [
    `# Folded step bodies — \`${source}\``,
    '',
    'Step bodies lifted out of the ledger by `personal-config fold`, oldest run first.',
    '',
    'The ledger still holds every step: its number, its title and its date. A step is cited by',
    'number forever — "HANDOFF 24" is how everything refers to work — so the citation still',
    'resolves there, and what step 24 actually said is here.',
  ].join('\n');
}

function logPreamble(source: string): string {
  return [
    `# Folded log — \`${source}\``,
    '',
    'Lines lifted out of the ledger by `personal-config fold`, oldest run first. Each is a',
    'dated log line as it stood under `## Log`, moved here once it passed the retention dial.',
  ].join('\n');
}

function report(halves: Half[]): void {
  say('fold:');
  for (const half of halves) {
    say(`  ${short(half.livePath)} — ${half.moved} → ${short(half.dest)}`);
    say(`    ${half.which === 'board' ? 'items' : 'entries'} ${half.ids.join(', ')}`);
  }
  say(`\n${keptNote(halves)}`);
}

function reportHeld(halves: Half[]): void {
  const held = halves.flatMap((half) => half.held);
  if (held.length === 0) return;
  say('Held, and not folded:');
  for (const line of held) say(`  ${line}`);
  say('');
}

/** What survives is the part worth stating plainly, because it is what a reader will doubt. */
function keptNote(halves: Half[]): string {
  const lines = ['What stays:'];
  for (const half of halves) lines.push(...keptLines(half));
  return lines.join('\n');
}

function keptLines(half: Half): string[] {
  if (half.removals.length > 0) {
    return [
      '  the board — every row but the ones above. Each row that leaves is one line in the',
      '  archive index with its task text, and its number stays taken: the next free number',
      '  reads the archive folder too.',
    ];
  }
  if (half.which === 'board') {
    return [
      '  the board — every row, including each `DONE` row and its pointer at the ledger step.',
      '  `SUPERSEDED` and `SETTLED AS NO` keep their sections: `doctor` reads those for the',
      '  replacement and the reason, and §2.1 asks that a settled no is never re-proposed.',
    ];
  }
  if (half.moved.includes('log line')) {
    return [
      '  the ledger — every standing section, and every log line inside the retention dial.',
    ];
  }
  return [
    '  the log — every step number, title and date, as a one-line stub. The numbering stays',
    '  contiguous, `handoff step` hands out the same next number, and `DONE — <n>` resolves.',
    '  Standing sections are untouched; they are edited in place, never archived.',
  ];
}

async function write(cli: Cli, archiveHome: string, all: Half[]): Promise<number> {
  const halves = await unguarded(archiveHome, all);
  if (halves.length === 0) return 1;
  const archive = await resolvePlan(halves.flatMap(archiveFiles));
  const trim = await resolvePlan(halves.map(trimFile));
  const removals = await Promise.all(
    halves.flatMap((half) =>
      half.removals.map((path) => resolveRemoval(path, 'item — folded')),
    ),
  );
  say(`\n${preview([...archive, ...trim, ...removals])}`);

  if (cli.dryRun) return note('\n--dry-run: nothing was archived, nothing was trimmed.');
  if (!(await confirmWrite('Archive these, then trim the live document(s)?', cli.force))) {
    return note('Nothing was folded.');
  }

  await commitPlan(archive);
  // The read-back sits here, between the archive write and every removal (D6): nothing below
  // runs until each item file and each block is in the archive, byte for byte.
  const missing = await missingFromArchive(halves);
  if (missing.length > 0) return refuse(notArrived(missing));

  say(`\nArchived, and verified every block arrived (Part 7 step 3).`);
  const index = await resolvePlan(await indexEdits(archiveHome, halves));
  // Asked again here, because the index can gain an `adapted` stamp while the confirm sits open,
  // and a guarded index line is skipped while the removal beside it would still land.
  const guarded = index.filter((change) => change.guard !== 'none');
  if (guarded.length > 0 && removals.length > 0) return refuse(heldForGuard(guarded));
  // One plan, so one backup taken before any of it lands: the index line first, then the trims,
  // then the removals, which `commitPlan` refuses without their backup in hand (D14).
  return finish(await commitPlan([...index, ...trim, ...removals]), halves);
}

/**
 * The halves that can fold whole. `edit()` is an overwrite, so a board or an `INDEX.md` whose
 * stamp is marked `adapted` (or missing, on a file that carries ours) makes its trim or its index
 * line a no-op in `commitPlan` — while a removal beside it still lands. That leaves a live `DONE`
 * row whose file is gone and an archive file no index line names, and exits 0. So an item half
 * with a guarded board or index is held whole, before anything is written (D16).
 */
async function unguarded(archiveHome: string, halves: Half[]): Promise<Half[]> {
  const index = await resolvePlan(await indexEdits(archiveHome, halves));
  const indexGuarded = index.filter((change) => change.guard !== 'none');
  const kept: Half[] = [];
  for (const half of halves) {
    const [trim] = half.removals.length > 0 ? await resolvePlan([trimFile(half)]) : [];
    const guarded = [...indexGuarded, ...(trim && trim.guard !== 'none' ? [trim] : [])];
    if (half.removals.length === 0 || guarded.length === 0) kept.push(half);
    else say(heldForGuard(guarded));
  }
  return kept;
}

function heldForGuard(guarded: PlannedChange[]): string {
  return [
    '\nHeld the item files, and nothing was moved or removed:',
    ...guarded.map((change) => `  ${short(change.file.path)}: ${guardReason(change)}`),
    'This tool will not rewrite that file, so the row could not leave the board or the index',
    'line could not be written, and removing the item file alone would break both. Take the',
    'marker off (or fold those items by hand), then run this again.',
  ].join('\n');
}

function guardReason(change: PlannedChange): string {
  return change.guard === 'adapted'
    ? 'its stamp is marked `adapted`, so it is the repo’s own'
    : 'it carries no stamp, so this tool did not write it';
}

function archiveFiles(half: Half): PlannedFile[] {
  return half.writes.map((entry) => edit(entry.path, entry.label, entry.text));
}

function trimFile(half: Half): PlannedFile {
  return edit(half.livePath, `${half.which} — folded`, half.trimmed);
}

/**
 * Every block, looked for in the file that now claims to hold it. Byte-for-byte against the
 * text that was lifted, because a check that the *count* went up would pass on a truncated
 * write — which is the failure this ordering exists to catch, at the one moment the live
 * document is still whole.
 */
async function missingFromArchive(halves: Half[]): Promise<string[]> {
  const gone: string[] = [];
  for (const check of halves.flatMap((half) => half.checks)) {
    if (!(await arrived(check))) gone.push(check.id);
  }
  return gone;
}

async function arrived(check: Check): Promise<boolean> {
  if (check.bytes !== null) return sameBytes(check.bytes, check.archive, check.live);
  const there = await readText(check.archive).catch(() => null);
  return there?.includes(check.text) === true;
}

/** The archive copy and the live file, each exactly these bytes, read raw and never decoded. */
async function sameBytes(
  bytes: Buffer,
  archive: string,
  live: string | null,
): Promise<boolean> {
  const there = await rawBytes(archive);
  if (there === null || !there.equals(bytes)) return false;
  if (live === null) return true;
  return (await rawBytes(live))?.equals(bytes) === true;
}

/**
 * A file's bytes, undecoded, or null where it cannot be read. `readFile` from `node:fs/promises`
 * directly, because `disk.ts` reads text only and the read-back must compare bytes (D6).
 */
async function rawBytes(path: string): Promise<Buffer | null> {
  return readFile(path).catch(() => null);
}

async function indexEdits(archiveHome: string, halves: Half[]): Promise<PlannedFile[]> {
  const path = join(archiveHome, 'INDEX.md');
  const before = await readText(path).catch(() => null);
  if (before === null) return [];

  const after = halves.flatMap((half) => half.index).reduce(withEntry, before);
  return after === before ? [] : [edit(path, 'archive index — one line per fold file', after)];
}

/** §8.2: a doc with no index line is invisible. Each line is written once, when first needed. */
function withEntry(text: string, entry: IndexEntry): string {
  return text.includes(`**${entry.key}**`) ? text : withIndexLine(text, entry.line);
}

/** A removal shows in the tree as removed; its lines are in the archive write's diff already. */
function preview(changes: PlannedChange[]): string {
  const real = changes.filter((change) => change.before !== change.after || change.remove);
  if (real.length === 0) return 'Nothing would change.';
  return [
    'What this writes:',
    '',
    previewTree(real),
    ...real.filter((c) => c.remove !== true).map((c) => `\n${renderDiff(c)}`),
  ].join('\n');
}

function finish(result: WriteResult, halves: Half[]): number {
  say(`\nWrote ${result.written.length} file(s), ${result.removed.length} of them removed.`);
  // Precise on purpose. `undo` restores the *latest* backup and is one-shot, and this command
  // commits twice — the archive, then the trim — so the backup `undo` reaches is the trim's.
  // That is the half worth restoring, and re-running the fold afterwards is safe rather than
  // duplicating: `appended` skips any block the archive already holds, and an item file the
  // archive holds byte for byte is not written again.
  if (result.manifest) {
    say('`personal-config undo` restores the live document(s) and any item file this removed.');
    say('The archive keeps this run’s entries either way — folding again appends nothing it');
    say('already holds.');
  }
  say(`${halves.map((half) => `${short(half.livePath)}: ${half.moved}`).join('\n')}`);
  say('\nRun your gates and `personal-config doctor .` before committing — the fold rewrites');
  say('documents other rules read, and a green doctor is what says it rewrote them correctly.');
  return 0;
}

function nothingToFold(targets: Which[], keep: number, logDays: number): string {
  const named = targets.join(' and ');
  return [
    `Nothing to fold in the ${named}.`,
    `Either there is no such document here, or every \`DONE\` prompt or item file is already`,
    `out, the log is already ${keep} step(s) or shorter, and no log line is older than ${logDays} days.`,
  ].join('\n');
}

function notArrived(missing: string[]): string {
  return [
    `\nThe archive is missing ${missing.length} block(s) it should now hold: ${missing.slice(0, 5).join(', ')}.`,
    'Nothing was trimmed and nothing was removed — the live document(s) and item files are',
    'exactly as they were. An archive file this run created has no backup, so `undo` cannot',
    'take it back: delete a partial or wrong archive file by hand before you fold again.',
  ].join('\n');
}

function noArchiveHome(root: string): string {
  return [
    `${short(root)} has no archive home recorded in .personal-config.json.`,
    'Run `personal-config setup` in this repo and answer the archive question first —',
    'without it there is nowhere for the folded text to go, and a fold that only deleted',
    'would be the one thing this must never do.',
  ].join('\n');
}

function noIndex(archiveHome: string): string {
  return [
    `${short(archiveHome)} has no INDEX.md.`,
    'An archive without its index is a folder of orphans (§8.2), and seeding one is',
    "`personal-config setup`'s job, not this command's.",
  ].join('\n');
}

function note(message: string): number {
  say(message);
  return 0;
}

function refuse(message: string): number {
  say(message);
  return 1;
}

/**
 * `fold migrate` (per-item-board `DESIGN.md` D5, BD-1): the one-time conversion of a 1.x repo.
 *
 * Three commits behind one confirm, in the fold's safety order. The archive appends go first and
 * are read back; then the item files, read back byte for byte; only then the cut board, the cut
 * ledger and the two config keys, in one `commitPlan` so one backup holds all three and `undo`
 * restores them together. Nothing live is cut until every byte it held is somewhere else.
 */
async function runMigrate(cli: Cli, root: string, archiveHome: string): Promise<number> {
  const plan = await planMigrate(root, archiveHome);
  if (typeof plan === 'string') return refuse(plan);
  const { migration, itemsDir, halves, archive, items, live } = plan;

  reportMigration(migration, itemsDir);
  say(`\n${preview([...archive, ...items, ...live])}`);
  if (cli.dryRun) return note('\n--dry-run: nothing was archived, written or cut.');
  const asked = 'Archive, write the item files, then cut the live documents?';
  if (!(await confirmWrite(asked, cli.force))) return note('Nothing was migrated.');

  await commitPlan(archive);
  const missing = await missingFromArchive(halves);
  if (missing.length > 0) return refuse(notArrived(missing));
  await commitPlan(items);
  const unwritten = await missingItems(itemsDir, migration);
  if (unwritten.length > 0) return refuse(itemsNotArrived(unwritten));

  say('\nArchived and wrote every item file, and read each one back.');
  const index = await resolvePlan(await indexEdits(archiveHome, halves));
  return finishMigrate(await commitPlan([...index, ...live]), migration, itemsDir);
}

type MigratePlan = {
  migration: Migration;
  itemsDir: string;
  halves: Half[];
  archive: PlannedChange[];
  items: PlannedChange[];
  live: PlannedChange[];
};

/** Everything `migrate` would write, resolved, or the reason it writes nothing. */
async function planMigrate(root: string, archiveHome: string): Promise<MigratePlan | string> {
  if ((await readLedgerFrozenAt(root)) !== null) return alreadyMigrated(root);
  const names = await readDocNames(root);
  const boardPath = join(root, names.board);
  const ledgerPath = join(root, names.ledger);
  const board = (await exists(boardPath)) ? await readText(boardPath) : '';
  const ledger = (await exists(ledgerPath)) ? await readText(ledgerPath) : '';
  if (board === '' && ledger === '') return 'There is no board and no ledger to migrate.';

  const migration = migrateFold(board, ledger, today(), names.ledger);
  const itemsDir = join(root, names.items);
  const problems = [...migration.problems, ...(await clashingItems(itemsDir, migration))];
  if (problems.length > 0) return cannotMigrate(problems);

  const halves = await migrateHalves(migration, archiveHome, names, boardPath, ledgerPath);
  const live = await resolvePlan([
    ...(board === '' ? [] : [edit(boardPath, 'board — cut to its table', migration.board)]),
    ...(ledger === '' ? [] : [edit(ledgerPath, 'ledger — step log frozen', migration.ledger)]),
    await configEdit(root, names.items, migration.frozenAt),
  ]);
  const guarded = live.filter((change) => change.guard !== 'none');
  if (guarded.length > 0) return migrateGuarded(guarded);
  return {
    migration,
    itemsDir,
    halves,
    archive: await resolvePlan(halves.flatMap(archiveFiles)),
    items: await resolvePlan(
      migration.items.map((item) =>
        edit(join(itemsDir, item.name), `item ${item.number}`, item.text),
      ),
    ),
    live,
  };
}

/** The two appends, shaped as halves so the fold's own write and read-back carry them. */
async function migrateHalves(
  migration: Migration,
  archiveHome: string,
  names: DocNames,
  boardPath: string,
  ledgerPath: string,
): Promise<Half[]> {
  const closed: Fold = { folded: migration.closed, trimmed: migration.board };
  const log: Fold = {
    folded: migration.log === null ? [] : [migration.log],
    trimmed: migration.ledger,
    count: migration.steps,
  };
  const halves = await Promise.all([
    prepareAppend(boardPath, 'board', closed, archiveHome, names.board, 'board'),
    prepareAppend(ledgerPath, 'ledger', log, archiveHome, names.ledger, 'ledger'),
  ]);
  return halves.filter((half): half is Half => half !== null);
}

/**
 * An item file already on disk with other bytes is a second copy no tool can judge, the same
 * call as an archive clash in the board fold. The same bytes are left alone, so a run after a
 * half-finished one does not stop on its own output.
 */
async function clashingItems(itemsDir: string, migration: Migration): Promise<string[]> {
  const live = await listItems(itemsDir);
  return migration.items.flatMap((item) => {
    const there = live.find((entry) => isItemFor(entry.name, item.number));
    if (there === undefined || (there.name === item.name && there.text === item.text))
      return [];
    return [`item ${item.number} already has a file, ${there.name}, with other text`];
  });
}

async function missingItems(itemsDir: string, migration: Migration): Promise<string[]> {
  const gone: string[] = [];
  for (const item of migration.items) {
    const there = await rawBytes(join(itemsDir, item.name));
    if (there === null || !there.equals(Buffer.from(item.text, 'utf8'))) gone.push(item.name);
  }
  return gone;
}

/**
 * D5 step 4 and §4.4: `itemsDir` where the file has none, and `ledgerFrozenAt`. Every other key
 * keeps its place and value; the file is rewritten in the two-space shape `setup` writes.
 */
async function configEdit(root: string, items: string, frozenAt: number): Promise<PlannedFile> {
  const path = join(root, '.personal-config.json');
  const before = (await exists(path)) ? await readText(path) : '{}';
  const parsed = JSON.parse(before) as Record<string, unknown>;
  const next = { ...parsed, itemsDir: parsed.itemsDir ?? items, ledgerFrozenAt: frozenAt };
  return edit(
    path,
    'config — itemsDir and ledgerFrozenAt',
    `${JSON.stringify(next, null, 2)}\n`,
  );
}

function reportMigration(migration: Migration, itemsDir: string): void {
  say('fold migrate:');
  say(
    migration.log === null
      ? '  step log: none found; the ledger gains an empty `## Log`'
      : `  step log: frozen at step ${migration.frozenAt}, the whole section to the archive log`,
  );
  say(`  closed prompts: ${migration.closed.map((block) => block.id).join(', ') || 'none'}`);
  say(
    `  item files in ${short(itemsDir)}/: ${migration.items.map((i) => i.number).join(', ') || 'none'}`,
  );
  if (migration.unrowed.length > 0) {
    say(`  left on the board, no row names them: sections ${migration.unrowed.join(', ')}`);
  }
}

function finishMigrate(result: WriteResult, migration: Migration, itemsDir: string): number {
  say(
    `\nWrote ${result.written.length} file(s). The repo is migrated: \`ledgerFrozenAt\` is ${migration.frozenAt}.`,
  );
  if (result.manifest) {
    say(
      '`personal-config undo` restores the board, the ledger and the config. It does not delete',
    );
    say(
      `the item files in ${short(itemsDir)}/ or the archive's entries: remove that folder by hand`,
    );
    say('after an undo, or every reader takes the repo for a migrated one.');
  }
  say(
    '\nRun `personal-config doctor .` next. Expect `row-cell-ceiling` findings: D5 leaves long',
  );
  say('cells for a person to shorten.');
  return 0;
}

/** The live documents are the repo's own once stamped `adapted`, and a migration rewrites both. */
function migrateGuarded(guarded: PlannedChange[]): string {
  return [
    'Nothing was migrated:',
    ...guarded.map((change) => `  ${short(change.file.path)}: ${guardReason(change)}`),
    'A migration cuts the board and the ledger, and this tool will not rewrite that file. Take',
    'the marker off, run this, and put the marker back.',
  ].join('\n');
}

function alreadyMigrated(root: string): string {
  return `${short(root)} is already migrated: .personal-config.json has \`ledgerFrozenAt\`. Migration runs once (D5).`;
}

function cannotMigrate(problems: string[]): string {
  return [
    'Nothing was migrated, because the conversion would lose or misplace text:',
    ...problems.map((problem) => `  ${problem}`),
    'Fix the board or the ledger by hand, then run this again.',
  ].join('\n');
}

function itemsNotArrived(names: string[]): string {
  return [
    `\n${names.length} item file(s) did not read back: ${names.slice(0, 5).join(', ')}.`,
    'The archive holds this run’s entries, and nothing live was cut. Delete the partial item',
    'files by hand before you run this again.',
  ].join('\n');
}
