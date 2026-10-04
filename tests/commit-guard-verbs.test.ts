import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { cleanup, tempDir } from './helpers.ts';

const GUARD = join(import.meta.dir, '..', 'templates', 'hooks', 'commit-guard.sh');

/**
 * The `--ff-only` carve-out asks git whether `merge.autoStash` is set, so every case runs in a
 * scratch directory with no global or system config: a developer's own `~/.gitconfig` must not
 * decide whether this suite is green.
 */
let outside = '';
let autostashRepo = '';
/** Holds a file named `--no-ff`, so a `*` here reaches git as that flag. */
let globDir = '';

const HERMETIC_GIT = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

async function run(argv: string[], cwd: string): Promise<number> {
  const proc = Bun.spawn(argv, {
    cwd,
    env: { ...process.env, ...HERMETIC_GIT },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return proc.exited;
}

beforeAll(async () => {
  outside = await tempDir();
  autostashRepo = await tempDir();
  expect(await run(['git', 'init', '-q'], autostashRepo)).toBe(0);
  expect(await run(['git', 'config', 'merge.autoStash', 'true'], autostashRepo)).toBe(0);
  globDir = await tempDir();
  await Bun.write(join(globDir, '--no-ff'), '');
});

afterAll(async () => {
  await cleanup(outside);
  await cleanup(autostashRepo);
  await cleanup(globDir);
});

/** Exit 2 is what Claude Code reads as "blocked"; 0 lets the tool call through. */
async function guard(command: string, cwd = outside): Promise<number> {
  const proc = Bun.spawn(['bash', GUARD], {
    cwd,
    env: { ...process.env, ...HERMETIC_GIT },
    stdin: new TextEncoder().encode(
      JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    ),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return proc.exited;
}

const BLOCKED = 2;
const ALLOWED = 0;

/**
 * Board row 77, on Zach's answer of 2026-10-02 (option B): every git verb that writes a commit
 * is the owner's, not only `commit`. Until then the guard passed all of these, and on
 * 2026-10-01 a session made a commit on `main` with the first one.
 */
describe('the commit guard blocks every verb that writes a commit', () => {
  const blocked: Array<[string, string]> = [
    ['the 2026-10-01 cherry-pick, verbatim', 'git cherry-pick 5f4d17a'],
    ['a revert', 'git revert HEAD'],
    ['a merge', 'git merge main'],
    ['a merge that always writes a merge commit', 'git merge --no-ff main'],
    // `--autostash` stashes the whole working tree, other sessions' edits included.
    ['a fast-forward merge with --autostash', 'git merge --ff-only --autostash main'],
    ['a rebase', 'git rebase main'],
    ['applying a patch as a commit', 'git am x.patch'],
    ['a pull', 'git pull'],
    // `git fetch` then `git merge --ff-only` does the same job and is let through.
    ['a fast-forward pull', 'git pull --ff-only'],
    ['a cherry-pick that only stages', 'git cherry-pick -n x'],
    ['continuing a cherry-pick', 'git cherry-pick --continue'],
    ['continuing a rebase', 'git rebase --continue'],
    ['skipping a commit in a rebase', 'git rebase --skip'],
    ['a cherry-pick behind a global option that takes an argument', 'git -C . cherry-pick x'],
    ['a rebase inside a shell wrapper', 'sh -c "git rebase main"'],
    ['a merge after another command', 'ls && git merge main'],
    // It writes a commit on the remote's `main`, so it is a push.
    ['merging a pull request', 'gh pr merge 26'],
    ['merging a pull request with a flag first', 'gh pr merge --squash 26'],
    ['merging a pull request with gh spelled out', '/opt/homebrew/bin/gh pr merge 26'],
  ];

  for (const [what, command] of blocked) {
    test(`violates: ${what}`, async () => {
      expect(await guard(command)).toBe(BLOCKED);
    });
  }
});

/**
 * Build-level calls made in row 77 so that "an unknown flag never earns a pass": each of these
 * carries a carve-out's word and still writes a commit, or stashes other sessions' work.
 */
describe('the carve-outs cannot be borrowed by a form that writes a commit', () => {
  const blocked: Array<[string, string]> = [
    ['a merge whose message is "--abort"', 'git merge -m --abort main'],
    ['a merge whose message is "--ff-only"', 'git merge -m --ff-only main'],
    ['a later --no-ff, which git obeys over --ff-only', 'git merge --ff-only --no-ff main'],
    ['an abbreviation of --autostash', 'git merge --ff-only --autos main'],
    ['--abort beside a flag that is not', 'git cherry-pick --abort -n x'],
    // The Fable review of 2026-10-04: each reaches git as `--no-ff`, which the walk never saw.
    ['a --no-ff hidden by a backslash', 'git merge --ff-only \\--no-ff main'],
    ['a --no-ff from a command substitution', 'git merge --ff-only $(echo --no-ff) main'],
    ['a --no-ff from backticks', 'git merge --ff-only `echo --no-ff` main'],
    ['a flag from a variable beside --abort', 'git rebase --abort $X'],
    ['autostash set by -c', 'git -c merge.autoStash=true merge --ff-only main'],
    [
      'autostash set from the environment',
      'GIT_CONFIG_PARAMETERS="merge.autostash=true" git merge --ff-only main',
    ],
    // The audit of row 77, 2026-10-04: the shell or `xargs` adds `--no-ff` after the guard has
    // read the words, and git obeys it over `--ff-only`.
    ['a --no-ff from brace expansion', 'git merge --ff-only {--no-ff,main}'],
    ['a --no-ff from brace expansion after the branch', 'git merge --ff-only main{,--no-ff}'],
    ['a --no-ff from a ? glob', 'git merge --ff-only ?-no-ff main'],
    ['a --no-ff from a [ glob', 'git merge --ff-only [-]-no-ff main'],
    ['a --no-ff fed to xargs', 'echo --no-ff | xargs git merge --ff-only main'],
    ['a branch and --no-ff fed to xargs', "printf 'main --no-ff' | xargs git merge --ff-only"],
    ['xargs with a flag of its own', 'echo x | xargs -I{} git merge --ff-only main'],
    ['--abort beside a glob', 'git rebase --abort *'],
    ['--abort fed to xargs', 'echo --onto | xargs git rebase --abort'],
  ];

  for (const [what, command] of blocked) {
    test(`violates: ${what}`, async () => {
      expect(await guard(command)).toBe(BLOCKED);
    });
  }

  test('violates: a * in a directory holding a file named --no-ff', async () => {
    expect(await guard(`git -C ${outside} merge --ff-only * main`, globDir)).toBe(BLOCKED);
  });

  test('violates: a fast-forward in a repo whose config sets merge.autoStash', async () => {
    expect(await guard('git merge --ff-only main', autostashRepo)).toBe(BLOCKED);
  });

  test('violates: a fast-forward reaching that repo with -C', async () => {
    expect(await guard(`git -C ${autostashRepo} merge --ff-only main`)).toBe(BLOCKED);
  });
});

describe('the commit guard lets through the forms that write no commit', () => {
  const allowed: Array<[string, string]> = [
    // The documented refresh of a stale worktree.
    ['a fast-forward merge', 'git merge --ff-only main'],
    ['a fast-forward merge with the flag after the branch', 'git merge main --ff-only'],
    // A `/` is not a glob character, so the glob refusal costs a real branch nothing.
    ['a fast-forward to a branch with a slash', 'git merge --ff-only feature/x'],
    ['a fast-forward to a remote branch', 'git merge --ff-only origin/main'],
    ['a quiet fast-forward', 'git merge -q --ff-only main'],
    // These wrappers add no word after the ones the guard reads, unlike `xargs`.
    ['a fast-forward behind env', 'env git merge --ff-only main'],
    ['a fast-forward behind nohup', 'nohup git merge --ff-only main'],
    ['backing out of a merge', 'git merge --abort'],
    ['backing out of a cherry-pick', 'git cherry-pick --abort'],
    ['leaving a revert', 'git revert --quit'],
    ['backing out of a rebase', 'git rebase --abort'],
    ['backing out of a patch', 'git am --abort'],
    ['fetching', 'git fetch origin main'],
    ['viewing a pull request', 'gh pr view 26'],
    ['reading a pull request checks', 'gh pr checks 26'],
    ['listing merge commits', 'git log --merges'],
    ['a search for the phrase', 'grep "git rebase" PASSOFF.md'],
  ];

  for (const [what, command] of allowed) {
    test(`passes: ${what}`, async () => {
      expect(await guard(command)).toBe(ALLOWED);
    });
  }

  test('passes: a fast-forward with -C into a repo that sets nothing', async () => {
    expect(await guard(`git -C ${outside} merge --ff-only main`)).toBe(ALLOWED);
  });
});

/**
 * These write a commit, or stash other sessions' work, and pass. They are pinned passing so that catching one later is a
 * deliberate change made against a red test, the way the delete guard's "Not caught" list is.
 */
describe('the commit guard does not catch, by decision', () => {
  const uncaught: Array<[string, string]> = [
    ['plumbing that writes a commit object', 'git commit-tree HEAD^{tree} -m x'],
    ['the merge endpoint through gh api', 'gh api -X PUT repos/o/r/pulls/1/merge'],
    // The autostash check reads the current segment and the config git reads from the hook's
    // own environment. Config set from an earlier segment, or from another HOME, is not seen.
    [
      'autostash exported in an earlier segment',
      'export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=merge.autoStash GIT_CONFIG_VALUE_0=true; git merge --ff-only main',
    ],
    [
      'a global config file exported in an earlier segment',
      'export GIT_CONFIG_GLOBAL=/tmp/other.gitconfig; git merge --ff-only main',
    ],
    [
      'another HOME, which holds another ~/.gitconfig',
      'HOME=/tmp/other git merge --ff-only main',
    ],
    ['another XDG_CONFIG_HOME', 'XDG_CONFIG_HOME=/tmp/other git merge --ff-only main'],
  ];

  for (const [what, command] of uncaught) {
    test(`passes: ${what}`, async () => {
      expect(await guard(command)).toBe(ALLOWED);
    });
  }
});
