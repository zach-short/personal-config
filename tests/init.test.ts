/**
 * `personal-config init` (init-command Phase 2): its refusals in BD-2's order, a re-run reading the
 * folder's own answers (D5), the person's saved answers outranking the folder's old copy (BD-3),
 * and the track notice (D6, D11).
 *
 * Every run is the real bin in a child process with `HOME` pointed at a temp directory, so the
 * home every path in `src/lib/paths.ts` resolves is one this file made (`X2`), and the target is a
 * temp directory too.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

type Run = { code: number; stdout: string };

async function cli(args: string[], home: string): Promise<Run> {
  const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
    cwd: repoRoot(),
    env: { ...process.env, HOME: home },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = await new Response(proc.stdout).text();
  await new Response(proc.stderr).text();
  return { code: await proc.exited, stdout };
}

/** A home that `setup` has set up once, the precondition every `init` past D3 needs. */
async function setUpHome(): Promise<string> {
  const home = await tempDir('pc-home-');
  const empty = join(home, 'empty-projects');
  await mkdir(empty);
  const ran = await cli(
    ['setup', '--profile', 'starter', '--yes', '--projects-dir', empty],
    home,
  );
  expect(ran.code).toBe(0);
  return home;
}

async function folder(parent: string, name = 'notes'): Promise<string> {
  const dir = join(parent, name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'draft.md'), '# Draft\n');
  return dir;
}

async function gitRepo(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  const proc = Bun.spawn(['git', 'init', '--quiet', path], {
    stdout: 'ignore',
    stderr: 'ignore',
  });
  expect(await proc.exited).toBe(0);
}

async function record(dir: string): Promise<{ answers: Record<string, unknown> }> {
  return (await Bun.file(join(dir, '.personal-config.json')).json()) as {
    answers: Record<string, unknown>;
  };
}

async function setAnswer(dir: string, key: string, value: string): Promise<void> {
  const saved = await record(dir);
  saved.answers[key] = value;
  await Bun.write(join(dir, '.personal-config.json'), `${JSON.stringify(saved, null, 2)}\n`);
}

const NO_SAVED =
  'No saved answers found. Run `personal-config setup` once to set up your machine, then run `personal-config init` in each project.';
const HOME_REFUSAL =
  '`init` does not set up your home directory. Run it inside a project folder.';
const NOTICE = 'your global rules and skills were set up for';

/** A refusal is one line, exit 1, and nothing after it: no question, no preview, no write. */
function refused(run: Run, line: string): void {
  expect(run.code).toBe(1);
  expect(run.stdout.trim()).toBe(line);
}

describe('init refuses before the first question (BD-2)', () => {
  let home: string;
  let work: string;

  beforeAll(async () => {
    home = await setUpHome();
    work = await tempDir('pc-init-');
  });

  afterAll(async () => {
    await cleanup(home);
    await cleanup(work);
  });

  test('--from, which would replace the saved answers with a profile (BD-6)', async () => {
    const dir = await folder(work, 'from');
    refused(
      await cli(['init', dir, '--from', './x.json', '--yes'], home),
      'personal-config: init does not take --from. It sets up one folder with your saved answers.',
    );
  });

  test('--projects-dir, which is `setup`s (BD-6)', async () => {
    const dir = await folder(work, 'projects-flag');
    refused(
      await cli(['init', dir, '--projects-dir', work, '--yes'], home),
      'personal-config: init does not take --projects-dir. It sets up one folder with your saved answers.',
    );
  });

  test('more than one path', async () => {
    const a = await folder(work, 'a');
    const b = await folder(work, 'b');
    refused(
      await cli(['init', a, b, '--yes'], home),
      'personal-config: init sets up one folder, and was given 2 paths.',
    );
  });

  test('a path that is a file, and one that does not exist', async () => {
    const file = join(await folder(work, 'has-file'), 'draft.md');
    refused(
      await cli(['init', file, '--yes'], home),
      `personal-config: ${file} is not a directory.`,
    );
    const gone = join(work, 'missing');
    refused(
      await cli(['init', gone, '--yes'], home),
      `personal-config: ${gone} is not a directory.`,
    );
  });

  test('the home directory, by `~` and by its full path (DIAL-3)', async () => {
    refused(await cli(['init', '~', '--yes'], home), HOME_REFUSAL);
    refused(await cli(['init', home, '--yes'], home), HOME_REFUSAL);
  });

  test('a folder holding two git repos one level down (DIAL-2)', async () => {
    const projects = join(work, 'projects');
    await gitRepo(join(projects, 'one'));
    await gitRepo(join(projects, 'two'));
    refused(
      await cli(['init', projects, '--yes'], home),
      `${projects} holds 2 git repos. \`init\` sets up one project. To set up all of them, run \`personal-config setup --projects-dir ${projects}\`.`,
    );
  });

  test('one git repo one level down is not a projects directory', async () => {
    const parent = await folder(work, 'one-repo');
    await gitRepo(join(parent, 'inner'));
    const run = await cli(['init', parent, '--yes', '--dry-run'], home);
    expect(run.code).toBe(0);
    expect(run.stdout).toContain('--dry-run: nothing was written.');
  });

  test('a machine with no saved config (D3)', async () => {
    const bare = await tempDir('pc-home-');
    try {
      const dir = await folder(work, 'no-config');
      refused(await cli(['init', dir, '--yes'], bare), NO_SAVED);
    } finally {
      await cleanup(bare);
    }
  });

  test('the cheaper refusal wins when two apply', async () => {
    const bare = await tempDir('pc-home-');
    try {
      refused(
        await cli(['init', join(work, 'missing'), '--from', './x.json'], bare),
        'personal-config: init does not take --from. It sets up one folder with your saved answers.',
      );
      refused(await cli(['init', '~', '--yes'], bare), HOME_REFUSAL);
    } finally {
      await cleanup(bare);
    }
  });
});

describe('init in a folder it set up before', () => {
  let home: string;
  let work: string;

  beforeAll(async () => {
    home = await setUpHome();
    work = await tempDir('pc-init-');
  });

  afterAll(async () => {
    await cleanup(home);
    await cleanup(work);
  });

  test('prints no notice when the folder matches the saved track', async () => {
    const dir = await folder(work, 'matching');
    const run = await cli(['init', dir, '--yes'], home);
    expect(run.code).toBe(0);
    expect(run.stdout).not.toContain(NOTICE);
  });

  /** D5: the folder's file is a layer, so its answers are the defaults of the next run. */
  test('a re-run keeps the folder`s own answers, and says when its track differs (D6)', async () => {
    const dir = await folder(work, 'rerun');
    expect((await cli(['init', dir, '--yes'], home)).code).toBe(0);
    await setAnswer(dir, 'workKind', 'non-code');

    const run = await cli(['init', dir, '--yes'], home);
    expect(run.code).toBe(0);
    expect((await record(dir)).answers.workKind).toBe('non-code');
    expect(run.stdout).toContain(
      'This folder is set up as non-code, full, git; your global rules and skills were set up for code, full, git. `init` leaves them as they are. Run `personal-config setup` to change them.',
    );
  });

  /** BD-3: without it, the folder's layer sits above `config.json` and its old copy wins (F4). */
  test('the person`s saved answer wins over the folder`s old copy of it', async () => {
    const dir = await folder(work, 'old-policy');
    expect((await cli(['init', dir, '--yes'], home)).code).toBe(0);
    expect((await record(dir)).answers.commitPolicy).toBe('print-blocks');
    await setAnswer(dir, 'commitPolicy', 'no-rule');

    expect((await cli(['init', dir, '--yes'], home)).code).toBe(0);
    expect((await record(dir)).answers.commitPolicy).toBe('print-blocks');
  });

  test('prints no notice when `config.json` predates the record (D10)', async () => {
    const path = join(home, '.config', 'personal-config', 'config.json');
    const saved = (await Bun.file(path).json()) as Record<string, unknown>;
    const { globalAnswers: _dropped, ...older } = saved;
    await Bun.write(path, `${JSON.stringify(older, null, 2)}\n`);

    const dir = await folder(work, 'older-config');
    expect((await cli(['init', dir, '--yes'], home)).code).toBe(0);
    await setAnswer(dir, 'workKind', 'non-code');
    const run = await cli(['init', dir, '--yes'], home);
    expect(run.code).toBe(0);
    expect(run.stdout).not.toContain(NOTICE);
  });
});
