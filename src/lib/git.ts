import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { exists } from './disk.ts';

const run = promisify(execFile);

/**
 * `maxBuffer` well above the 1 MB default: `trackedReferrers` runs `git grep` over a whole repo,
 * and overrunning the buffer rejects — which this function turns into `null`, i.e. "no hits" in
 * every caller. A silent wrong answer on big repos only, so it is set once, here.
 */
const MAX_OUTPUT = 64 * 1024 * 1024;

/** Every git read is best-effort: a directory that is not a repo must not crash a scan. */
async function git(
  cwd: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  try {
    const { stdout } = await run('git', args, { cwd, env, maxBuffer: MAX_OUTPUT });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * The environment without git's location overrides. `GIT_COMMON_DIR` set by a caller sent both
 * resolvers below to whichever repository it named, from any folder (row 122 review, finding 3);
 * the question they answer is about the folder, so the folder alone decides.
 */
function folderOnly(): NodeJS.ProcessEnv {
  const { GIT_DIR, GIT_WORK_TREE, GIT_COMMON_DIR, ...rest } = process.env;
  return rest;
}

/** `git` asked about the folder itself, whatever the environment points at. */
function locate(cwd: string, args: string[]): Promise<string | null> {
  return git(cwd, args, folderOnly());
}

/**
 * Where the board, the ledger and `.personal-config.json` for `dir` live. They are untracked, so
 * a linked worktree has none of them: from a worktree this is the same path in the main
 * checkout, found through `git rev-parse --git-common-dir`. Everywhere else, `dir` itself,
 * unchanged — a subdirectory is not walked up to the top, because a folder target or a worked
 * example inside a repository keeps documents of its own there.
 *
 * Answering with another repository's folder is the failure this guards against, since it
 * passes every gate: a claim lands on the wrong board. So a guess is never returned. The main
 * checkout is read off the common directory and then confirmed by asking git about it in turn;
 * anything that does not round-trip (a bare main, a moved checkout, a git too old for
 * `--path-format`) answers `dir`, where the documents are missing and every reader says so.
 * A submodule or a nested repository is its own repository: its git dir is its common dir, so
 * it is never mapped.
 */
export async function documentRoot(dir: string): Promise<string> {
  const out = await locate(dir, [
    'rev-parse',
    '--path-format=absolute',
    '--git-dir',
    '--git-common-dir',
    '--show-prefix',
  ]);
  const [gitDir, commonDir, prefix = ''] = (out ?? '').split('\n');
  if (!gitDir || !commonDir || !isAbsolute(gitDir) || !isAbsolute(commonDir)) return dir;
  if (gitDir === commonDir) return dir;
  const main = await mainCheckout(commonDir);
  return main === null ? dir : resolve(main, prefix);
}

/**
 * The checkout whose git dir is `commonDir`, or null. `git worktree list` is not asked: for a
 * submodule's worktrees it names `.git/modules/<name>`, the git dir, as the main worktree
 * (git 2.49.0). The candidate is the folder holding a `.git` common dir, or `core.worktree`
 * where one is set, and it counts only if git, asked from there, names the same git dir and the
 * candidate as its own top level, and if the files its index tracks are there.
 *
 * That last test is for `git init --separate-git-dir=<x>/.git`: git takes any folder holding a
 * git dir named `.git` as that git dir's work tree, so `<x>` round-trips although the checkout
 * is elsewhere and nothing in git records where (row 122 review, finding 2). From `<x>` every
 * tracked file reads as deleted; from the real checkout almost none do.
 */
async function mainCheckout(commonDir: string): Promise<string | null> {
  const candidate =
    basename(commonDir) === '.git' ? dirname(commonDir) : await configuredWorktree(commonDir);
  if (candidate === null) return null;
  const out = await locate(candidate, [
    'rev-parse',
    '--path-format=absolute',
    '--git-dir',
    '--show-toplevel',
  ]);
  const [gitDir, top] = (out ?? '').split('\n');
  if (gitDir !== commonDir || top !== candidate) return null;
  return (await holdsItsFiles(candidate)) ? candidate : null;
}

/** True when the index is empty or not every file in it is missing from `dir`. */
async function holdsItsFiles(dir: string): Promise<boolean> {
  const [indexed, missing] = await Promise.all([
    locate(dir, ['ls-files', '-z']),
    locate(dir, ['ls-files', '-z', '--deleted']),
  ]);
  if (indexed === null || missing === null) return false;
  const count = (list: string) => list.split('\0').filter(Boolean).length;
  return count(indexed) === 0 || count(missing) < count(indexed);
}

/** `core.worktree`, resolved from the git dir it is relative to; null where none is set. */
async function configuredWorktree(commonDir: string): Promise<string | null> {
  const value = await locate(commonDir, [
    'config',
    '--file',
    join(commonDir, 'config'),
    'core.worktree',
  ]);
  if (!value) return null;
  return realpath(resolve(commonDir, value)).catch(() => null);
}

/**
 * Whether git tracks `path` in the checkout at `dir`. A repository that commits its board has a
 * copy in every worktree, and that copy is the one the worktree's branch carries.
 */
export async function isTracked(dir: string, path: string): Promise<boolean> {
  return (await locate(dir, ['ls-files', '--error-unmatch', '--', path])) !== null;
}

/** A worktree's `.git` is a file rather than a directory, so both spellings count. */
export async function isGitRepo(dir: string): Promise<boolean> {
  return (await exists(join(dir, '.git', 'HEAD'))) || (await exists(join(dir, '.git')));
}

/**
 * Where git actually keeps this checkout's exclude file. A linked worktree's `.git` is a file
 * rather than a directory, so `<root>/.git/info/exclude` is not a path that can be created
 * there at all; `rev-parse` answers correctly in both layouts. The plain spelling is the
 * fallback for the one case it cannot answer — a directory that is not a repository — where
 * nothing is going to be written anyway.
 */
export async function excludeFile(dir: string): Promise<string> {
  const out = await git(dir, ['rev-parse', '--git-path', 'info/exclude']);
  return out ? resolve(dir, out) : join(dir, '.git', 'info', 'exclude');
}

export async function remoteUrl(dir: string): Promise<string | null> {
  return git(dir, ['remote', 'get-url', 'origin']);
}

/**
 * Whether git itself would ignore this path — its own rule resolution across `.gitignore` at
 * every level, `.git/info/exclude` and core excludes — rather than a text search over those
 * files' raw contents. A `.gitignore` *comment* that happens to mention the filename is not a
 * pattern, and only `check-ignore` knows the difference. Exit 1 means "no pattern matched",
 * which `execFile` treats as a rejection; anything else (no match, or the directory is not a
 * repository) is read the same conservative way `git()` above reads every other failure: not
 * proven ignored, so the finding still surfaces rather than silently disappearing.
 */
export async function isIgnored(dir: string, path: string): Promise<boolean> {
  try {
    await run('git', ['check-ignore', '-q', '--', path], { cwd: dir, maxBuffer: MAX_OUTPUT });
    return true;
  } catch {
    return false;
  }
}

/**
 * The rule that hides a path, as `check-ignore -v` names it: `source:line:pattern`, where the
 * source can be a file outside the repo entirely — the owner's global excludes file is the case
 * this exists for (board item 98). Null where nothing hides it, which includes a path git already
 * tracks: an ignore rule does not apply to a tracked file, so there is nothing to warn about.
 *
 * Two calls, because `-v` alone cannot answer the question. With `-v`, git exits 0 and prints
 * the last pattern that *matched*, and that can be a negation: a global `HANDOFF.md` and a repo
 * `!HANDOFF.md` print `.gitignore:1:!HANDOFF.md` for a file `git add` takes (git 2.49.0). The
 * plain `-q` exit is git's own verdict on whether the path is ignored, so it decides and `-v`
 * only names the rule. Reading a leading `!` off the pattern instead would be this code
 * re-deriving git's precedence rules, which is the thing `isIgnored` exists to avoid.
 */
export async function ignoreRule(dir: string, path: string): Promise<string | null> {
  if (!(await isIgnored(dir, path))) return null;
  const out = await git(dir, ['check-ignore', '-v', '--', path]);
  if (!out) return null;
  const tab = out.indexOf('\t');
  return tab === -1 ? out : out.slice(0, tab);
}

/** `git@github.com:owner/repo.git` and `https://github.com/owner/repo` both yield `owner`. */
export function ownerFromRemote(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/[:/]([^/:]+)\/[^/]+?(?:\.git)?$/);
  return match?.[1] ?? null;
}

export async function worktreeCount(dir: string): Promise<number> {
  const out = await git(dir, ['worktree', 'list']);
  return out ? out.split('\n').filter(Boolean).length : 0;
}

/**
 * The ownership guard's left-hand side. `gh` first because it is the only source that proves
 * who is actually signed in; the git config fallback is a stated preference, not proof.
 */
export async function githubLogin(): Promise<string | null> {
  try {
    const { stdout } = await run('gh', ['api', 'user', '--jq', '.login']);
    const out = stdout.trim();
    if (out) return out;
  } catch {
    // gh is not installed, or nobody is signed in; fall through to git config.
  }
  return git(process.cwd(), ['config', 'github.user']);
}

/** True only when we can prove ownership. An unknown login is treated as not-yours. */
export function ownsRepo(login: string | null, owner: string | null): boolean {
  if (!login || !owner) return false;
  return login.toLowerCase() === owner.toLowerCase();
}

export async function currentBranch(dir: string): Promise<string | null> {
  return git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
}

/** The repository a path belongs to. Null when it belongs to none — an archive need not be one. */
export async function topLevel(dir: string): Promise<string | null> {
  return git(dir, ['rev-parse', '--show-toplevel']);
}

/**
 * The last commit that touched any of these paths — Part 7 step 4's "last commit" in the index
 * line. Several pathspecs because by the time the line is written the folder has usually already
 * moved, and a deleted path still matches its own history.
 */
export async function lastCommit(dir: string, paths: string[]): Promise<string | null> {
  const out = await git(dir, ['log', '-1', '--format=%h', '--', ...paths]);
  return out === null || out === '' ? null : out;
}

/**
 * Part 7 step 2: the folder is committed in its final state *before* the move, so the repo
 * records how it ended. Anything porcelain reports — staged, unstaged or untracked — means it
 * is not.
 */
export async function uncommittedUnder(dir: string, path: string): Promise<string[]> {
  const out = await git(dir, ['status', '--porcelain', '--', path]);
  return out === null || out === '' ? [] : out.split('\n').filter(Boolean);
}

/**
 * Part 7 step 1's referrer grep, over tracked files only — `git grep` searches the same set as
 * `git ls-files | xargs grep`, without the argument-length limit. `-F` because a filename is a
 * string, not a pattern, and `-e` so a name beginning with `-` is still a needle.
 */
export async function trackedReferrers(dir: string, needle: string): Promise<string[]> {
  const out = await git(dir, ['grep', '-n', '-F', '-e', needle]);
  return out === null || out === '' ? [] : out.split('\n').filter(Boolean);
}

/**
 * R8's left-hand side: staged and unstaged work against the last commit, which is the change
 * about to be handed back. `-U0` because the rule asks which lines a hunk touched, not what
 * surrounds them, and `--relative` so a scan rooted in a subdirectory gets paths it can join to
 * the docs it has already read. Null on a repo with no commit, where `HEAD` resolves to nothing.
 */
export async function diffAgainstHead(dir: string): Promise<string | null> {
  return git(dir, ['diff', 'HEAD', '-U0', '--relative', '--', '.']);
}

/** `git mv`, which keeps the rename in history. Only valid inside one repository. */
export async function gitMove(dir: string, from: string, to: string): Promise<boolean> {
  return (await git(dir, ['mv', from, to])) !== null;
}
