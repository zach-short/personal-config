import type { Writable } from 'node:stream';
import * as p from '@clack/prompts';
import { diffLines } from './diff.ts';
import { contractHome } from './paths.ts';
import type { RepoScan } from './types.ts';
import type { PlannedChange } from './write-plan.ts';

/** Where `say()` sends a line. A line may hold newlines; a sink that lays lines out splits it. */
export type Sink = (line: string) => void;

function toConsole(line: string): void {
  console.log(line);
}

let sink: Sink = toConsole;

/**
 * The frame collects what `setup` says into its next panel, because a line printed to the
 * terminal while a frame is drawn breaks the in-place redraw (bare-command-home BD-4). `null`
 * puts the console back; every other command never calls this.
 */
export function setSink(next: Sink | null): void {
  sink = next ?? toConsole;
}

/** Console output lives here alone, so every other module stays testable without capture. */
export function say(line = ''): void {
  sink(line);
}

/**
 * A line for stderr, past any sink. A command whose stdout is data (`passoff next --json`) sends
 * its refusals here, so a reader that parses stdout never parses a sentence.
 */
export function sayError(line: string): void {
  console.error(line);
}

/**
 * A titled block, as `p.note` draws it in a terminal. Behind a sink it is the title, then the
 * body, as two lines: the frame draws its own box, and clack's would sit inside it (BD-5).
 */
export function note(body: string, title: string): void {
  if (sink === toConsole) {
    p.note(body, title);
    return;
  }
  sink(title);
  sink(body);
}

/**
 * Erase the screen and put the cursor top left, so a frame draws from the top (bare-command-home
 * BD-8). Not the alternate screen: the last frame stays in the scrollback when the run ends.
 */
export function clearScreen(out: Writable = process.stdout): void {
  out.write('\x1b[2J\x1b[H');
}

/** A whole screen that waits for no key: the frame's last one, left in the scrollback. */
export function drawScreen(text: string, out: Writable = process.stdout): void {
  clearScreen(out);
  out.write(`${text}\n`);
}

export function short(path: string): string {
  return contractHome(path);
}

/** DIAL-10: how many plain directories the listing prints before it summarises the rest. */
const FOLDER_LIST_MAX = 12;

/**
 * What discovery found, as the person reads it before picking targets.
 *
 * Git repos are listed in full; plain directories are capped at `FOLDER_LIST_MAX` and the rest
 * are counted (setup-tracks `DESIGN.md` DIAL-10). Dropping the `isGitRepo` filter means a scan
 * pointed somewhere broad finds every folder under it, and an uncapped list buries the repos
 * above it in a screen nobody reads.
 *
 * **The cap is on folders alone, not on the listing as a whole.** A git-only scan therefore
 * renders byte-identical to 0.2.6 — including a scan of fifty repos, which was already
 * fifty rows and is not this item's to change. `tests/setup-tracks.test.ts` pins that.
 */
export function targetList(scans: RepoScan[], where: string, max = FOLDER_LIST_MAX): string {
  const repos = scans.filter((s) => s.kind === 'git');
  const folders = scans.filter((s) => s.kind === 'folder');
  const sections = [
    ...(repos.length > 0 ? [scanTable('repo', repos)] : []),
    ...(folders.length > 0 ? [folderSection(folders, max)] : []),
  ];
  // The sections are separated by a blank line and the header by one newline, so a git-only
  // listing is exactly the two `say()` calls this replaced.
  return [`\n${foundLine(repos.length, folders.length, where)}\n`, sections.join('\n\n')].join(
    '\n',
  );
}

/** "0 repo(s)" is the one honest reading of an empty scan, so it survives when nothing is found. */
function foundLine(repos: number, folders: number, where: string): string {
  const counted = [
    ...(repos > 0 || folders === 0 ? [`${repos} repo(s)`] : []),
    ...(folders > 0 ? [`${folders} folder(s)`] : []),
  ];
  return `Found ${counted.join(' and ')} under ${where}:`;
}

function folderSection(folders: RepoScan[], max: number): string {
  const shown = folders.slice(0, max);
  const rest = folders.length - shown.length;
  const table = scanTable('folder', shown);
  return rest > 0 ? `${table}\n  … and ${rest} more` : table;
}

function scanTable(heading: string, scans: RepoScan[]): string {
  const rows = scans.map((s) => {
    const langs = s.languages.join('+') || '—';
    const docs = s.existingDocs.length > 0 ? s.existingDocs.join(',') : '—';
    return `  ${s.name.padEnd(22)} ${langs.padEnd(18)} ${(s.packageManager ?? '—').padEnd(6)} ${
      s.hasCi ? 'CI' : '  '
    }  ${docs}`;
  });
  return [
    `  ${heading.padEnd(22)} ${'languages'.padEnd(18)} ${'pm'.padEnd(6)}      existing`,
    ...rows,
  ].join('\n');
}

/** The preview tree: every file this run would touch, grouped by where it lands. */
export function previewTree(changes: PlannedChange[]): string {
  const groups = new Map<string, PlannedChange[]>();
  for (const change of changes) {
    const key = groupOf(change.file.path);
    groups.set(key, [...(groups.get(key) ?? []), change]);
  }

  const lines: string[] = [];
  for (const [group, items] of groups) {
    lines.push(group);
    for (const item of items) {
      lines.push(`  ${leafOf(item.file.path)}  — ${item.file.label}  [${markOf(item)}]`);
    }
  }
  return lines.join('\n');
}

/** The bracket. A refusal outranks any diff: there is no change to summarize behind it. */
function markOf(change: PlannedChange): string {
  const refusal = refusalMark(change);
  if (refusal !== null) return refusal;
  if (change.before.length === 0) return 'new';
  if (change.before === change.after) return modeMark(change);
  return change.summary;
}

/**
 * The guards that leave a file alone, each in the words of its way out. `adapted` has none: its
 * file is its owner's on purpose, and the preview has always shown it as unchanged.
 */
function refusalMark(change: PlannedChange): string | null {
  if (change.guard === 'no-stamp') return 'no stamp — left alone';
  if (change.guard === 'kept') return 'kept — your record, written once';
  if (change.guard === 'edited') return 'edited since written — left alone';
  return null;
}

/**
 * What a file with the right bytes and the wrong bits says. Without this the preview called it
 * `unchanged` and then changed it, which is the one thing a preview may not do.
 */
function modeMark(change: PlannedChange): string {
  return change.chmod === undefined ? change.summary : `mode → ${change.chmod.toString(8)}`;
}

function groupOf(path: string): string {
  const shortened = short(path);
  const cut = shortened.lastIndexOf('/');
  return cut === -1 ? '.' : shortened.slice(0, cut);
}

function leafOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** The per-file expansion behind the single batch confirm. */
export function renderDiff(change: PlannedChange, maxLines = 40): string {
  const refusal = refusalMark(change);
  if (refusal !== null) return `${short(change.file.path)}: ${refusal}`;
  if (change.before === change.after)
    return `${short(change.file.path)}: ${unchangedNote(change)}`;
  const lines = diffLines(change.before, change.after);
  const shown = lines.slice(0, maxLines).map((l) => `${l.kind} ${l.text}`);
  const rest = lines.length - shown.length;
  const tail = rest > 0 ? [`… ${rest} more lines`] : [];
  return [`--- ${short(change.file.path)}`, ...shown, ...tail].join('\n');
}

/** The expansion's version of `modeMark`: there is no diff to show, so the bits are the news. */
function unchangedNote(change: PlannedChange): string {
  if (change.chmod === undefined) return 'unchanged';
  return `contents unchanged; mode → ${change.chmod.toString(8)}`;
}
