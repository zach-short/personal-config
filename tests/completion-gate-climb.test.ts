/**
 * The completion gate climbs to the nearest `.personal-config.json` (gate-contract scope, A1,
 * 2026-10-18). Until then `config_dir` answered the one folder the stop happened in, so a stop in
 * `docs/bench` looked for `<main>/docs/bench/.personal-config.json`, found nothing and skipped the
 * gate: 83 lines of one repo's log. The first four tests are that defect and its edges; the rest
 * pin each guard `config_dir` already had, because the climb walks further than the old lookup
 * did, and a guard that stops holding now reaches a config instead of a missing file.
 *
 * Each test builds its own repositories under its own folder and runs the hook with a `HOME` of
 * its own, so the log it reads holds only its own lines and the real log is never touched.
 * Paths go through `realpath` because git prints top levels with symlinks resolved, and macOS's
 * temporary folders sit behind one.
 */
import { describe, expect, test } from 'bun:test';
import { chmod, mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const HOOK = join(repoRoot(), 'templates', 'hooks', 'completion-gate.sh');
const STOP = JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: false });
const CONFIG = '.personal-config.json';
const BLOCKED = 2;
const ALLOWED = 0;
/** A gate no test expects to run: reaching it blocks, so a wrong config fails loudly. */
const WRONG = 'exit 9';

type Ran = { code: number; out: string };

async function spawn(cwd: string, args: string[], env: Record<string, string>): Promise<Ran> {
  const proc = Bun.spawn(args, {
    cwd,
    env: { ...process.env, ...env },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, out: out + err };
}

async function git(cwd: string, ...args: string[]): Promise<void> {
  const { code, out } = await spawn(
    cwd,
    [
      'git',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'user.name=test',
      '-c',
      'protocol.file.allow=always',
      ...args,
    ],
    {},
  );
  if (code !== 0) throw new Error(`git ${args.join(' ')}: ${out}`);
}

/** One folder per test: `home` for the log, `base` for every repository the test makes. */
type Scene = { base: string; home: string };

async function scene(run: (s: Scene) => Promise<void>): Promise<void> {
  const root = await realpath(await tempDir('pc-gate-climb-'));
  const s = { base: join(root, 'repos'), home: join(root, 'home') };
  await mkdir(s.base);
  await mkdir(s.home);
  try {
    await run(s);
  } finally {
    await cleanup(root);
  }
}

/** A repository with `docs/bench` tracked and the config ignored, as the owner's checkouts are. */
async function repo(dir: string): Promise<string> {
  await mkdir(join(dir, 'docs', 'bench'), { recursive: true });
  await writeFile(join(dir, 'docs', 'bench', 'keep.txt'), 'x\n');
  await writeFile(join(dir, 'root-marker'), 'x\n');
  await writeFile(join(dir, 'docs', 'docs-marker'), 'x\n');
  await writeFile(join(dir, '.gitignore'), `${CONFIG}\ngate-ran\n`);
  await git(dir, 'init', '-q', '--initial-branch=main');
  await git(dir, 'add', '.');
  await git(dir, 'commit', '-qm', 'init');
  return dir;
}

/** A main checkout at `<base>/main` and a linked worktree of it at `<base>/lane`. */
async function linked(base: string): Promise<{ main: string; lane: string }> {
  const main = await repo(join(base, 'main'));
  const lane = join(base, 'lane');
  await git(main, 'worktree', 'add', '-q', '-b', 'lane', lane);
  return { main, lane };
}

async function withGate(dir: string, command: string): Promise<void> {
  await writeFile(join(dir, CONFIG), `${JSON.stringify({ gateCommand: command }, null, 2)}\n`);
}

/** The hook with a Stop payload on stdin and the scene's `HOME`, so the log it writes is the scene's. */
async function fire(s: Scene, cwd: string, env: Record<string, string> = {}): Promise<Ran> {
  const proc = Bun.spawn(['bash', HOOK], {
    cwd,
    env: { ...process.env, HOME: s.home, ...env },
    stdin: new TextEncoder().encode(STOP),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, out: out + err };
}

async function lastLog(s: Scene, cwd: string): Promise<string> {
  const path = join(s.home, '.config', 'personal-config', 'completion-gate.log');
  const text = await readFile(path, 'utf8').catch(() => '');
  return (
    text
      .split('\n')
      .filter((line) => line.includes(`cwd=${cwd} `))
      .at(-1) ?? ''
  );
}

function found(dir: string): string {
  return `config=${join(dir, CONFIG)} `;
}

function ran(dir: string): string {
  return `result=pass ran=${dir}`;
}

function none(dir: string): string {
  return `config=none looked=${join(dir, CONFIG)}`;
}

describe('a stop below the top of a checkout finds the nearest config', () => {
  test('violates: a stop in a subfolder of the main checkout runs the root config', async () => {
    await scene(async (s) => {
      const main = await repo(join(s.base, 'main'));
      const bench = join(main, 'docs', 'bench');
      await withGate(main, 'touch gate-ran');
      expect((await fire(s, bench)).code).toBe(ALLOWED);
      expect(await Bun.file(join(main, 'gate-ran')).exists()).toBe(true);
      expect(await Bun.file(join(bench, 'gate-ran')).exists()).toBe(false);
      const line = await lastLog(s, bench);
      expect(line).toContain(found(main));
      expect(line).toContain(`gate=touch gate-ran ${ran(main)}`);
    });
  });

  test("violates: a stop in a subfolder of a linked worktree runs the main checkout's config", async () => {
    await scene(async (s) => {
      const { main, lane } = await linked(s.base);
      const bench = join(lane, 'docs', 'bench');
      await withGate(main, 'touch gate-ran');
      expect((await fire(s, bench)).code).toBe(ALLOWED);
      expect(await Bun.file(join(lane, 'gate-ran')).exists()).toBe(true);
      expect(await Bun.file(join(bench, 'gate-ran')).exists()).toBe(false);
      expect(await Bun.file(join(main, 'gate-ran')).exists()).toBe(false);
      const line = await lastLog(s, bench);
      expect(line).toContain(found(main));
      expect(line).toContain(ran(lane));
    });
  });

  test('violates: a nearer config wins over the root one, from the main checkout and a worktree', async () => {
    await scene(async (s) => {
      const { main, lane } = await linked(s.base);
      await withGate(main, WRONG);
      await withGate(join(main, 'docs'), 'touch gate-ran');
      for (const top of [main, lane]) {
        const bench = join(top, 'docs', 'bench');
        expect((await fire(s, bench)).code).toBe(ALLOWED);
        const line = await lastLog(s, bench);
        expect(line).toContain(found(join(main, 'docs')));
        expect(line).toContain(ran(join(top, 'docs')));
        expect(await Bun.file(join(top, 'docs', 'gate-ran')).exists()).toBe(true);
      }
    });
  });

  /**
   * The ceiling. A config in the folder holding the checkouts is above every git top level here,
   * so no stop may reach it, and the log names the folder the stop happened in, as it always did.
   */
  test('passes: no config on the path is a silent exit 0, and the climb stops at the top level', async () => {
    await scene(async (s) => {
      const { main, lane } = await linked(s.base);
      await withGate(s.base, WRONG);
      const fromMain = join(main, 'docs', 'bench');
      const fromLane = join(lane, 'docs', 'bench');
      const ranMain = await fire(s, fromMain);
      expect(ranMain.code).toBe(ALLOWED);
      expect(ranMain.out).toBe('');
      expect(await lastLog(s, fromMain)).toContain(none(fromMain));
      expect((await fire(s, fromLane)).code).toBe(ALLOWED);
      expect(await lastLog(s, fromLane)).toContain(none(join(main, 'docs', 'bench')));
    });
  });
});

/**
 * The gate runs in the folder its config came from (gate-contract review, 2026-10-18). A gate is
 * written for that folder: `go vet ./...` run from `docs` matched no packages and blocked a green
 * tree, and a script path relative to the root is not found from below it. Each gate here is a
 * relative test that passes only in the right folder, and each stop is in a subfolder.
 */
describe('the gate runs in the folder its config came from, in this checkout', () => {
  test('violates: a relative root gate passes from a subfolder of the main checkout', async () => {
    await scene(async (s) => {
      const main = await repo(join(s.base, 'main'));
      await withGate(main, 'test -f root-marker');
      const bench = join(main, 'docs', 'bench');
      expect((await fire(s, bench)).code).toBe(ALLOWED);
      expect(await lastLog(s, bench)).toContain(ran(main));
    });
  });

  /** The marker is untracked and only in the worktree, so a run in the main checkout fails it. */
  test("violates: from a worktree subfolder the root gate proves the worktree's own root", async () => {
    await scene(async (s) => {
      const { main, lane } = await linked(s.base);
      await writeFile(join(lane, 'lane-marker'), 'x\n');
      await withGate(main, 'test -f lane-marker');
      const bench = join(lane, 'docs', 'bench');
      expect((await fire(s, bench)).code).toBe(ALLOWED);
      expect(await lastLog(s, bench)).toContain(ran(lane));
    });
  });

  test('violates: a nearer config runs its gate in its own folder', async () => {
    await scene(async (s) => {
      const { main, lane } = await linked(s.base);
      await withGate(main, WRONG);
      await withGate(join(main, 'docs'), 'test -f docs-marker');
      for (const top of [main, lane]) {
        const bench = join(top, 'docs', 'bench');
        expect((await fire(s, bench)).code).toBe(ALLOWED);
        expect(await lastLog(s, bench)).toContain(ran(join(top, 'docs')));
      }
    });
  });

  /**
   * The config's folder always has a copy in the worktree when git reports the prefix it should,
   * because it is an ancestor of the stop. A shim reports a prefix the worktree does not have, so
   * the fallback to the worktree's top level is exercised at all.
   */
  test("violates: a config folder the worktree lacks runs the gate at the worktree's top", async () => {
    await scene(async (s) => {
      const { main, lane } = await linked(s.base);
      await mkdir(join(main, 'gone'));
      await withGate(join(main, 'gone'), 'test -f root-marker');
      const bin = join(s.base, 'bin');
      await mkdir(bin);
      const shim = join(bin, 'git');
      await writeFile(
        shim,
        [
          '#!/bin/sh',
          'if [ "$1 $2" = "rev-parse --show-prefix" ]; then echo gone/sub/; exit 0; fi',
          `exec ${Bun.which('git')} "$@"`,
          '',
        ].join('\n'),
      );
      await chmod(shim, 0o755);
      const bench = join(lane, 'docs', 'bench');
      const env = { PATH: `${bin}:${process.env.PATH ?? ''}` };
      expect((await fire(s, bench, env)).code).toBe(ALLOWED);
      const line = await lastLog(s, bench);
      expect(line).toContain(found(join(main, 'gone')));
      expect(line).toContain(ran(lane));
    });
  });
});

describe('every guard in config_dir holds under the climb', () => {
  /** Without the `unset`, git takes `other` as the common dir from any folder and maps there. */
  test('passes: GIT_COMMON_DIR in the environment does not choose the repository', async () => {
    await scene(async (s) => {
      const { main, lane } = await linked(s.base);
      const other = await repo(join(s.base, 'other'));
      await withGate(other, WRONG);
      await withGate(main, 'exit 0');
      const env = { GIT_COMMON_DIR: join(other, '.git') };
      for (const bench of [join(main, 'docs', 'bench'), join(lane, 'docs', 'bench')]) {
        expect((await fire(s, bench, env)).code).toBe(ALLOWED);
        expect(await lastLog(s, bench)).toContain(found(main));
      }
    });
  });

  /**
   * `--separate-git-dir=<x>/.git` round-trips to `<x>`, which holds no checkout. From a subfolder
   * the climb would reach `<x>`'s own config, so the deleted-files check has to stop it there.
   */
  test('passes: a separate git dir does not send a subfolder stop to the folder holding it', async () => {
    await scene(async (s) => {
      const elsewhere = join(s.base, 'elsewhere');
      const sepMain = join(s.base, 'sep-main');
      const sepLane = join(s.base, 'sep-lane');
      await mkdir(elsewhere);
      await withGate(elsewhere, WRONG);
      await git(s.base, 'init', '-q', `--separate-git-dir=${join(elsewhere, '.git')}`, sepMain);
      await mkdir(join(sepMain, 'sub'));
      await writeFile(join(sepMain, 'sub', 'f'), 'x\n');
      await git(sepMain, 'add', '.');
      await git(sepMain, 'commit', '-qm', 'init');
      await git(sepMain, 'worktree', 'add', '-q', sepLane);
      const sub = join(sepLane, 'sub');
      expect((await fire(s, sub)).code).toBe(ALLOWED);
      expect(await lastLog(s, sub)).toContain(none(sub));
    });
  });

  /**
   * Two bare shapes. A plain `bare.git` has no `.git` suffix and no `core.worktree`, so it names
   * no main checkout. One named `proj/.git` maps to `proj`, where git agrees on the git dir but
   * has no work tree to name, so the top-level check refuses it.
   */
  test('passes: a worktree of a bare repository climbs only its own tree', async () => {
    await scene(async (s) => {
      const seed = await repo(join(s.base, 'seed'));
      const plain = join(s.base, 'bare.git');
      const proj = join(s.base, 'proj');
      await git(s.base, 'clone', '-q', '--bare', seed, plain);
      await git(s.base, 'clone', '-q', '--bare', seed, join(proj, '.git'));
      await withGate(s.base, WRONG);
      await withGate(plain, WRONG);
      await withGate(proj, WRONG);
      for (const [bare, name] of [
        [plain, 'plain-lane'],
        [join(proj, '.git'), 'proj-lane'],
      ] as const) {
        const lane = join(s.base, name);
        await git(bare, 'worktree', 'add', '-q', lane, 'main');
        const bench = join(lane, 'docs', 'bench');
        expect((await fire(s, bench)).code).toBe(ALLOWED);
        expect(await lastLog(s, bench)).toContain(none(bench));
        await withGate(lane, 'exit 0');
        expect((await fire(s, bench)).code).toBe(ALLOWED);
        expect(await lastLog(s, bench)).toContain(found(lane));
      }
    });
  });

  /**
   * A bare repository whose `core.worktree` names an unrelated checkout maps there, and only the
   * git-dir half of the round trip refuses it: that checkout is a repository of its own, its top
   * level agrees and none of its files are missing.
   */
  test('passes: a core.worktree naming another repository is never mapped', async () => {
    await scene(async (s) => {
      const seed = await repo(join(s.base, 'seed'));
      const other = await repo(join(s.base, 'other'));
      const bare = join(s.base, 'bare.git');
      const lane = join(s.base, 'lane');
      await git(s.base, 'clone', '-q', '--bare', seed, bare);
      await git(bare, 'worktree', 'add', '-q', lane, 'main');
      await git(bare, 'config', 'core.worktree', other);
      await withGate(other, WRONG);
      const bench = join(lane, 'docs', 'bench');
      expect((await fire(s, bench)).code).toBe(ALLOWED);
      expect(await lastLog(s, bench)).toContain(none(bench));
    });
  });

  /**
   * `core.worktree` moves the main checkout's work tree elsewhere, so git, asked from `main`,
   * names another top level, and the folder is not trusted. A main checkout moved away leaves the
   * worktree's git broken, and a stop there is not climbed at all.
   */
  test('passes: a main checkout git disagrees with, or one moved away, is never mapped', async () => {
    await scene(async (s) => {
      const { main, lane } = await linked(s.base);
      const real = join(s.base, 'real');
      await mkdir(real);
      await git(main, 'config', 'core.worktree', real);
      await withGate(main, WRONG);
      const bench = join(lane, 'docs', 'bench');
      expect((await fire(s, bench)).code).toBe(ALLOWED);
      expect(await lastLog(s, bench)).toContain(none(bench));

      await git(main, 'config', '--unset', 'core.worktree');
      await rename(main, join(s.base, 'moved'));
      await mkdir(main);
      await withGate(main, WRONG);
      await withGate(lane, WRONG);
      expect((await fire(s, bench)).code).toBe(ALLOWED);
      expect(await lastLog(s, bench)).toContain(none(bench));
    });
  });

  /** Each is its own repository, so its top level is where the climb ends. */
  test('passes: a submodule and a nested repository never reach the config around them', async () => {
    await scene(async (s) => {
      const { main, lane } = await linked(s.base);
      const library = await repo(join(s.base, 'library'));
      await git(main, 'submodule', 'add', '-q', library, 'vendor/library');
      await withGate(main, WRONG);
      for (const outer of [main, lane]) {
        const nested = join(outer, 'nested');
        await mkdir(join(nested, 'sub'), { recursive: true });
        await git(nested, 'init', '-q', '--initial-branch=main');
      }
      for (const dir of [
        join(main, 'vendor', 'library', 'docs', 'bench'),
        join(main, 'nested', 'sub'),
        join(lane, 'nested', 'sub'),
      ]) {
        expect((await fire(s, dir)).code).toBe(ALLOWED);
        expect(await lastLog(s, dir)).toContain(none(dir));
      }
    });
  });

  /**
   * A git older than 2.31 refuses `--path-format`, and a git that answers with a relative path
   * cannot be placed. Either way the folder is checked alone and not climbed. A shim stands in for
   * both, because the installed git is neither.
   */
  test('passes: a git that cannot give absolute paths is not climbed', async () => {
    await scene(async (s) => {
      const main = await repo(join(s.base, 'main'));
      await withGate(main, WRONG);
      const bin = join(s.base, 'bin');
      await mkdir(bin);
      const shim = join(bin, 'git');
      await writeFile(
        shim,
        [
          '#!/bin/sh',
          'for a in "$@"; do',
          '  if [ "$a" = --path-format=absolute ]; then',
          '    [ "$SHIM" = old ] && exit 129',
          '    echo .git; exit 0',
          '  fi',
          'done',
          `exec ${Bun.which('git')} "$@"`,
          '',
        ].join('\n'),
      );
      await chmod(shim, 0o755);
      const bench = join(main, 'docs', 'bench');
      for (const mode of ['old', 'relative']) {
        const env = { PATH: `${bin}:${process.env.PATH ?? ''}`, SHIM: mode };
        expect((await fire(s, bench, env)).code).toBe(ALLOWED);
        expect(await lastLog(s, bench)).toContain(none(bench));
      }
      // The same tree with the real git climbs and blocks, so the shim is what kept it out.
      expect((await fire(s, bench)).code).toBe(BLOCKED);
    });
  });
});
