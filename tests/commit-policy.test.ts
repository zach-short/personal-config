import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { chmod, copyFile, mkdir, rm, symlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { readText, writeText } from '../src/lib/disk.ts';
import { claudeHooksDir, claudeSettingsFile } from '../src/lib/paths.ts';
import { readStamp } from '../src/lib/stamp.ts';
import type { Answers } from '../src/lib/types.ts';
import { commitPlan, resolvePlan, willWrite } from '../src/lib/write-plan.ts';
import { renderHooks } from '../src/render/hooks.ts';
import { cleanup, DEFAULT_ANSWERS, tempDir, testContext } from './helpers.ts';

const TEMPLATE = join(import.meta.dir, '..', 'templates', 'hooks', 'commit-guard.sh');

/** The track board row 78 reproduces on: code, full weight, kept in git, recommended hook. */
const CODE_FULL_GIT: Answers = {
  ...DEFAULT_ANSWERS,
  hooks: 'commit-guard',
  workKind: 'code',
  configWeight: 'full',
  usesGit: 'yes',
};

async function plan(answers: Answers) {
  return renderHooks(testContext(answers));
}

/**
 * The word the guard reads, by the guard's own rule: drop a trailing carriage return from each
 * line, skip lines starting with `#` and blank lines, and require exactly one line left. Its whole
 * content is the word; any other shape reads as nothing, which the guard takes as `print-blocks`.
 */
function policyWord(contents: string): string {
  const kept = contents
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => !l.startsWith('#') && l.trim() !== '');
  return kept.length === 1 ? (kept[0] ?? '') : '';
}

/** `X2`: `home()` reads `$HOME` on every call, so a test can own one and take it away again. */
async function inTempHome<T>(body: (home: string) => Promise<T>): Promise<T> {
  const previous = process.env.HOME ?? '';
  const dir = await tempDir('pc-home-');
  process.env.HOME = dir;
  try {
    return await body(dir);
  } finally {
    process.env.HOME = previous;
    await cleanup(dir);
  }
}

/**
 * Board row 78 (scoped 2026-10-04, option A). `wantedHooks` never read `commitPolicy`, so a person
 * who let the agent commit and took the recommended hook got a rule telling the agent to commit
 * each slice and a guard that refused every commit. The guard now reads a one-word policy file
 * the wizard writes beside it, and this is the plan that carries it.
 */
describe('the commit policy is planned beside the commit guard', () => {
  for (const policy of ['agent-commits', 'no-rule', 'print-blocks']) {
    test(`violates the old plan: ${policy} plans the guard and a policy file saying so`, async () => {
      const files = await plan({ ...CODE_FULL_GIT, commitPolicy: policy });
      const names = files.map((f) => basename(f.path));
      expect(names).toContain('commit-guard.sh');
      const sidecar = files.find((f) => f.path === join(claudeHooksDir(), 'commit-policy'));
      expect(sidecar).toBeDefined();
      expect(policyWord(sidecar?.contents ?? '')).toBe(policy);
    });
  }

  test('passes: the policy file is stamped on line 1 and is not executable', async () => {
    const files = await plan({ ...CODE_FULL_GIT, commitPolicy: 'agent-commits' });
    const sidecar = files.find((f) => basename(f.path) === 'commit-policy');
    expect(readStamp(sidecar?.contents ?? '')).not.toBeNull();
    expect(sidecar?.contents.startsWith('# personal-config v')).toBe(true);
    expect(sidecar?.mode).toBeUndefined();
  });

  test('passes: an answer the guard does not know is written as print-blocks', async () => {
    const files = await plan({ ...CODE_FULL_GIT, commitPolicy: 'sometimes' });
    const sidecar = files.find((f) => basename(f.path) === 'commit-policy');
    expect(policyWord(sidecar?.contents ?? '')).toBe('print-blocks');
  });

  test('passes: no guard, no policy file', async () => {
    const base = { ...CODE_FULL_GIT, commitPolicy: 'agent-commits' };
    for (const answers of [
      { ...base, configWeight: 'light' },
      { ...base, usesGit: 'no' },
      { ...base, hooks: 'none' },
      { ...base, hooks: 'banner' },
    ]) {
      const names = (await plan(answers)).map((f) => basename(f.path));
      expect(names).not.toContain('commit-policy');
    }
  });
});

/** Exit 2 is what Claude Code reads as "blocked"; 0 lets the tool call through. */
const BLOCKED = 2;
const ALLOWED = 0;

const HERMETIC_GIT = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

/** The guard ships for the bash macOS has, 3.2; run it there rather than a newer one on PATH. */
const BASH = '/bin/bash';

type Run = { code: number; stderr: string };

/**
 * One temp `$HOME` per policy file state, each holding the guard where the wizard installs it and
 * the policy file beside it. The guard finds the file next to itself, so this is the layout it
 * reads in a real install. `work` is the directory the command runs in: a git repository with an
 * empty index, because the guard asks git about every named file and blocks outside a repository.
 * It holds `src/`, `lib/` and `link`, a symlink to `lib/`, so the directory test has directories
 * to find.
 */
const homes: Record<string, string> = {};
let work = '';

/**
 * Index states the disk does not show (audit of row 78, round 3). `staleRepo` tracks `gone/d.ts`
 * and `gone/e.ts` with `gone/` removed, tracks `moved/f.ts` with a plain file `moved` in its
 * place, and tracks `src/a.ts` beside `src/a.tsx`. `fileRepo` tracks `gone` as a plain file, so
 * the same word can be read both ways. `noRepo` is no repository, with git stopped from looking
 * above it. Each index is built with `git add`; nothing is committed.
 */
let staleRepo = '';
let fileRepo = '';
let noRepo = '';

/**
 * A repository with a HEAD (audit of row 78, round 4). `git commit <paths>` matches a word against
 * the index overlaid with the HEAD tree, so a directory gone from the disk and the index but still
 * in HEAD is matched, and its files are committed as deleted. One commit holds `src/a.ts`,
 * `src/a.tsx`, `gone/d.ts`, and a directory for each way it can leave the index: `rmd/` by
 * `git rm -r`, `old/` by `git mv old new`, `cached/` by `git rm -r --cached` then a delete, and
 * `pkg/rmd/` by `git rm -r` below a subdirectory. `gone/d.ts` is then deleted from the disk only.
 * `unbornRepo` has no commit: `src/a.ts` and `lib/b/c.ts` in the index, `lib/` gone from the disk.
 */
let headRepo = '';
let unbornRepo = '';

/** The commit's author and dates are fixed, so the fixture reads no identity from the machine. */
const HERMETIC_COMMIT = {
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
};

async function gitOut(args: string[], cwd: string): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(['git', ...args], {
    cwd,
    env: { ...process.env, ...HERMETIC_GIT, ...HERMETIC_COMMIT },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const code = await proc.exited;
  return { code, out: (await new Response(proc.stdout).text()).trim() };
}

async function git(args: string[], cwd: string): Promise<number> {
  return (await gitOut(args, cwd)).code;
}

/**
 * Records the index as the first commit with plumbing (`write-tree`, `commit-tree`, `update-ref`),
 * which runs no hook and reads no config the hermetic environment does not set.
 */
async function commitIndex(dir: string): Promise<void> {
  const tree = await gitOut(['write-tree'], dir);
  expect(tree.code).toBe(0);
  const commit = await gitOut(['commit-tree', '-m', 'fixture', tree.out], dir);
  expect(commit.code).toBe(0);
  expect(await git(['update-ref', 'HEAD', commit.out], dir)).toBe(0);
}

async function makeHeadRepo(): Promise<string> {
  const dir = await repoWith([
    'src/a.ts',
    'src/a.tsx',
    'gone/d.ts',
    'rmd/x.ts',
    'rmd/y.ts',
    'old/f.ts',
    'cached/g.ts',
    'pkg/keep.ts',
    'pkg/rmd/w.ts',
  ]);
  await commitIndex(dir);
  expect(await git(['rm', '-r', '-q', '--', 'rmd'], dir)).toBe(0);
  expect(await git(['mv', 'old', 'new'], dir)).toBe(0);
  expect(await git(['rm', '-r', '-q', '--cached', '--', 'cached'], dir)).toBe(0);
  await rm(join(dir, 'cached'), { recursive: true });
  expect(await git(['rm', '-r', '-q', '--', 'pkg/rmd'], dir)).toBe(0);
  await rm(join(dir, 'gone', 'd.ts'));
  return dir;
}

async function repoWith(files: string[]): Promise<string> {
  const dir = await tempDir('pc-repo-');
  expect(await git(['init', '-q'], dir)).toBe(0);
  for (const file of files) {
    await mkdir(dirname(join(dir, file)), { recursive: true });
    await Bun.write(join(dir, file), `${file}\n`);
  }
  expect(await git(['add', '--', ...files], dir)).toBe(0);
  return dir;
}

async function makeHome(policy: string | null, mode?: number): Promise<string> {
  const home = await tempDir('pc-home-');
  const dir = join(home, '.claude', 'hooks', 'personal-config');
  await mkdir(dir, { recursive: true });
  await copyFile(TEMPLATE, join(dir, 'commit-guard.sh'));
  if (policy !== null) {
    const file = join(dir, 'commit-policy');
    await Bun.write(file, policy);
    if (mode !== undefined) await chmod(file, mode);
  }
  return home;
}

const STAMP = '# personal-config v0.7.0 · 2026-10-04 · config abcd1234 · standard v1.2.0\n';

beforeAll(async () => {
  work = await tempDir();
  expect(await git(['init', '-q'], work)).toBe(0);
  staleRepo = await repoWith(['gone/d.ts', 'gone/e.ts', 'moved/f.ts', 'src/a.ts', 'src/a.tsx']);
  await rm(join(staleRepo, 'gone'), { recursive: true });
  await rm(join(staleRepo, 'moved'), { recursive: true });
  await Bun.write(join(staleRepo, 'moved'), 'plain\n');
  fileRepo = await repoWith(['gone']);
  headRepo = await makeHeadRepo();
  unbornRepo = await repoWith(['src/a.ts', 'lib/b/c.ts']);
  await rm(join(unbornRepo, 'lib'), { recursive: true });
  noRepo = await tempDir('pc-norepo-');
  homes.empty = await makeHome('');
  homes.commentsOnly = await makeHome(`${STAMP}# a note\n`);
  await mkdir(join(work, 'src'), { recursive: true });
  await mkdir(join(work, 'lib'), { recursive: true });
  await symlink(join(work, 'lib'), join(work, 'link'));
  homes.agent = await makeHome(`${STAMP}# a note\nagent-commits\n`);
  homes.noRule = await makeHome(`${STAMP}no-rule\n`);
  homes.printBlocks = await makeHome(`${STAMP}print-blocks\n`);
  homes.missing = await makeHome(null);
  homes.unknown = await makeHome(`${STAMP}yes\n`);
  homes.twoWords = await makeHome(`${STAMP}agent-commits\nno-rule\n`);
  homes.unreadable = await makeHome(`${STAMP}agent-commits\n`, 0o000);
  homes.spaced = await makeHome(`  agent-commits  \n\n`);
  homes.splitWord = await makeHome(`${STAMP}agent-\ncommits\n`);
  homes.extraWord = await makeHome(`${STAMP}agent-commits please\n`);
  homes.crlf = await makeHome(`${STAMP.replace('\n', '\r\n')}agent-commits\r\n`);
  homes.bare = await makeHome('agent-commits');
});

afterAll(async () => {
  await cleanup(work);
  await cleanup(staleRepo);
  await cleanup(fileRepo);
  await cleanup(headRepo);
  await cleanup(unbornRepo);
  await cleanup(noRepo);
  for (const home of Object.values(homes)) {
    await chmod(
      join(home, '.claude', 'hooks', 'personal-config', 'commit-policy'),
      0o644,
    ).catch(() => undefined);
    await cleanup(home);
  }
});

/**
 * `ceiling` stops git looking above it for a repository. It defaults to the directory above `cwd`,
 * so a temp repository is found and nothing outside it is; a run from a subdirectory of a
 * repository passes the directory above the repository instead.
 */
async function guardIn(
  home: string,
  command: string,
  cwd = work,
  ceiling = dirname(cwd),
): Promise<Run> {
  const proc = Bun.spawn(
    [BASH, join(home, '.claude', 'hooks', 'personal-config', 'commit-guard.sh')],
    {
      cwd,
      env: {
        ...process.env,
        ...HERMETIC_GIT,
        GIT_CEILING_DIRECTORIES: ceiling,
        HOME: home,
      },
      stdin: new TextEncoder().encode(
        JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
      ),
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const code = await proc.exited;
  return { code, stderr: await new Response(proc.stderr).text() };
}

async function exitIn(
  home: string,
  command: string,
  cwd = work,
  ceiling = dirname(cwd),
): Promise<number> {
  return (await guardIn(home, command, cwd, ceiling)).code;
}

/**
 * Board row 78, redesigned 2026-10-04 (Zach, after two audit rounds). Under `agent-commits` the
 * guard lets a commit through only when the whole raw command is one `git commit` of safe words:
 * allowed flags, at least one named file, a quoted string only as the value of `-m` or
 * `--message`, one space or tab between words, and no control character. Everything else falls to
 * the word walk, which blocks every commit.
 */
const ALLOWED_COMMITS: Array<[string, string]> = [
  ['the ritual commit', 'git commit src/a.ts -m "fix x"'],
  ['two files', 'git commit src/a.ts tests/a.test.ts -m "fix x"'],
  ['paths after --', 'git commit -m "fix x" -- src/a.ts'],
  [
    'a message holding separators, redirects and #',
    "git commit src/a.ts -m 'a; b & c | d (e) < f > g # h'",
  ],
  ['--no-verify', 'git commit src/a.ts -m "fix x" --no-verify'],
  ['an unquoted one-word message', 'git commit src/a.ts -m x'],
  ['the message first', "git commit -m 'two words' src/a.ts"],
  ['-o', 'git commit -o src/a.ts src/b.ts -m x'],
  ['--only', 'git commit --only src/a.ts -m x'],
  ['a flag cluster ending in -m, quoted value', 'git commit -qm "fix x" src/a.ts'],
  ['--message= unquoted', 'git commit --message=x src/a.ts'],
  ['--message= quoted', 'git commit --message="fix x" src/a.ts'],
  ['--message and a quoted value', "git commit --message 'fix x' src/a.ts"],
  ['a message from a file', 'git commit -F msg.txt src/a.ts'],
  ['reusing a message, with files named', 'git commit -C HEAD src/a.ts'],
  ['signed off', 'git commit -s src/a.ts -m x'],
  ['a tab between words', 'git commit\tsrc/a.ts\t-m\tx'],
  ['a quoted message holding glob characters', 'git commit src/a.ts -m "fix [x]? *"'],
  ['a single-quoted message holding a dollar', "git commit src/a.ts -m 'costs $5'"],
  ['a double-quoted message holding a separator', 'git commit src/a.ts -m "x; y"'],
  ['a path holding safe punctuation', 'git commit src/a_b-c.d@e+f,g:h=i.ts -m x'],
];

describe('under agent-commits, one simple commit that names its files passes', () => {
  for (const [what, command] of ALLOWED_COMMITS) {
    test(`passes: ${what}`, async () => {
      expect(await exitIn(homes.agent ?? '', command)).toBe(ALLOWED);
    });
  }

  for (const [what, command] of [
    ['staging a new file', 'git add -N src/new.ts'],
    ['staging named files', 'git add src/a.ts tests/a.test.ts'],
    ['catching up', 'git merge --ff-only main'],
    ['a read', 'git status --short'],
  ]) {
    test(`passes, through the walk as before: ${what}`, async () => {
      expect(await exitIn(homes.agent ?? '', command ?? '')).toBe(ALLOWED);
    });
  }
});

/**
 * Every spelling the two audits of row 78 found, and the forms the commit rule names. Each must
 * block under every policy: the allow decision is made on the whole raw command, so none of these
 * can reach it, and the walk blocks every commit.
 */
const ALWAYS_BLOCKED: Array<[string, string]> = [
  ['stderr into stdout', 'git commit -m "fix" 2>&1'],
  ['stderr into stdout, then a pipe', 'git commit -m "fix" 2>&1 | tail -3'],
  ['stdout to a file', 'git commit -m x >/dev/null'],
  ['stderr to a file', 'git commit -m x 2>/dev/null'],
  ['stdin from a file', 'git commit -m x </dev/null'],
  ['a heredoc', 'git commit -F - <<EOF\nmsg\nEOF'],
  ['a here-string', 'git commit -F - <<<"msg"'],
  ['an appending redirect', 'git commit -m x >>log'],
  ['a comment after the message', 'git commit -m x # src/a.ts'],
  ['a redirect beside a named file', 'git commit src/a.ts -m "fix x" 2>&1'],
  ['a climb out of a missing directory', 'git commit -m x nosuch/../lib'],
  ['a climb out of a file', 'git commit -m x src/a.ts/../../lib'],
  ['a leading climb', 'git commit -m x ../lib'],
  ['&> then .', 'git commit src/a.ts -m x &>/dev/null .'],
  ['&> and a space, then :/', 'git commit src/a.ts -m x &> /dev/null :/'],
  ['&> then --amend', 'git commit src/a.ts -m x &>/dev/null --amend'],
  ['a backslash-newline, then .', 'git commit -m x src/a.ts\\\n.'],
  ['a backslash-newline, then :/', 'git commit -m x src/a.ts\\\n:/'],
  ['a zsh glob group', 'git commit -m x s(r)c'],
  [`\${IFS} in place of spaces`, `git commit\${IFS}-am\${IFS}x src/a.ts`],
  ['a brace expansion as the subcommand', 'git {commit,-m,x}'],
  ['behind env', 'env git commit src/a.ts -m x'],
  ['through sh -c', 'sh -c "git commit src/a.ts -m x"'],
  ['through xargs', 'echo src/a.ts | xargs git commit -m x'],
  ['after cd', 'cd x && git commit src/a.ts -m x'],
  ['after another command', 'bun test && git commit src/a.ts -m x'],
  ['then a push', 'git commit src/a.ts -m x; git push'],
  ['behind git -C', 'git -C . commit src/a.ts -m x'],
  ['behind git -c', 'git -c core.x=y commit src/a.ts -m x'],
  ['-a', 'git commit -a src/a.ts -m x'],
  ['-am', 'git commit -am x src/a.ts'],
  ['--all', 'git commit --all src/a.ts -m x'],
  ['an abbreviation of --all', 'git commit --al src/a.ts -m x'],
  ['-i', 'git commit -i src/a.ts -m x'],
  ['--include', 'git commit --include src/a.ts -m x'],
  ['-p', 'git commit -p src/a.ts -m x'],
  ['--patch', 'git commit --patch src/a.ts -m x'],
  ['--amend', 'git commit --amend src/a.ts -m x'],
  ['--allow-empty', 'git commit --allow-empty src/a.ts -m x'],
  ['--pathspec-from-file', 'git commit --pathspec-from-file=list.txt -m x'],
  ['--fixup', 'git commit --fixup HEAD src/a.ts'],
  ['--squash', 'git commit --squash HEAD src/a.ts'],
  ['-e', 'git commit -e src/a.ts -m x'],
  ['-u', 'git commit -u src/a.ts -m x'],
  ['-S', 'git commit -S src/a.ts -m x'],
  ['the current directory', 'git commit . -m x'],
  ['the current directory after --', 'git commit -m x -- .'],
  ['a directory that exists', 'git commit src -m x'],
  ['a directory with a slash', 'git commit lib/ -m x'],
  ['a symlink to a directory', 'git commit link -m x'],
  ['the whole tree by pathspec magic', 'git commit :/ -m x'],
  ['no path', 'git commit -m "fix x"'],
  ['a bare commit', 'git commit'],
  ['a quoted path', "git commit '.' -m x"],
  ['an empty quoted path', 'git commit "" -m x'],
  ['a quoted file name', 'git commit "src/a.ts" -m x'],
  ['a message from a variable', 'git commit src/a.ts -m $X'],
  ['a dollar inside double quotes', 'git commit src/a.ts -m "costs $5"'],
  ['a backtick inside double quotes', 'git commit src/a.ts -m "x `y`"'],
  ['a backslash inside double quotes', 'git commit src/a.ts -m "x\\"y"'],
  ['an unclosed quote', 'git commit src/a.ts -m "x'],
  ['a quote touching a word', "git commit src/a.ts -m x'.'"],
  ['two spaces between words', 'git commit  src/a.ts -m x'],
  ['a trailing space', 'git commit src/a.ts -m x '],
  ['a message flag with no value', 'git commit src/a.ts -m'],
  ['a word starting with =', 'git commit =git -m x'],
  ['a leading ~', 'git commit ~ -m x'],
  ['an unquoted glob', 'git commit src/*.ts -m x'],
  ['a brace expansion', 'git commit src/{a,b}.ts -m x'],
];

describe('every other spelling of a commit blocks, under every policy', () => {
  for (const [key, policy] of [
    ['agent', 'agent-commits'],
    ['noRule', 'no-rule'],
    ['printBlocks', 'print-blocks'],
    ['missing', 'no policy file'],
  ] as const) {
    for (const [what, command] of ALWAYS_BLOCKED) {
      test(`violates under ${policy}: ${what}`, async () => {
        expect(await exitIn(homes[key] ?? '', command)).toBe(BLOCKED);
      });
    }
  }
});

/**
 * The property behind the redesign: no shell metacharacter, newline or carriage return outside
 * quotes can sit in an allowed command. Each one is put, unquoted, at four places in a command
 * that passes, and every result must block.
 */
describe('a shell metacharacter anywhere outside quotes blocks the commit', () => {
  const base = 'git commit src/a.ts -m "fix x"';
  const chars = [
    '&',
    '|',
    ';',
    '(',
    ')',
    '<',
    '>',
    '\\',
    '$',
    '`',
    '#',
    '~',
    '*',
    '?',
    '[',
    ']',
    '{',
    '}',
    '!',
    '\n',
    '\r',
  ];
  const places: Array<[string, (c: string) => string]> = [
    ['at the end', (c) => `${base}${c}`],
    ['as a word between words', (c) => base.replace(' -m ', ` ${c} -m `)],
    ['inside the path', (c) => base.replace('src/a.ts', `src/a${c}.ts`)],
    ['inside a flag', (c) => base.replace(' -m ', ` -${c}m `)],
  ];

  test('passes: the base command is allowed', async () => {
    expect(await exitIn(homes.agent ?? '', base)).toBe(ALLOWED);
  });

  for (const [where, put] of places) {
    test(`violates: each character ${where}`, async () => {
      const passed: string[] = [];
      for (const c of chars) {
        if ((await exitIn(homes.agent ?? '', put(c))) !== BLOCKED)
          passed.push(JSON.stringify(c));
      }
      expect(passed).toEqual([]);
    });
  }
});

describe('under agent-commits, the rest of row 77 is unchanged', () => {
  const blocked: Array<[string, string]> = [
    ['a push', 'git push'],
    ['a push to a remote', 'git push origin main'],
    ['a push behind -C', 'git -C . push'],
    ['merging a pull request', 'gh pr merge 26'],
    ['staging everything', 'git add -A'],
    ['staging everything by long flag', 'git add --all'],
    ['staging the current directory', 'git add .'],
    ['a cherry-pick', 'git cherry-pick abc123'],
    ['a revert', 'git revert HEAD'],
    ['a merge', 'git merge main'],
    ['a rebase', 'git rebase main'],
    ['applying a patch', 'git am x.patch'],
    ['a pull', 'git pull'],
  ];

  for (const [what, command] of blocked) {
    test(`violates: ${what}`, async () => {
      expect(await exitIn(homes.agent ?? '', command)).toBe(BLOCKED);
    });
  }

  test('passes: the message says what is allowed', async () => {
    const { code, stderr } = await guardIn(homes.agent ?? '', 'git commit -m x');
    expect(code).toBe(BLOCKED);
    expect(stderr).toContain('You may commit, but only the files you name');
    expect(stderr).toContain(
      'Inside double quotes, do not put $, a backtick, a\nbackslash or ! in it.',
    );
    expect(stderr).toContain('Never push.');
    expect(stderr).toContain('git add -A');
    expect(stderr).not.toContain('free of');
    expect(stderr).not.toContain("commits and pushes are the owner's");
  });
});

/**
 * The audit of row 78, round 3 (2026-10-04): git matches a path word against the index, and a
 * word matches every entry below it. The directory test read only the disk, so after `rm -r gone`
 * the word `gone` passed, and the commit would have recorded the deletion of every file under it.
 * The guard now asks `git ls-files` for entries below the word, and blocks when git cannot answer.
 */
describe('under agent-commits, a word the index holds entries below blocks', () => {
  const blocked: Array<[string, string, () => string]> = [
    ['a deleted directory, after the message', 'git commit -m x gone', () => staleRepo],
    ['a deleted directory, before the message', 'git commit gone -m "fix x"', () => staleRepo],
    ['a deleted directory after --', 'git commit -m x -- gone', () => staleRepo],
    [
      'a deleted directory beside a named file',
      'git commit src/a.ts gone -m x',
      () => staleRepo,
    ],
    [
      'a plain file where the index holds a directory',
      'git commit -m x moved',
      () => staleRepo,
    ],
    ['a named file outside a repository', 'git commit src/a.ts -m x', () => noRepo],
  ];

  for (const [what, command, cwd] of blocked) {
    test(`violates: ${what}`, async () => {
      expect(await exitIn(homes.agent ?? '', command, cwd())).toBe(BLOCKED);
    });
  }

  const allowed: Array<[string, string, () => string]> = [
    ['the same word, where it is a tracked file', 'git commit -m x gone', () => fileRepo],
    ['a deleted file named by its own path', 'git commit -m x gone/d.ts', () => staleRepo],
    [
      'a file whose name begins another entry',
      'git commit src/a.ts -m "fix x"',
      () => staleRepo,
    ],
  ];

  for (const [what, command, cwd] of allowed) {
    test(`passes: ${what}`, async () => {
      expect(await exitIn(homes.agent ?? '', command, cwd())).toBe(ALLOWED);
    });
  }

  test('violates under print-blocks: a deleted directory, as before', async () => {
    expect(await exitIn(homes.printBlocks ?? '', 'git commit -m x gone', staleRepo)).toBe(
      BLOCKED,
    );
  });
});

/**
 * The audit of row 78, round 4 (2026-10-04): `git commit <paths>` matches a word against the index
 * overlaid with the HEAD tree (`list_paths()` in builtin/commit.c), so a directory gone from the
 * disk and the index but still in HEAD passed the round-3 check, and git would commit the deletion
 * of every file under it. The guard now asks `git ls-files --with-tree=<HEAD>`, the same overlay,
 * and lets a word through only when git prints the word itself or nothing.
 */
describe('a word git matches more than itself in the index or HEAD blocks', () => {
  const blocked: Array<[string, string, () => string, () => string]> = [
    ['after git rm -r, the word after the message', 'git commit -m x rmd', root, root],
    ['after git rm -r, the word before the message', 'git commit rmd -m "x"', root, root],
    ['after git rm -r, the word after --', 'git commit -m x -- rmd', root, root],
    ['after git rm -r, beside a named file', 'git commit src/a.ts rmd -m x', root, root],
    ['after git mv old new, the old name', 'git commit -m x old', root, root],
    ['after git rm -r --cached and a delete', 'git commit -m x cached', root, root],
    ['after git rm -r, from a subdirectory', 'git commit -m x rmd', pkg, root],
    ['a directory still on disk and in HEAD', 'git commit -m x pkg', root, root],
    [
      'an unborn branch, a word the index holds entries below',
      'git commit -m x lib',
      unborn,
      unborn,
    ],
    ['outside a repository', 'git commit src/a.ts -m x', () => noRepo, () => noRepo],
  ];

  function root(): string {
    return headRepo;
  }
  function pkg(): string {
    return join(headRepo, 'pkg');
  }
  function unborn(): string {
    return unbornRepo;
  }

  for (const [key, policy] of [
    ['agent', 'agent-commits'],
    ['noRule', 'no-rule'],
    ['printBlocks', 'print-blocks'],
    ['missing', 'no policy file'],
  ] as const) {
    for (const [what, command, cwd, repo] of blocked) {
      test(`violates under ${policy}: ${what}`, async () => {
        expect(await exitIn(homes[key] ?? '', command, cwd(), dirname(repo()))).toBe(BLOCKED);
      });
    }
  }

  const allowed: Array<[string, string, () => string, () => string]> = [
    ['the ritual, from the repository root', 'git commit src/a.ts -m "fix x"', root, root],
    ['the ritual, from a subdirectory', 'git commit keep.ts -m "fix x"', pkg, root],
    ['a file whose name begins another entry', 'git commit src/a.ts -m x', root, root],
    [
      'a tracked file deleted from the disk, by its own path',
      'git commit -m x gone/d.ts',
      root,
      root,
    ],
    [
      'the new name after git mv, named file by file',
      'git commit -m x new/f.ts old/f.ts',
      root,
      root,
    ],
    ['an unborn branch, a file in the index', 'git commit src/a.ts -m "fix x"', unborn, unborn],
  ];

  for (const [what, command, cwd, repo] of allowed) {
    test(`passes under agent-commits: ${what}`, async () => {
      expect(await exitIn(homes.agent ?? '', command, cwd(), dirname(repo()))).toBe(ALLOWED);
    });
  }

  test('passes: the fixture is what the audit described', async () => {
    const inIndex = await gitOut(['ls-files', '--', 'rmd', 'old', 'cached'], headRepo);
    expect(inIndex.out).toBe('');
    const inHead = await gitOut(['ls-files', '--with-tree=HEAD', '--', 'rmd'], headRepo);
    expect(inHead.out.split('\n')).toEqual(['rmd/x.ts', 'rmd/y.ts']);
  });
});

/**
 * `no-rule` blocks every commit (Zach, 2026-10-04, reversing the first build's call to read it as
 * `agent-commits`). The sidecar still says `no-rule`; the guard reads that word as `print-blocks`.
 */
describe('under no-rule, the guard acts as it does under print-blocks', () => {
  test('violates: a commit that names its files, with the owner-only message', async () => {
    const { code, stderr } = await guardIn(
      homes.noRule ?? '',
      'git commit src/a.ts -m "fix x"',
    );
    expect(code).toBe(BLOCKED);
    expect(stderr).toContain("commits and pushes are the owner's");
  });

  test('passes: a read', async () => {
    expect(await exitIn(homes.noRule ?? '', 'git status --short')).toBe(ALLOWED);
  });
});

/**
 * Answer 3, Zach in chat 2026-10-04: a missing policy file means `print-blocks`. So do an
 * unreadable file and a word the guard does not know: each fails closed, to the guard's behaviour
 * before the file existed, message included.
 */
describe('a policy the guard cannot read means print-blocks', () => {
  const states: Array<[string, string]> = [
    ['print-blocks, written', 'printBlocks'],
    ['no file', 'missing'],
    ['an unknown word', 'unknown'],
    ['two words on two lines', 'twoWords'],
    ['a word split across two lines', 'splitWord'],
    ['a word and an extra word', 'extraWord'],
    ['a word with spaces around it', 'spaced'],
    ['an unreadable file', 'unreadable'],
    ['an empty file', 'empty'],
    ['a file holding only the stamp and a comment', 'commentsOnly'],
  ];

  for (const [what, key] of states) {
    test(`violates: ${what} blocks a commit that names its files`, async () => {
      const { code, stderr } = await guardIn(homes[key] ?? '', 'git commit src/a.ts -m x');
      expect(code).toBe(BLOCKED);
      expect(stderr).toContain("commits and pushes are the owner's");
    });

    test(`passes: ${what} still lets a read through`, async () => {
      expect(await exitIn(homes[key] ?? '', 'git status --short')).toBe(ALLOWED);
    });
  }

  for (const [what, key] of [
    ['an empty file', 'empty'],
    ['a file holding only the stamp and a comment', 'commentsOnly'],
  ] as const) {
    test(`violates: ${what} blocks every commit agent-commits would allow`, async () => {
      const passed: string[] = [];
      for (const [, command] of ALLOWED_COMMITS) {
        if ((await exitIn(homes[key] ?? '', command)) !== BLOCKED) passed.push(command);
      }
      expect(passed).toEqual([]);
    });
  }

  test('passes: the word alone, with no stamp and no final newline, is read', async () => {
    expect(await exitIn(homes.bare ?? '', 'git commit src/a.ts -m x')).toBe(ALLOWED);
  });

  test('passes: a file with Windows line endings is read', async () => {
    expect(await exitIn(homes.crlf ?? '', 'git commit src/a.ts -m x')).toBe(ALLOWED);
  });

  test('passes: the test helper reads each file as the guard does', () => {
    expect(policyWord(`${STAMP}agent-commits\n`)).toBe('agent-commits');
    expect(policyWord(`${STAMP}agent-\ncommits\n`)).toBe('');
    expect(policyWord(`${STAMP}agent-commits\nno-rule\n`)).toBe('');
    expect(policyWord('agent-commits\r\n')).toBe('agent-commits');
  });
});

/**
 * The real pipeline, in a temp `$HOME`: render, resolve, commit, then run what was written by bare
 * path, the way a `command` entry runs it. And an existing install: a re-run under a new answer
 * rewrites the script and adds the policy file, while the `settings.json` merge adds nothing.
 */
describe('an install carries the policy to the guard', () => {
  test('passes: an agent-commits install lets a named commit through', async () => {
    await inTempHome(async () => {
      const files = await plan({ ...CODE_FULL_GIT, commitPolicy: 'agent-commits' });
      await commitPlan(await resolvePlan(files));
      const guard = join(claudeHooksDir(), 'commit-guard.sh');
      const run = async (command: string) => {
        const proc = Bun.spawn([guard], {
          cwd: work,
          env: { ...process.env, ...HERMETIC_GIT },
          stdin: new TextEncoder().encode(
            JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
          ),
          stdout: 'pipe',
          stderr: 'pipe',
        });
        return proc.exited;
      };
      expect(await run('git commit src/a.ts -m x')).toBe(ALLOWED);
      expect(await run('git commit -m x')).toBe(BLOCKED);
      expect(await run('git push')).toBe(BLOCKED);
    });
  });

  test('passes: a re-run under a new answer adds the policy file and leaves settings.json', async () => {
    await inTempHome(async () => {
      // An install from before row 78: the guard and its settings entry, and no policy file.
      const before = await plan({ ...CODE_FULL_GIT, commitPolicy: 'print-blocks' });
      await commitPlan(
        await resolvePlan(before.filter((f) => basename(f.path) !== 'commit-policy')),
      );
      await writeText(
        join(claudeHooksDir(), 'commit-guard.sh'),
        '#!/usr/bin/env bash\n# personal-config v0.6.0 · 2026-09-29 · config 9acfdf35 · standard v1.2.0\nexit 2\n',
      );
      const settingsBefore = await readText(claudeSettingsFile());

      const changes = await resolvePlan(
        await plan({ ...CODE_FULL_GIT, commitPolicy: 'agent-commits' }),
      );
      const written = changes.filter(willWrite).map((c) => basename(c.file.path));
      expect(written.sort()).toEqual(['commit-guard.sh', 'commit-policy']);
      await commitPlan(changes);
      expect(await readText(claudeSettingsFile())).toBe(settingsBefore);
      expect(policyWord(await readText(join(claudeHooksDir(), 'commit-policy')))).toBe(
        'agent-commits',
      );
    });
  });
});
