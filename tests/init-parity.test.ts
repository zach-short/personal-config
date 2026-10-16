/**
 * `init` and `setup` write the same bytes into the same folder (init-command D8), and `init` writes
 * nothing outside it (D2). This is `DESIGN.md` §7's stamp-drift hazard tested on real bytes: the
 * plan's filter alone cannot show that `init` saves the answer set `setup` would, and a different
 * set moves every stamp's hash without changing a line of prose.
 *
 * For one git repo and one plain folder: `setup --yes` configures the target from a projects
 * directory holding only it, the target is put back as it was, and `init --yes` configures it
 * again against the `config.json` that `setup` wrote. Both are the real bin in a child process
 * with `HOME` in a temp directory (`X2`), so `paths.ts` resolves every global path into it.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

async function cli(args: string[], home: string): Promise<number> {
  const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
    cwd: repoRoot(),
    env: { ...process.env, HOME: home },
    stdout: 'ignore',
    stderr: 'ignore',
  });
  return proc.exited;
}

/**
 * Every file under `root`, by relative path, with its bytes. Inside `.git` only `info/exclude` is
 * kept: it is the one file there either command writes, and the rest (the index above all) is
 * git's own bookkeeping, which a read-only `git` call may refresh.
 */
async function snapshot(root: string): Promise<Record<string, string>> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => relative(root, join(e.parentPath, e.name)))
    .filter((path) => !path.startsWith('.git/') || path === '.git/info/exclude')
    .sort();
  const bytes = await Promise.all(files.map((path) => readFile(join(root, path), 'base64')));
  return Object.fromEntries(files.map((path, i) => [path, bytes[i] ?? '']));
}

const CONFIG = '.config/personal-config/config.json';
const BACKUPS = '.config/personal-config/backups/';

/** The two places D2 names: everything under `~/.claude`, and the saved config. */
function global(home: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(home).filter(([path]) => path.startsWith('.claude/') || path === CONFIG),
  );
}

/**
 * Answers a person gave on an earlier run, none of them the profile's default. `setup --yes` takes
 * them as its defaults, and then saves `commitPolicy` under `answers` and the other two only in
 * the `globalAnswers` record (PLAN §0 F3). So `init` matches `setup` here only if it reads the
 * person's answers from `config.json` (BD-3) and the other two from the record (D10). With the
 * profile's defaults instead, both commands would agree whether or not `init` read either.
 */
async function seedSavedAnswers(home: string): Promise<void> {
  const dir = join(home, '.config', 'personal-config');
  await mkdir(dir, { recursive: true });
  const answers = {
    commitPolicy: 'agent-commits',
    outputStyle: 'proactive',
    chatStyle: 'none',
  };
  await writeFile(join(dir, 'config.json'), `${JSON.stringify({ answers }, null, 2)}\n`);
}

type Kind = 'git' | 'folder';

/** A target with something in it to scan: a TypeScript package in git, or notes in a folder. */
async function makeTarget(path: string, kind: Kind): Promise<void> {
  await mkdir(path, { recursive: true });
  if (kind === 'folder') {
    await writeFile(join(path, 'notes.md'), '# Notes\n');
    return;
  }
  await writeFile(join(path, 'package.json'), '{ "name": "widget", "type": "module" }\n');
  await mkdir(join(path, 'src'));
  await writeFile(
    join(path, 'src', 'index.ts'),
    'export function widget(): number {\n  return 1;\n}\n',
  );
  const proc = Bun.spawn(['git', 'init', '--quiet', path], {
    stdout: 'ignore',
    stderr: 'ignore',
  });
  expect(await proc.exited).toBe(0);
}

type Parity = {
  bySetup: Record<string, string>;
  byInit: Record<string, string>;
  homeBefore: Record<string, string>;
  homeAfter: Record<string, string>;
};

async function compare(kind: Kind, work: string): Promise<Parity> {
  const home = join(work, 'home');
  const projects = join(work, 'projects');
  const pristine = join(work, 'pristine', 'widget');
  const target = join(projects, 'widget');
  await seedSavedAnswers(home);
  await makeTarget(pristine, kind);

  await cp(pristine, target, { recursive: true });
  expect(
    await cli(['setup', '--profile', 'starter', '--yes', '--projects-dir', projects], home),
  ).toBe(0);
  const bySetup = await snapshot(target);

  await rm(target, { recursive: true, force: true });
  await cp(pristine, target, { recursive: true });
  const homeBefore = await snapshot(home);
  expect(await cli(['init', target, '--yes'], home)).toBe(0);
  return {
    bySetup,
    byInit: await snapshot(target),
    homeBefore,
    homeAfter: await snapshot(home),
  };
}

describe.each(['git', 'folder'] as const)('init and setup in one %s', (kind) => {
  let work: string;
  let parity: Parity;

  beforeAll(async () => {
    work = await tempDir('pc-parity-');
    parity = await compare(kind, work);
  });

  afterAll(async () => {
    await cleanup(work);
  });

  /**
   * The git target has no remote, so the ownership guard sets it up untracked: a local router,
   * and an edit to `.git/info/exclude` that the comparison has to see.
   */
  test('setup configured it, so there is something to compare', () => {
    const written = Object.keys(parity.bySetup);
    expect(written).toContain('.personal-config.json');
    const expected = kind === 'git' ? ['CLAUDE.local.md', '.git/info/exclude'] : ['CLAUDE.md'];
    for (const path of expected) expect(written).toContain(path);
  });

  test('every file under the target is the same bytes, the record and the stamps included', () => {
    expect(Object.keys(parity.byInit)).toEqual(Object.keys(parity.bySetup));
    for (const [path, bytes] of Object.entries(parity.bySetup)) {
      expect({ path, bytes: parity.byInit[path] }).toEqual({ path, bytes });
    }
  });

  test('`~/.claude` and `config.json` are unchanged', () => {
    expect(Object.keys(parity.homeBefore).some((path) => path.startsWith('.claude/'))).toBe(
      true,
    );
    expect(Object.keys(parity.homeBefore)).toContain(CONFIG);
    expect(global(parity.homeAfter)).toEqual(global(parity.homeBefore));
  });

  /**
   * The one write outside the target is the backup `commitPlan` takes of a target file it
   * overwrites, which is how `undo` keeps working for `init` (D8). `git init` writes a default
   * `.git/info/exclude`, so the git target has one; the plain folder has nothing to back up.
   */
  test('anything else new in the home directory is a backup', () => {
    const added = Object.keys(parity.homeAfter).filter((path) => !(path in parity.homeBefore));
    expect(added.filter((path) => !path.startsWith(BACKUPS))).toEqual([]);
    const changed = Object.keys(parity.homeBefore).filter(
      (path) => parity.homeAfter[path] !== parity.homeBefore[path],
    );
    expect(changed).toEqual([]);
  });
});
