import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { Answers } from '../src/lib/types.ts';
import { renderAll } from '../src/render/index.ts';
import { cleanup, DEFAULT_ANSWERS, tempDir, testContext } from './helpers.ts';

const GUARD = join(import.meta.dir, '..', 'templates', 'hooks', 'commit-guard.sh');

/** No global or system config, so a developer's own `~/.gitconfig` cannot decide the result. */
const HERMETIC_GIT = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

let outside = '';

beforeAll(async () => {
  outside = await tempDir();
});

afterAll(async () => {
  await cleanup(outside);
});

async function guard(command: string): Promise<{ code: number; stderr: string }> {
  const proc = Bun.spawn(['bash', GUARD], {
    cwd: outside,
    env: { ...process.env, ...HERMETIC_GIT },
    stdin: new TextEncoder().encode(
      JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    ),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stderr = await new Response(proc.stderr).text();
  return { code: await proc.exited, stderr };
}

const BLOCKED = 2;
const ALLOWED = 0;

/**
 * Board row 79, on Zach's answers of 2026-10-04 (option A): the rule's two verbs, `git checkout --`
 * and `git stash`, and the other spellings of the same act. Until then the guard passed every one.
 */
describe('the commit guard blocks the commands that throw away uncommitted work', () => {
  const blocked: Array<[string, string]> = [
    ['a bare stash', 'git stash'],
    ['a stash that takes untracked files', 'git stash push -u'],
    ['the old spelling of push', 'git stash save wip'],
    ['a stash with only a flag', 'git stash -u'],
    // `refs/stash` is shared by every worktree, so these reach every session's stash.
    ['popping a stash', 'git stash pop'],
    ['applying a stash', 'git stash apply'],
    ['dropping a stash', 'git stash drop'],
    ['clearing every stash', 'git stash clear'],
    ['a stash behind -C', 'git -C . stash pop'],
    ['checkout of a path', 'git checkout -- src'],
    ['checkout of a path from a commit', 'git checkout HEAD -- src'],
    ['checkout of the whole tree', 'git checkout .'],
    ['checkout of the whole tree by magic pathspec', 'git checkout :/'],
    ['a forced checkout', 'git checkout -f'],
    ['a forced checkout, abbreviated', 'git checkout --forc main'],
    ['a forced checkout in a cluster', 'git checkout -fb x'],
    ['restore of the working tree', 'git restore src'],
    ['restore of both, staged and working tree', 'git restore -W --staged src'],
    ['restore of both, worktree abbreviated', 'git restore --staged --wor src'],
    // `-s` takes a value, so this is `--source=S`, which writes the working tree.
    ['restore with a source that reads as -S', 'git restore -sS src'],
    ['a hard reset', 'git reset --hard'],
    ['a hard reset, abbreviated', 'git reset --har HEAD~1'],
    ['switch, discarding changes', 'git switch --discard-changes main'],
    ['switch, discarding changes, abbreviated', 'git switch --disc main'],
    ['switch -f', 'git switch -f main'],
    ['switch --force', 'git switch --force main'],
    ['after another command', 'ls && git stash'],
    ['inside a shell wrapper', 'sh -c "git stash pop"'],
    // The shell rewrites these after the guard has read them.
    ['a brace group the shell expands to -f', 'git checkout {-f,main}'],
    ['a word the shell substitutes', 'git checkout $X'],
    ['words added by xargs', 'echo -f | xargs git checkout main'],
  ];

  for (const [name, command] of blocked) {
    test(`blocks ${name}: ${command}`, async () => {
      expect((await guard(command)).code).toBe(BLOCKED);
    });
  }
});

describe('the commit guard lets through what loses no work', () => {
  const allowed: Array<[string, string]> = [
    ['listing stashes', 'git stash list'],
    ['showing a stash', 'git stash show -p'],
    ['checkout of a branch', 'git checkout main'],
    ['creating a branch', 'git checkout -b feature/x'],
    // `-b` takes a value, so `f` is the branch name here, not `-f`.
    ['creating a branch named f', 'git checkout -bf x'],
    ['checkout of the previous branch', 'git checkout @{-1}'],
    ['switch to a branch', 'git switch main'],
    ['switch, creating a branch named f', 'git switch -cf new'],
    ['unstaging', 'git restore --staged src'],
    ['unstaging, short flag', 'git restore -S src'],
    ['a bare reset, which unstages', 'git reset'],
    ['a soft reset to a reflog entry', 'git reset --soft HEAD@{1}'],
    // The delete guard's decision, not this one's (DESIGN.md §10.6 of setup-tracks).
    ['git clean, on purpose', 'git clean -f'],
    ['a grep for the phrase', 'grep "git stash" PASSOFF.md'],
  ];

  for (const [name, command] of allowed) {
    test(`allows ${name}: ${command}`, async () => {
      expect((await guard(command)).code).toBe(ALLOWED);
    });
  }
});

describe('the message gives the remedy, not the commit ritual', () => {
  test('a discard prints the cp remedy', async () => {
    const { stderr } = await guard('git stash');
    expect(stderr).toContain('reach files another session is working on');
    expect(stderr).toContain('copy the file aside with `cp`, then restore it with `cp`');
    expect(stderr).not.toContain('git add');
  });

  test('a commit still prints the commit message', async () => {
    const { stderr } = await guard('git push');
    expect(stderr).toContain("Blocked: commits and pushes are the owner's.");
  });
});

/**
 * Answer 4 of 2026-10-04: a block under `agent-commits` must explain a rule the agent has read,
 * so both commit policies carry the line.
 */
describe('both commit rules carry the line the guard enforces', () => {
  for (const policy of ['print-blocks', 'agent-commits'] as const) {
    test(`commits.md under ${policy}`, async () => {
      const answers: Answers = { ...DEFAULT_ANSWERS, commitPolicy: policy };
      const files = await renderAll(testContext(answers));
      const rule = files.find((f) => f.path.endsWith(join('rules', 'commits.md')));
      // `PRINT_BLOCKS` has it mid-sentence ("And never …"), `AGENT_COMMITS` as its own paragraph.
      expect(rule?.contents.replace(/\s+/g, ' ').toLowerCase()).toContain(
        'never `git checkout --` or `git stash` to undo an experiment',
      );
    });
  }
});

/**
 * T7 of the row 79 scope, which the scope took from git's manual: the stash is one ref shared by
 * every worktree. It is why the guard fires in a linked worktree too.
 */
describe('git shares one stash between worktrees', () => {
  let repo = '';

  async function git(cwd: string, ...args: string[]): Promise<string> {
    const proc = Bun.spawn(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd,
      env: { ...process.env, ...HERMETIC_GIT },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const out = await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(0);
    return out;
  }

  beforeAll(async () => {
    repo = await tempDir();
    await git(repo, 'init', '-q');
    await Bun.write(join(repo, 'a.txt'), 'one\n');
    await git(repo, 'add', 'a.txt');
    await git(repo, 'commit', '-q', '-m', 'one');
  });

  afterAll(async () => {
    await cleanup(repo);
  });

  test('a stash made in a linked worktree is listed, and dropped, from the main one', async () => {
    const linked = join(repo, 'linked');
    await git(repo, 'worktree', 'add', '-q', linked);
    await Bun.write(join(linked, 'a.txt'), 'another session\n');
    await git(linked, 'stash', 'push', '-q');
    expect(await git(repo, 'stash', 'list')).toContain('stash@{0}');
    await git(repo, 'stash', 'drop', '-q');
    expect(await git(linked, 'stash', 'list')).toBe('');
  });
});
