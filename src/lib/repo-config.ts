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
  const file = Bun.file(join(repoDir, '.personal-config.json'));
  if (!(await file.exists())) return DEFAULT_DOC_NAMES;

  const parsed: unknown = await file.json().catch(() => null);
  return {
    ledger: stringAt(parsed, 'ledgerFile') ?? DEFAULT_DOC_NAMES.ledger,
    board: stringAt(parsed, 'boardFile') ?? DEFAULT_DOC_NAMES.board,
  };
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
