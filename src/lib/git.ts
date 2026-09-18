import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
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
async function git(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run('git', args, { cwd, maxBuffer: MAX_OUTPUT });
    return stdout.trim();
  } catch {
    return null;
  }
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
