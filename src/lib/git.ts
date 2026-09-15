import { join } from 'node:path';

/** Every git read is best-effort: a directory that is not a repo must not crash a scan. */
async function git(cwd: string, args: string[]): Promise<string | null> {
  try {
    const proc = Bun.spawn(['git', ...args], { cwd, stdout: 'pipe', stderr: 'ignore' });
    const out = await new Response(proc.stdout).text();
    return (await proc.exited) === 0 ? out.trim() : null;
  } catch {
    return null;
  }
}

export async function isGitRepo(dir: string): Promise<boolean> {
  return await Bun.file(join(dir, '.git', 'HEAD'))
    .exists()
    .then((hit) => hit || Bun.file(join(dir, '.git')).exists());
}

export async function remoteUrl(dir: string): Promise<string | null> {
  return git(dir, ['remote', 'get-url', 'origin']);
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
    const proc = Bun.spawn(['gh', 'api', 'user', '--jq', '.login'], {
      stdout: 'pipe',
      stderr: 'ignore',
    });
    const out = (await new Response(proc.stdout).text()).trim();
    if ((await proc.exited) === 0 && out) return out;
  } catch {
    // gh is not installed; fall through to git config.
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

/** `git mv`, which keeps the rename in history. Only valid inside one repository. */
export async function gitMove(dir: string, from: string, to: string): Promise<boolean> {
  return (await git(dir, ['mv', from, to])) !== null;
}
