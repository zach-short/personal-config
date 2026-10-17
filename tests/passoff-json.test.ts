import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cp, mkdir, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PASSOFF_JSON_SCHEMA } from '../src/commands/passoff.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

/**
 * Row 123: `passoff next --json` and `passoff show <n> --json`. The JSON is for the banner hook
 * and wk, which today parse the board themselves, so every test here holds it to the text output
 * from the same run: a field that drifts from what a person reads is the bug this row removes.
 */

const CLI = join(repoRoot(), 'src', 'cli.ts');

const HEADER = '| # | Task | Status | Model | Lane | Waits on | Files it owns |';
const RULE = '|---|------|--------|-------|------|----------|---------------|';
const DONE_ROW = '| 1 | Scaffold it | `DONE - 2026-09-14` | Default | A | — | — |';
const OPEN_ROW =
  '| 2 | Build the `importer` | `OPEN` | Deep | A | — (item 1 done) | `src/import.ts` |';
/** The tail is a `board-status` finding, and the row is still somebody's running item. */
const TAILED_ROW =
  '| 3 | Rewrite the parser | `IN FLIGHT 2026-10-16: GATE 2 passed` | Default | B | — | `src/import.ts`, `src/cli.ts` |';
const BARE_ROW = '| 4 | Write the docs | `OPEN` | Mechanical | C | item 2 | `docs/` |';
const SECTION = ['### 2. Build the importer', '', '*Opened 2026-09-15.*', '', 'Do the thing.'];

const ROW_KEYS = [
  'schema',
  'number',
  'task',
  'status',
  'model',
  'lane',
  'waitsOn',
  'files',
  'itemFile',
  'prompt',
];
const NEXT_KEYS = [...ROW_KEYS, 'alsoOpen', 'nextFree', 'collisions'];

function board(rows: string[], sections: string[] = SECTION): string {
  return ['# PASSOFF', '', HEADER, RULE, ...rows, '', '---', '', ...sections, ''].join('\n');
}

/** `realpath`, because the command names files from `process.cwd()`, which macOS resolves. */
async function repoWith(text: string): Promise<string> {
  const dir = await realpath(await tempDir('pc-passoff-json-'));
  await mkdir(join(dir, '.git'), { recursive: true });
  await writeFile(join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  await writeFile(join(dir, 'PASSOFF.md'), text);
  return dir;
}

async function writeConfig(dir: string, config: Record<string, string>): Promise<void> {
  await writeFile(join(dir, '.personal-config.json'), `${JSON.stringify(config)}\n`);
}

type Ran = { code: number; stdout: string; stderr: string };

async function run(cwd: string, args: string[]): Promise<Ran> {
  const home = await tempDir('pc-home-');
  try {
    const proc = Bun.spawn(['bun', 'run', CLI, 'passoff', ...args], {
      cwd,
      env: { ...process.env, HOME: home },
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    return { code: await proc.exited, stdout, stderr };
  } finally {
    await cleanup(home);
  }
}

/** The whole of stdout is one JSON document, or this throws: nothing else may be printed there. */
async function json(cwd: string, args: string[]): Promise<Record<string, unknown>> {
  const { code, stdout } = await run(cwd, [...args, '--json']);
  expect(code).toBe(0);
  return JSON.parse(stdout);
}

/** The lines the text output prints for a row, rebuilt from the JSON alone. */
function textFrom(row: Record<string, unknown>): string[] {
  const or = (value: unknown) => (value === '' ? '—' : String(value));
  return [
    `item ${row.number} — ${row.task}`,
    `  Model: ${or(row.model)} · Lane: ${or(row.lane)} · Waits on: ${or(row.waitsOn)}`,
    `  Files it owns: ${(row.files as string[]).join(', ') || '—'}`,
  ];
}

describe('passoff next --json on a board with prompt sections', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await repoWith(board([DONE_ROW, OPEN_ROW, TAILED_ROW, BARE_ROW]));
  });
  afterAll(async () => {
    await cleanup(dir);
  });

  test('parses as one object carrying the schema version and every field', async () => {
    const next = await json(dir, ['next']);
    expect(Object.keys(next)).toEqual(NEXT_KEYS);
    expect(next).toMatchObject({
      schema: PASSOFF_JSON_SCHEMA,
      number: '2',
      task: 'Build the `importer`',
      status: 'OPEN',
      files: ['src/import.ts'],
      itemFile: null,
      alsoOpen: ['4'],
      nextFree: null,
    });
  });

  test('every field matches the text output of the same board', async () => {
    const next = await json(dir, ['next']);
    const { stdout } = await run(dir, ['next']);
    for (const line of textFrom(next)) expect(stdout).toContain(line);
    expect(stdout).toContain(String(next.prompt));
    expect(stdout).toContain(`Also open: ${(next.alsoOpen as string[]).join(', ')}.`);
    for (const { number, files } of next.collisions as { number: string; files: string[] }[]) {
      expect(stdout).toContain(
        `Collision: item ${number} is IN FLIGHT and owns ${files.join(', ')} too.`,
      );
    }
  });

  test('a row with a tail after IN FLIGHT still appears in collisions', async () => {
    const next = await json(dir, ['next']);
    expect(next.collisions).toEqual([{ number: '3', files: ['src/import.ts'] }]);
  });
});

describe('passoff show <n>', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await repoWith(board([DONE_ROW, OPEN_ROW, TAILED_ROW, BARE_ROW]));
  });
  afterAll(async () => {
    await cleanup(dir);
  });

  test('--json prints any row, whatever its status, with the status typography stripped', async () => {
    const shown = await json(dir, ['show', '3']);
    expect(Object.keys(shown)).toEqual(ROW_KEYS);
    expect(shown.status).toBe('IN FLIGHT 2026-10-16: GATE 2 passed');
    expect(shown.files).toEqual(['src/import.ts', 'src/cli.ts']);
  });

  test('the text prints the row as next does, and the claim line only for an OPEN row', async () => {
    const shown = await json(dir, ['show', '4']);
    const { stdout } = await run(dir, ['show', '4']);
    for (const line of textFrom(shown)) expect(stdout).toContain(line);
    expect(stdout).toContain('This item waits on: item 2.');
    expect(stdout).toContain('passoff claim 4');
    expect(shown.prompt).toBeNull();
    expect((await run(dir, ['show', '3'])).stdout).not.toContain('passoff claim');
  });

  test('the same row from next and from show is the same object', async () => {
    const next = await json(dir, ['next']);
    const shown = await json(dir, ['show', '2']);
    for (const key of ROW_KEYS) expect(next[key]).toEqual(shown[key]);
  });
});

describe('--json prints nothing else on stdout', () => {
  test('a row that is not there is refused on stderr, with an empty stdout', async () => {
    const dir = await repoWith(board([OPEN_ROW]));
    try {
      const result = await run(dir, ['show', '99', '--json']);
      expect(result).toMatchObject({ code: 1, stdout: '' });
      expect(result.stderr).toContain('No item 99 on the board');
    } finally {
      await cleanup(dir);
    }
  });

  test('a repo with no board is refused on stderr, and so is claim --json', async () => {
    const dir = await realpath(await tempDir('pc-passoff-json-none-'));
    try {
      const missing = await run(dir, ['next', '--json']);
      expect(missing).toMatchObject({ code: 1, stdout: '' });
      expect(missing.stderr).toContain('is not there');
      const claim = await run(dir, ['claim', '1', '--json']);
      expect(claim).toMatchObject({ code: 1, stdout: '' });
    } finally {
      await cleanup(dir);
    }
  });

  test('with nothing open, next keeps its shape and its row fields are null', async () => {
    const dir = await repoWith(board([DONE_ROW, TAILED_ROW]));
    try {
      const next = await json(dir, ['next']);
      expect(Object.keys(next)).toEqual(NEXT_KEYS);
      expect(next).toMatchObject({ number: null, files: [], alsoOpen: [], collisions: [] });
    } finally {
      await cleanup(dir);
    }
  });
});

describe('passoff next --json on a 2.0.0 repo with item files', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await realpath(await tempDir('pc-passoff-json-items-'));
    for (const name of ['PASSOFF.md', 'HANDOFF.md', 'passoff', 'archive']) {
      await cp(join(repoRoot(), 'examples', name), join(dir, name), { recursive: true });
    }
    await mkdir(join(dir, '.git'), { recursive: true });
    await writeFile(join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    await writeConfig(dir, { archiveHome: join(dir, 'archive') });
  });
  afterAll(async () => {
    await cleanup(dir);
  });

  test('itemFile is the item file and prompt is its text, as the text output prints them', async () => {
    const next = await json(dir, ['next']);
    const { stdout } = await run(dir, ['next']);
    expect(next.itemFile).toBe(join(dir, 'passoff', '1-give-the-click-sweep-backpressure.md'));
    expect(stdout).toContain(`From ${next.itemFile}:\n\n${next.prompt}`);
    for (const line of textFrom(next)) expect(stdout).toContain(line);
  });

  test('nextFree is the number the text output gives a new item, past the archived one', async () => {
    const next = await json(dir, ['next']);
    const { stdout } = await run(dir, ['next']);
    expect(next.nextFree).toBe(7);
    expect(stdout).toContain(`A new item takes number ${next.nextFree}:`);
  });

  /** The text warns beside the number; a reader of the JSON would get the number alone. */
  test('nextFree is null when the archive cannot be read, and the warning goes to stderr', async () => {
    await writeConfig(dir, {});
    try {
      const result = await run(dir, ['next', '--json']);
      expect(JSON.parse(result.stdout).nextFree).toBeNull();
      expect(result.stderr).toContain('The archive could not be read');
    } finally {
      await writeConfig(dir, { archiveHome: join(dir, 'archive') });
    }
  });
});
