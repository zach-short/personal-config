import { basename, isAbsolute, join, relative, sep } from 'node:path';
import { ignoreRule } from './git.ts';
import { contractHome } from './paths.ts';
import type { PlannedFile, RepoPlan } from './types.ts';
import type { PlannedChange } from './write-plan.ts';

/**
 * A file setup means to be tracked, and the ignore rule that will keep `git add` from it. `repo`
 * is the repo directory's name and `path` is relative to it, which is how the warning prints
 * them: short, and still telling two repos in one run apart.
 */
export type HiddenFile = { repo: string; path: string; rule: string };

/**
 * Claude Code's own per-person settings file. Setup writes the tier ceiling into it in either
 * mode, but it is personal by its name and by Claude Code's convention, so an ignore rule that
 * hides it is doing its job rather than hiding something the repo should carry.
 */
const PERSONAL_BY_NAME = ['.claude/settings.local.json'];

/**
 * The paths, relative to `root`, that a tracked-mode plan expects git to see. Out are files
 * outside the repo, `append-lines` targets (an ignore file is not a document), and every name the
 * plan's own `.gitignore` lines keep out on purpose — `.personal-config.json` is meant to be
 * ignored, and warning about it would teach the owner to skim past the real case.
 */
export function meantToBeTracked(root: string, files: PlannedFile[]): string[] {
  const ownIgnores = files
    .filter(
      (file) => file.strategy === 'append-lines' && file.path === join(root, '.gitignore'),
    )
    .flatMap((file) => file.contents.split('\n'))
    .map((line) => line.trim().replace(/^\//, ''))
    .filter(Boolean);
  const skip = [...ownIgnores, ...PERSONAL_BY_NAME];
  return files
    .filter((file) => file.strategy !== 'append-lines')
    .map((file) => relative(root, file.path).split(sep).join('/'))
    .filter((path) => path !== '' && !path.startsWith('../') && !isAbsolute(path))
    .filter((path) => !skip.some((entry) => keptOutBy(entry, path)));
}

/**
 * A line ending in `/` keeps out a folder and everything under it, as git reads it
 * (shared-skills-track D3 names the two skill folders that way).
 */
function keptOutBy(entry: string, path: string): boolean {
  return entry.endsWith('/') ? path.startsWith(entry) : path === entry;
}

/**
 * Asks git, per tracked-mode repo, which of the files above an ignore rule would hide (board item
 * 98). A warning and never a change of plan: the owner may keep these out of git on purpose, and
 * only they know which. What it prevents is the silent case — a preview that says "tracked" for a
 * file `git add` will refuse, and a worktree that never holds it.
 */
export async function hiddenByIgnore(
  repos: RepoPlan[],
  changes: PlannedChange[],
): Promise<HiddenFile[]> {
  const files = changes.map((change) => change.file);
  const tracked = repos.filter((repo) => repo.trackMode === 'tracked');
  const found = await Promise.all(tracked.map((repo) => hiddenIn(repo.scan.path, files)));
  return found.flat();
}

/**
 * The preview's warning, or null when there is nothing to say. It names the rule as well as the
 * file because the fix lives where the rule does — a global excludes file is not in the repo, and
 * the owner who wrote it months ago will not think to look there.
 */
export function hiddenNote(hidden: HiddenFile[]): string | null {
  if (hidden.length === 0) return null;
  return [
    `\n${hidden.length} file(s) meant to be tracked are hidden by an ignore rule, so \`git add\` will refuse them:`,
    ...hidden.map((file) => `  ${file.repo}/${file.path}  (${contractHome(file.rule)})`),
    'Nothing in this run changes for it. To commit them, remove the rule or `git add -f` them;',
    'to keep them private, leave it. A worktree holds only what is committed.',
  ].join('\n');
}

async function hiddenIn(root: string, files: PlannedFile[]): Promise<HiddenFile[]> {
  const paths = meantToBeTracked(root, files);
  const rules = await Promise.all(paths.map((path) => ignoreRule(root, path)));
  return paths.flatMap((path, i) => {
    const rule = rules[i];
    return rule ? [{ repo: basename(root), path, rule }] : [];
  });
}
