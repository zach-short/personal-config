import { join } from 'node:path';
import { exists, readJson } from './disk.ts';
import type { TrackMode, WorkProfile } from './types.ts';

/**
 * The ledger and board filenames for one repo, and the folder that holds one file per board
 * item (per-item-board `DESIGN.md` D7), relative to the repo root.
 */
export type DocNames = { ledger: string; board: string; items: string };

/** What this tool writes when a repo has adopted nothing of its own. */
export const DEFAULT_DOC_NAMES: DocNames = {
  ledger: 'HANDOFF.md',
  board: 'PASSOFF.md',
  items: itemsDirFor('PASSOFF.md'),
};

/**
 * `.personal-config.json` is where an adopted name survives. Standard §0.2 says a repo already
 * keeping a ledger or board under another name keeps it, because a rename breaks every citation
 * pointing at it — and `setup` and `doctor` both read the names from here so they cannot
 * disagree about which file is the ledger.
 */
export async function readDocNames(repoDir: string): Promise<DocNames> {
  const parsed = await readRepoJson(repoDir);
  if (parsed === null) return DEFAULT_DOC_NAMES;

  const board = stringAt(parsed, 'boardFile') ?? DEFAULT_DOC_NAMES.board;
  return {
    ledger: stringAt(parsed, 'ledgerFile') ?? DEFAULT_DOC_NAMES.ledger,
    board,
    items: stringAt(parsed, 'itemsDir') ?? itemsDirFor(board),
  };
}

/**
 * D7: the board's stem, lowercased, so a reader who knows `PASSOFF.md` knows `passoff/` and an
 * adopted `NEXT.md` gets `next/`. `itemsDir` in the config overrides it.
 */
export function itemsDirFor(boardFile: string): string {
  return docStem(boardFile).toLowerCase();
}

/**
 * The highest step of a ledger whose step log `fold migrate` moved to the archive (D5), or
 * null for a repo that has not migrated. `board-status` accepts `DONE - <LEDGER> n` for any
 * `n` at or below it without reading the ledger, because the log that held `n` is gone from it.
 * Anything but a whole number reads as unmigrated: a half-written key must not pass citations.
 */
export async function readLedgerFrozenAt(repoDir: string): Promise<number | null> {
  const parsed = await readRepoJson(repoDir);
  if (!isRecord(parsed)) return null;
  const value = parsed.ledgerFrozenAt;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Where `setup` put this repo's adapted standard. Written by the renderers since the first
 * slice and, until now, never read back — `worktree` is the first command that needs to find
 * the standard rather than write it. Null when this repo has not been set up.
 */
export async function readStandardPath(repoDir: string): Promise<string | null> {
  return stringAt(await readRepoJson(repoDir), 'standardPath');
}

/**
 * The worktree path template, with `<repo>` and `<lane>` substituted. A house convention, not a
 * constant: one verified repo keeps its worktrees under `.claude/worktrees/<lane>` rather than
 * beside the checkout, and a hardcoded sibling path would be wrong there every time.
 */
export async function readWorktreePath(repoDir: string): Promise<string | null> {
  return stringAt(await readRepoJson(repoDir), 'worktreePath');
}

/**
 * Where this repo's closed work goes (§2.2, Part 7). Stored resolved — `<repo>` is substituted
 * at setup time — and stored with a leading `~` where it is under the home directory, so the
 * caller expands it.
 */
export async function readArchiveHome(repoDir: string): Promise<string | null> {
  return stringAt(await readRepoJson(repoDir), 'archiveHome');
}

/**
 * The completion-gate hook's command. No question asks for it, so only a person or Part 0 ever
 * sets it, and a re-render reads it back here rather than blanking it: an empty value turns the
 * gate off without a word (found 2026-10-16, an `init` re-run).
 */
export async function readGateCommand(repoDir: string): Promise<string | null> {
  return stringAt(await readRepoJson(repoDir), 'gateCommand');
}

/**
 * Tracked or untracked, as `setup` recorded it. `doctor --fix` reads it so its one write lands
 * in the file `setup` would have chosen: a repo you own keeps its entries in `.gitignore`, and
 * a repo you do not is kept out of `.git/info/exclude`, which is not yours to commit. Null
 * where the file says nothing, and the caller treats that as untracked — the safer of the two.
 */
export async function readTrackMode(repoDir: string): Promise<'tracked' | 'untracked' | null> {
  const value = stringAt(await readRepoJson(repoDir), 'trackMode');
  return value === 'tracked' || value === 'untracked' ? value : null;
}

/**
 * The shape `setup` rendered — a ledger, or project folders — as `renderRepoConfig` recorded it.
 * `doctor` re-renders against this rather than against the `workProfile` *answer*, which is the
 * shared default and not what this target got: `planRepo` writes an adopted profile into the
 * per-repo answers only, and nothing copies it back (stamp-provenance `DESIGN.md` D2).
 */
export async function readWorkProfile(repoDir: string): Promise<WorkProfile | null> {
  const value = stringAt(await readRepoJson(repoDir), 'workProfile');
  return value === 'ledger' || value === 'folders' ? value : null;
}

/**
 * The recorded mode as written, `n/a` included. `readTrackMode` above folds `n/a` into null
 * because its one caller is choosing an ignore file and a folder has none; a re-render needs the
 * distinction, since `n/a` is what keeps `renderIgnore` from planning a `.git/` that is not
 * there (DIAL-11).
 */
export async function readRecordedTrackMode(repoDir: string): Promise<TrackMode | null> {
  const value = stringAt(await readRepoJson(repoDir), 'trackMode');
  return value === 'tracked' || value === 'untracked' || value === 'n/a' ? value : null;
}

/** One read of the file every reader here shares, so they cannot disagree about its shape. */
async function readRepoJson(repoDir: string): Promise<unknown> {
  const path = join(repoDir, '.personal-config.json');
  if (!(await exists(path))) return null;
  return readJson(path).catch(() => null);
}

/** `NOTES.md` is cited as "NOTES 12", the way the default is cited as "HANDOFF 24". */
export function docStem(fileName: string): string {
  return fileName.replace(/\.md$/i, '');
}

/** Profile P writes `""` for both names, which means "no such file", not "override the default". */
function stringAt(parsed: unknown, key: string): string | null {
  if (!isRecord(parsed)) return null;
  const value = parsed[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
