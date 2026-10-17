import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cp, mkdir, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { latestBackup } from '../src/lib/backup.ts';
import { documentRoot } from '../src/lib/git.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');
const HOOK = join(repoRoot(), 'templates', 'hooks', 'completion-gate.sh');
const BOARD_ROW_1 = /^\| 1 \|[^\n]*`IN FLIGHT`/m;
const ITEM_1 = join('passoff', '1-give-the-click-sweep-backpressure.md');

/** `out` is both streams, as a person reads them; `stdout` alone is what `--json` answers for. */
type Ran = { code: number; out: string; stdout: string };

async function run(
  cwd: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<Ran> {
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
  return { code: await proc.exited, out: out + err, stdout: out };
}

async function git(cwd: string, ...args: string[]): Promise<void> {
  const { code, out } = await run(cwd, [
    'git',
    '-c',
    'user.email=test@example.invalid',
    '-c',
    'user.name=test',
    '-c',
    'protocol.file.allow=always',
    ...args,
  ]);
  if (code !== 0) throw new Error(`git ${args.join(' ')}: ${out}`);
}

/**
 * The fixture: a main checkout holding the worked example's board, ledger and item files
 * untracked, as the owner's global ignore leaves them, and a linked worktree beside it that has
 * none of them. Also a symlink to the worktree, a submodule, and an unrelated repository nested
 * inside the worktree, the three shapes that could resolve to the wrong repository.
 */
type Fixture = { base: string; main: string; worktree: string };

async function linkedWorktree(): Promise<Fixture> {
  const base = await realpath(await tempDir('pc-worktree-'));
  const main = join(base, 'main');
  const worktree = join(base, 'lane');
  await mkdir(join(main, 'src'), { recursive: true });
  await writeFile(join(main, 'src', 'a.ts'), 'export const a = 1;\n');
  await writeFile(
    join(main, '.gitignore'),
    'PASSOFF.md\npassoff/\nHANDOFF.md\n.personal-config.json\n',
  );
  await git(main, 'init', '-q', '--initial-branch=main');
  await git(main, 'add', '.');
  await git(main, 'commit', '-qm', 'init');
  for (const name of ['PASSOFF.md', 'HANDOFF.md', 'passoff']) {
    await cp(join(repoRoot(), 'examples', name), join(main, name), { recursive: true });
  }
  await git(main, 'worktree', 'add', '-q', '-b', 'lane', worktree);
  return { base, main, worktree };
}

let fx: Fixture;
beforeAll(async () => {
  fx = await linkedWorktree();
});
afterAll(async () => {
  await cleanup(fx.base);
});

describe('documentRoot', () => {
  test('a linked worktree, at its top and below it, answers the same path in the main checkout', async () => {
    expect(await documentRoot(fx.worktree)).toBe(fx.main);
    expect(await documentRoot(join(fx.worktree, 'src'))).toBe(join(fx.main, 'src'));
  });

  test('the main checkout and its subdirectories answer themselves, unwalked', async () => {
    expect(await documentRoot(fx.main)).toBe(fx.main);
    expect(await documentRoot(join(fx.main, 'src'))).toBe(join(fx.main, 'src'));
  });

  test('a worktree reached through a symlink still answers the main checkout', async () => {
    const link = join(fx.base, 'lane-link');
    await symlink(fx.worktree, link);
    expect(await documentRoot(link)).toBe(fx.main);
  });

  test('a folder in no repository answers itself', async () => {
    const dir = await tempDir('pc-worktree-plain-');
    try {
      expect(await documentRoot(dir)).toBe(dir);
    } finally {
      await cleanup(dir);
    }
  });

  /**
   * The two that could cross into another repository. A submodule's git dir lives under the
   * superproject's `.git/modules/`, and `git worktree list` names that git dir as its main
   * worktree; a repository nested inside a worktree is under the worktree's path. Each is its own
   * repository and must answer itself.
   */
  test('a submodule and a repository nested inside a worktree each answer themselves', async () => {
    const outside = join(fx.base, 'library');
    await mkdir(outside);
    await git(outside, 'init', '-q', '--initial-branch=main');
    await git(outside, 'commit', '-q', '--allow-empty', '-m', 'init');
    await git(fx.main, 'submodule', 'add', '-q', outside, 'vendor/library');
    expect(await documentRoot(join(fx.main, 'vendor', 'library'))).toBe(
      join(fx.main, 'vendor', 'library'),
    );

    const nested = join(fx.worktree, 'nested');
    await mkdir(nested);
    await git(nested, 'init', '-q', '--initial-branch=main');
    expect(await documentRoot(nested)).toBe(nested);
  });
});

describe('passoff from a linked worktree', () => {
  test('next prints the main checkout board', async () => {
    const { code, out } = await run(fx.worktree, ['bun', 'run', CLI, 'passoff', 'next']);
    expect(code).toBe(0);
    expect(out).toContain('Give the click sweep backpressure');
  });

  /** Row 123: the JSON reads the board `next` and `claim` read, so a reader sees the same rows. */
  test('next --json and show --json read the main checkout board and name its item file', async () => {
    const next = await run(fx.worktree, ['bun', 'run', CLI, 'passoff', 'next', '--json']);
    expect(next.code).toBe(0);
    const row = JSON.parse(next.stdout);
    expect(row.number).toBe('1');
    expect(row.itemFile).toBe(join(fx.main, ITEM_1));

    const shown = await run(fx.worktree, ['bun', 'run', CLI, 'passoff', 'show', '2', '--json']);
    expect(JSON.parse(shown.stdout).task).toBe('Custom short codes, reserved-word list');
  });

  /** Before row 122 this refused: the worktree has no `PASSOFF.md`, untracked as it is. */
  test('claim marks the main checkout board and item file, writes nothing in the worktree, and undo from the worktree restores it', async () => {
    const before = await readFile(join(fx.main, 'PASSOFF.md'), 'utf8');
    const claimed = await run(fx.worktree, [
      'bun',
      'run',
      CLI,
      'passoff',
      'claim',
      '1',
      '--force',
    ]);
    expect(claimed.out).toContain('Claimed item 1');
    expect(await readFile(join(fx.main, 'PASSOFF.md'), 'utf8')).toMatch(BOARD_ROW_1);
    expect(await readFile(join(fx.main, ITEM_1), 'utf8')).toContain('Claimed `IN FLIGHT`');
    expect(await Bun.file(join(fx.worktree, 'PASSOFF.md')).exists()).toBe(false);
    // The run is recorded under the worktree it started in and names the files it wrote.
    const backup = await latestBackup(fx.worktree);
    expect(backup?.manifest.root).toBe(fx.worktree);
    expect(backup?.manifest.entries.map((e) => e.original)).toContain(
      join(fx.main, 'PASSOFF.md'),
    );

    const undone = await run(fx.worktree, ['bun', 'run', CLI, 'undo', '--yes']);
    expect(undone.out).toContain('Restored');
    expect(await readFile(join(fx.main, 'PASSOFF.md'), 'utf8')).toBe(before);
  });
});

describe('handoff and doctor from a linked worktree', () => {
  test('handoff step reads the main checkout ledger and names the worktree branch', async () => {
    const { code, out } = await run(fx.worktree, ['bun', 'run', CLI, 'handoff', 'step']);
    expect(code).toBe(0);
    expect(out).toContain(join(fx.main, 'HANDOFF.md'));
    expect(out).toContain('`lane`');
  });

  test('doctor checks the worktree it was given and then the main checkout', async () => {
    const { out } = await run(fx.worktree, ['bun', 'run', CLI, 'doctor', '.']);
    expect(out).toContain(`\n. — `);
    expect(out).toContain(`\n${fx.main} — `);
  });
});

/** A Stop payload, as the harness sends it. Only `stop_hook_active` is read. */
const STOP = JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: false });

async function stop(cwd: string, env: Record<string, string> = {}): Promise<Ran> {
  const proc = Bun.spawn(['bash', HOOK], {
    cwd,
    env: { ...process.env, ...env },
    stdin: new TextEncoder().encode(STOP),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, out: out + err, stdout: out };
}

async function withGate(command: string): Promise<void> {
  await writeFile(
    join(fx.main, '.personal-config.json'),
    `${JSON.stringify({ gateCommand: command }, null, 2)}\n`,
  );
}

async function gateLog(cwd = fx.worktree): Promise<string[]> {
  const path = join(
    process.env.HOME ?? '',
    '.config',
    'personal-config',
    'completion-gate.log',
  );
  const text = await readFile(path, 'utf8').catch(() => '');
  return text.split('\n').filter((line) => line.includes(`cwd=${cwd} `));
}

/** Each test writes the main checkout's config, so they run one after another. */
describe('the completion gate from a linked worktree', () => {
  test('reads the main checkout config, runs the gate in the worktree, and logs both', async () => {
    await withGate('touch gate-ran');
    const { code } = await stop(fx.worktree);
    expect(code).toBe(0);
    expect(await Bun.file(join(fx.worktree, 'gate-ran')).exists()).toBe(true);
    expect(await Bun.file(join(fx.main, 'gate-ran')).exists()).toBe(false);
    const last = (await gateLog()).at(-1) ?? '';
    expect(last).toContain(`config=${join(fx.main, '.personal-config.json')}`);
    expect(last).toContain('gate=touch gate-ran result=pass');
  });

  test('a command with an escaped quote blocks with a message instead of running short', async () => {
    await withGate('echo "x"');
    const { code, out } = await stop(fx.worktree);
    expect(code).toBe(2);
    expect(out).toContain('could not be read');
    expect((await gateLog()).at(-1)).toContain('gate=unreadable');
  });

  test('a gate that outlives its limit blocks and says so', async () => {
    await withGate('sleep 20');
    const start = Date.now();
    const { code, out } = await stop(fx.worktree, { PERSONAL_CONFIG_GATE_TIMEOUT: '1' });
    expect(code).toBe(2);
    expect(out).toContain('did not finish in 1 seconds');
    expect(Date.now() - start).toBeLessThan(10_000);
    expect((await gateLog()).at(-1)).toContain('result=timeout');
  });

  test('a failing gate blocks and the log records the exit', async () => {
    await withGate('exit 3');
    const { code } = await stop(fx.worktree);
    expect(code).toBe(2);
    expect((await gateLog()).at(-1)).toContain('result=fail exit=3');
  });
});

/**
 * The cases the row 122 review found resolving to the wrong folder, each now answering the folder
 * it was asked about or the right main checkout.
 */
describe('what the review found', () => {
  /**
   * A git dir made by `--separate-git-dir=<x>/.git` round-trips to `<x>`, a folder holding
   * another config and no checkout. The worktree must answer itself, in both resolvers.
   */
  test('a separate git dir named .git does not send a worktree to the folder holding it', async () => {
    const elsewhere = join(fx.base, 'elsewhere');
    const sepMain = join(fx.base, 'sep-main');
    const sepLane = join(fx.base, 'sep-lane');
    await mkdir(elsewhere);
    await writeFile(join(elsewhere, '.personal-config.json'), '{ "gateCommand": "exit 9" }\n');
    await git(fx.base, 'init', '-q', `--separate-git-dir=${join(elsewhere, '.git')}`, sepMain);
    await writeFile(join(sepMain, 'f'), 'x\n');
    await git(sepMain, 'add', 'f');
    await git(sepMain, 'commit', '-qm', 'init');
    await git(sepMain, 'worktree', 'add', '-q', sepLane);

    expect(await documentRoot(sepLane)).toBe(sepLane);
    const { code } = await stop(sepLane);
    expect(code).toBe(0);
    expect((await gateLog(sepLane)).at(-1)).toContain(
      `looked=${join(sepLane, '.personal-config.json')}`,
    );
  });

  test('GIT_COMMON_DIR in the environment does not choose the repository', async () => {
    const other = join(fx.base, 'other');
    await mkdir(other);
    await git(other, 'init', '-q', '--initial-branch=main');
    const saved = process.env.GIT_COMMON_DIR;
    process.env.GIT_COMMON_DIR = join(other, '.git');
    try {
      expect(await documentRoot(fx.worktree)).toBe(fx.main);
      expect(await documentRoot(fx.main)).toBe(fx.main);
    } finally {
      if (saved === undefined) delete process.env.GIT_COMMON_DIR;
      else process.env.GIT_COMMON_DIR = saved;
    }
  });

  /**
   * A repository that commits its board gives every worktree its own copy, carried by the
   * worktree's branch. The claim marks that copy; the main checkout's is left as it was.
   */
  test('a worktree carrying its own committed board claims on it, not on the main checkout', async () => {
    const main = join(fx.base, 'tracked-main');
    const lane = join(fx.base, 'tracked-lane');
    await mkdir(main);
    for (const name of ['PASSOFF.md', 'passoff']) {
      await cp(join(repoRoot(), 'examples', name), join(main, name), { recursive: true });
    }
    await writeFile(join(main, '.gitignore'), '.personal-config.json\n');
    await git(main, 'init', '-q', '--initial-branch=main');
    await git(main, 'add', '.');
    await git(main, 'commit', '-qm', 'init');
    await writeFile(join(main, '.personal-config.json'), '{ "trackMode": "tracked" }\n');
    await git(main, 'worktree', 'add', '-q', '-b', 'lane', lane);
    const before = await readFile(join(main, 'PASSOFF.md'), 'utf8');

    const claimed = await run(lane, ['bun', 'run', CLI, 'passoff', 'claim', '1', '--force']);
    expect(claimed.out).toContain('Claimed item 1');
    expect(await readFile(join(lane, 'PASSOFF.md'), 'utf8')).toMatch(BOARD_ROW_1);
    expect(await readFile(join(lane, ITEM_1), 'utf8')).toContain('Claimed `IN FLIGHT`');
    expect(await readFile(join(main, 'PASSOFF.md'), 'utf8')).toBe(before);

    const shown = await run(lane, ['bun', 'run', CLI, 'passoff', 'show', '1', '--json']);
    const row = JSON.parse(shown.stdout);
    expect(row.status).toBe('IN FLIGHT');
    expect(row.itemFile).toBe(join(lane, ITEM_1));
  });

  test('a config with two gateCommand lines runs the first and still blocks or passes', async () => {
    await writeFile(
      join(fx.main, '.personal-config.json'),
      '{\n  "gateCommand": "exit 0",\n  "gateCommand": "exit 7"\n}\n',
    );
    expect((await stop(fx.worktree)).code).toBe(0);
    expect((await gateLog()).at(-1)).toContain('gate=exit 0 result=pass');
  });

  test('a limit of 0 is read as unset, not as a block on every stop', async () => {
    await withGate('exit 0');
    expect((await stop(fx.worktree, { PERSONAL_CONFIG_GATE_TIMEOUT: '0' })).code).toBe(0);
  });
});
