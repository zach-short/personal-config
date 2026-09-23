import { basename, join } from 'node:path';
import { withIndexLine } from '../lib/archive-index.ts';
import { confirmWrite } from '../lib/ask.ts';
import { today } from '../lib/date.ts';
import { exists, readText } from '../lib/disk.ts';
import { boardFold, type Fold, type Folded, foldedLines, ledgerFold } from '../lib/fold.ts';
import { expandHome } from '../lib/paths.ts';
import { docStem, readArchiveHome, readDocNames } from '../lib/repo-config.ts';
import type { Cli, PlannedFile } from '../lib/types.ts';
import { previewTree, renderDiff, say, short } from '../lib/ui.ts';
import {
  commitPlan,
  type PlannedChange,
  resolvePlan,
  type WriteResult,
} from '../lib/write-plan.ts';
import { edit } from '../render/context.ts';

const USAGE = [
  'usage: personal-config fold [board|ledger] [--keep <n>]',
  '',
  'Moves what §2.1 already calls dead weight out of the live documents and into the archive:',
  "a `DONE` item's prompt, and every ledger step body but the newest --keep (default 20).",
  'The board keeps every row; the ledger keeps every step number, title and date.',
  'With no target it does both.',
].join('\n');

type Which = 'board' | 'ledger';

type Half = {
  which: Which;
  /** The document being trimmed, and the file its lifted text is appended to. */
  livePath: string;
  archivePath: string;
  fold: Fold;
  archiveText: string;
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
 */
export async function runFold(cli: Cli): Promise<number> {
  const targets = which(cli.paths[0]);
  if (targets === null) return refuse(USAGE);

  const root = process.cwd();
  const home = await readArchiveHome(root);
  if (home === null) return refuse(noArchiveHome(root));

  const archiveHome = expandHome(home);
  if (!(await exists(join(archiveHome, 'INDEX.md')))) return refuse(noIndex(archiveHome));

  const halves = await prepareAll(root, archiveHome, targets, cli.keep);
  if (halves.length === 0) return note(nothingToFold(targets, cli.keep));

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
): Promise<Half[]> {
  const prepared = await Promise.all(
    targets.map((target) => prepare(root, archiveHome, target, keep)),
  );
  return prepared.filter((half): half is Half => half !== null);
}

/** Null where there is no such document, or where it holds nothing this would move. */
async function prepare(
  root: string,
  archiveHome: string,
  target: Which,
  keep: number,
): Promise<Half | null> {
  const names = await readDocNames(root);
  const name = target === 'board' ? names.board : names.ledger;
  const livePath = join(root, name);
  if (!(await exists(livePath))) return null;

  const text = await readText(livePath);
  const fold = target === 'board' ? boardFold(text) : ledgerFold(text, keep, today());
  if (fold.folded.length === 0) return null;

  const archivePath = join(
    archiveHome,
    `${docStem(name)}-${target === 'board' ? 'closed' : 'log'}.md`,
  );
  return {
    which: target,
    livePath,
    archivePath,
    fold,
    archiveText: await appended(archivePath, target, name, fold),
  };
}

/**
 * The archive file's new contents: whatever it already held, then this run's entries under a
 * dated header. Built here rather than through the `append-lines` strategy, which exists for
 * ignore files and adds only lines the file does not already have — deduplicating *prose* would
 * silently drop a repeated sentence out of the middle of an archived prompt.
 */
async function appended(
  path: string,
  target: Which,
  source: string,
  fold: Fold,
): Promise<string> {
  const existing = (await exists(path)) ? await readText(path) : preamble(target, source);
  const fresh = fold.folded.filter((block) => !existing.includes(bodyOf(block)));
  if (fresh.length === 0) return existing;

  const noun = target === 'board' ? 'prompt' : 'step';
  const header = `## Folded ${today()} from \`${source}\` — ${fresh.length} ${noun}(s)`;
  return `${existing.replace(/\n+$/, '')}\n\n${header}\n\n${fresh.map(bodyOf).join('\n\n')}\n`;
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
function preamble(target: Which, source: string): string {
  return target === 'board' ? boardPreamble(source) : ledgerPreamble(source);
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

function report(halves: Half[]): void {
  say('fold:');
  for (const half of halves) {
    const { fold } = half;
    const noun = half.which === 'board' ? 'prompt(s)' : 'step bod(ies)';
    say(
      `  ${short(half.livePath)} — ${fold.folded.length} ${noun}, ${foldedLines(fold)} line(s) → ${short(half.archivePath)}`,
    );
    say(`    items ${half.fold.folded.map((block) => block.id).join(', ')}`);
  }
  say(`\n${keptNote(halves)}`);
}

/** What survives is the part worth stating plainly, because it is what a reader will doubt. */
function keptNote(halves: Half[]): string {
  const lines = ['What stays:'];
  if (halves.some((half) => half.which === 'board')) {
    lines.push(
      '  the board — every row, including each `DONE` row and its pointer at the ledger step.',
      '  `SUPERSEDED` and `SETTLED AS NO` keep their sections: `doctor` reads those for the',
      '  replacement and the reason, and §2.1 asks that a settled no is never re-proposed.',
    );
  }
  if (halves.some((half) => half.which === 'ledger')) {
    lines.push(
      '  the log — every step number, title and date, as a one-line stub. The numbering stays',
      '  contiguous, `handoff step` hands out the same next number, and `DONE — <n>` resolves.',
      '  Standing sections are untouched; they are edited in place, never archived.',
    );
  }
  return lines.join('\n');
}

async function write(cli: Cli, archiveHome: string, halves: Half[]): Promise<number> {
  const archive = await resolvePlan(halves.map(archiveFile));
  const trim = await resolvePlan(halves.map(trimFile));
  say(`\n${preview([...archive, ...trim])}`);

  if (cli.dryRun) return note('\n--dry-run: nothing was archived, nothing was trimmed.');
  if (!(await confirmWrite('Archive these, then trim the live document(s)?', cli.force))) {
    return note('Nothing was folded.');
  }

  await commitPlan(archive);
  const missing = await missingFromArchive(halves);
  if (missing.length > 0) return refuse(notArrived(missing));

  say(`\nArchived, and verified every block arrived (Part 7 step 3).`);
  const index = await resolvePlan(await indexEdits(archiveHome, halves));
  return finish(await commitPlan([...trim, ...index]), halves);
}

function archiveFile(half: Half): PlannedFile {
  return edit(
    half.archivePath,
    `archive — ${half.which} entries from this run`,
    half.archiveText,
  );
}

function trimFile(half: Half): PlannedFile {
  return edit(half.livePath, `${half.which} — folded`, half.fold.trimmed);
}

/**
 * Every block, looked for in the file that now claims to hold it. Byte-for-byte against the
 * text that was lifted, because a check that the *count* went up would pass on a truncated
 * write — which is the failure this ordering exists to catch, at the one moment the live
 * document is still whole.
 */
async function missingFromArchive(halves: Half[]): Promise<string[]> {
  const gone: string[] = [];
  for (const half of halves) {
    const text = await readText(half.archivePath).catch(() => '');
    for (const block of half.fold.folded) {
      if (!text.includes(block.text.replace(/\n+$/, '')))
        gone.push(`${half.which} ${block.id}`);
    }
  }
  return gone;
}

async function indexEdits(archiveHome: string, halves: Half[]): Promise<PlannedFile[]> {
  const path = join(archiveHome, 'INDEX.md');
  const before = await readText(path).catch(() => null);
  if (before === null) return [];

  const after = halves.reduce(withFoldLine, before);
  return after === before ? [] : [edit(path, 'archive index — one line per fold file', after)];
}

/** §8.2: a doc with no index line is invisible. Written once, when the file is first created. */
function withFoldLine(text: string, half: Half): string {
  const name = basename(half.archivePath);
  if (text.includes(`**${name}**`)) return text;
  const what =
    half.which === 'board'
      ? 'closed board prompts, appended as items are folded'
      : 'folded ledger step bodies, appended as the log is folded';
  return withIndexLine(text, `- **${name}** ✅ — ${what}. Opened ${today()}.`);
}

function preview(changes: PlannedChange[]): string {
  const real = changes.filter((change) => change.before !== change.after);
  if (real.length === 0) return 'Nothing would change.';
  return [
    'What this writes:',
    '',
    previewTree(real),
    ...real.map((c) => `\n${renderDiff(c)}`),
  ].join('\n');
}

function finish(result: WriteResult, halves: Half[]): number {
  say(`\nWrote ${result.written.length} file(s).`);
  // Precise on purpose. `undo` restores the *latest* backup and is one-shot, and this command
  // commits twice — the archive, then the trim — so the backup `undo` reaches is the trim's.
  // That is the half worth restoring, and re-running the fold afterwards is safe rather than
  // duplicating: `appended` skips any block the archive already holds.
  if (result.manifest) {
    say('`personal-config undo` restores the live document(s). The archive keeps this run’s');
    say('entries either way — folding again appends nothing it already holds.');
  }
  const total = halves.reduce((sum, half) => sum + foldedLines(half.fold), 0);
  say(`${total} line(s) left the live document(s).`);
  say('\nRun your gates and `personal-config doctor .` before committing — the fold rewrites');
  say('documents other rules read, and a green doctor is what says it rewrote them correctly.');
  return 0;
}

function nothingToFold(targets: Which[], keep: number): string {
  const named = targets.join(' and ');
  return [
    `Nothing to fold in the ${named}.`,
    `Either there is no such document here, or every \`DONE\` prompt is already out and the log`,
    `is already ${keep} step(s) or shorter.`,
  ].join('\n');
}

function notArrived(missing: string[]): string {
  return [
    `\nThe archive is missing ${missing.length} block(s) it should now hold: ${missing.slice(0, 5).join(', ')}.`,
    'Nothing was trimmed — the live document(s) are exactly as they were. `personal-config undo`',
    'restores the archive file too, if the partial append is in the way.',
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
