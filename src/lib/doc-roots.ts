import { documentRoot, isTracked } from './git.ts';
import { readDocNames } from './repo-config.ts';

/**
 * The two folders a command that reads the board or the ledger needs: where
 * `.personal-config.json` is, and where the documents are.
 *
 * They differ in one case. A repository that commits its board and ledger gives every linked
 * worktree its own copy, carried by the worktree's branch, while `.personal-config.json` stays
 * untracked in every mode and lives only in the main checkout. A claim from such a worktree
 * marked the main checkout's copy and left the worktree's own `OPEN` (row 122 review, finding 1).
 * Whether git tracks the documents decides it, not the recorded `trackMode`: this tool's own
 * repo records `tracked` while a global ignore keeps its board out of git.
 */
export type DocRoots = { config: string; docs: string };

export async function docRoots(dir: string): Promise<DocRoots> {
  const config = await documentRoot(dir);
  if (config === dir) return { config, docs: dir };
  const { board, ledger } = await readDocNames(config);
  const own = (await isTracked(dir, board)) || (await isTracked(dir, ledger));
  return { config, docs: own ? dir : config };
}
