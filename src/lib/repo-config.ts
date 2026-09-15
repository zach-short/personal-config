import { join } from 'node:path';

/** The ledger and board filenames for one repo. */
export type DocNames = { ledger: string; board: string };

/** What this tool writes when a repo has adopted nothing of its own. */
export const DEFAULT_DOC_NAMES: DocNames = { ledger: 'HANDOFF.md', board: 'PASSOFF.md' };

/**
 * `.personal-config.json` is where an adopted name survives. Standard §0.2 says a repo already
 * keeping a ledger or board under another name keeps it, because a rename breaks every citation
 * pointing at it — and `setup` and `doctor` both read the names from here so they cannot
 * disagree about which file is the ledger.
 */
export async function readDocNames(repoDir: string): Promise<DocNames> {
  const parsed = await readRepoJson(repoDir);
  if (parsed === null) return DEFAULT_DOC_NAMES;

  return {
    ledger: stringAt(parsed, 'ledgerFile') ?? DEFAULT_DOC_NAMES.ledger,
    board: stringAt(parsed, 'boardFile') ?? DEFAULT_DOC_NAMES.board,
  };
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

/** One read of the file every reader here shares, so they cannot disagree about its shape. */
async function readRepoJson(repoDir: string): Promise<unknown> {
  const file = Bun.file(join(repoDir, '.personal-config.json'));
  if (!(await file.exists())) return null;
  return file.json().catch(() => null);
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
