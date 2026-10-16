import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseBoard } from '../src/lib/board.ts';
import { migrateFold } from '../src/lib/fold.ts';
import { ledgerSteps } from '../src/lib/ledger.ts';
import { logLines } from '../src/lib/log.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

/**
 * `fold migrate` (per-item-board `DESIGN.md` D5): the one command that rewrites a live board and
 * ledger wholesale. The hazard is text the migration loses or misplaces, which no gate sees in an
 * untracked file, so each case below reads the text back where it should have landed.
 */

const CLI = join(repoRoot(), 'src', 'cli.ts');
const SPAWN_TIMEOUT = 30_000;
const DATE = '2026-10-15';

/** Item 5 carries a nested `#### SCOPE`, the case `headingBlock` exists for; 1.5 is decimal. */
const BOARD = `# Board

Status vocabulary: \`OPEN\` · \`DONE — HANDOFF n\`.

| # | Task | Status | Model | Lane | Waits on | Files it owns |
|---|------|--------|-------|------|----------|---------------|
| 1 | Write the first thing | \`DONE — HANDOFF 1\` | Opus | A | — | a.ts |
| 1.5 | Patch the first thing | \`OPEN\` | Opus | A | item 1 | a.ts |
| 5 | Build the scoped thing | \`HELD\` | Opus | B | — | b.ts |
| 6 | Nothing written yet | \`OPEN\` | Opus | B | — | c.ts |

---

### 1. Write the first thing

The first prompt.

---

### 1.5. Patch the first thing

The decimal prompt.

---

### 5. Build the scoped thing

The scoped prompt.

#### SCOPE — written 2026-10-01

The scope, which must stay with item 5.

---
`;

const BOLD_LEDGER = `# Ledger

## Orientation

Read this.

## Step log

Next free number: read the file.

**1. Built the first thing.** Done 2026-10-01.

Body of one.

**2. Patched it.** Done 2026-10-02.

Body of two.

## Style rules

Keep this.
`;

const LIST_LEDGER = `# Ledger

## Step log

1. **Built the first thing.** Done 2026-10-01.

   Body of one.

2. **Patched it.** Done 2026-10-02.

   Body of two.

## Style rules

Keep this.
`;

describe('migrateFold, the board', () => {
  const migration = migrateFold(BOARD, BOLD_LEDGER, DATE, 'HANDOFF.md');

  test('a `DONE` section goes to the closed archive, whole', () => {
    expect(migration.closed.map((block) => block.id)).toEqual(['1']);
    expect(migration.closed[0]?.text).toContain('The first prompt.');
  });

  test('each other section becomes its own file, named by D7 and headed `# <n>.`', () => {
    expect(migration.items.map((item) => item.name)).toEqual([
      '1.5-patch-the-first-thing.md',
      '5-build-the-scoped-thing.md',
    ]);
    expect(migration.items[0]?.text).toBe(
      '# 1.5. Patch the first thing\n\nThe decimal prompt.\n',
    );
  });

  test('a nested `#### SCOPE` stays inside its item and leaves nothing on the board', () => {
    const five = migration.items.find((item) => item.number === '5')?.text ?? '';
    expect(five).toContain(
      '#### SCOPE — written 2026-10-01\n\nThe scope, which must stay with item 5.',
    );
    expect(migration.board).not.toContain('SCOPE');
  });

  test('the board keeps its header and its table, every row, and nothing below', () => {
    expect(parseBoard(migration.board)?.rows.map((row) => row.number)).toEqual([
      '1',
      '1.5',
      '5',
      '6',
    ]);
    expect(migration.board).toContain('Status vocabulary');
    expect(migration.board).not.toMatch(/^###/m);
    expect(migration.board.endsWith('|\n')).toBe(true);
  });

  test('two sections with one number refuse, and nothing is cut', () => {
    const twice = `${BOARD}\n### 5. Build it again\n\nA second copy.\n`;
    const refused = migrateFold(twice, BOLD_LEDGER, DATE, 'HANDOFF.md');
    expect(refused.problems).toEqual(['the board has two sections for item 5']);
    expect(refused.board).toBe(twice);
    expect(refused.items).toEqual([]);
  });

  test("a row with no section never takes a decimal sibling's section", () => {
    const board = BOARD.replace('| 6 | Nothing written yet |', '| 1.5 | Nothing written yet |')
      .replace('| 1.5 | Patch the first thing |', '| 6 | Patch the first thing |')
      .replace('### 1. Write the first thing\n\nThe first prompt.\n\n---\n\n', '');
    const result = migrateFold(board, BOLD_LEDGER, DATE, 'HANDOFF.md');
    expect(result.closed).toEqual([]);
    expect(result.items.map((item) => item.number)).toEqual(['5', '1.5']);
    expect(result.items[1]?.text).toContain('The decimal prompt.');
  });

  test('a section no row names is left on the board and reported', () => {
    const extra = `${BOARD}\n### 9. An orphan\n\nNo row.\n`;
    const result = migrateFold(extra, BOLD_LEDGER, DATE, 'HANDOFF.md');
    expect(result.unrowed).toEqual(['9']);
    expect(result.board).toContain('### 9. An orphan');
  });
});

describe('migrateFold, the ledger', () => {
  for (const [form, ledger] of [
    ['bold', BOLD_LEDGER],
    ['list', LIST_LEDGER],
  ] as const) {
    test(`a ${form}-form log goes whole to the archive and leaves one frozen line`, () => {
      const result = migrateFold(BOARD, ledger, DATE, 'HANDOFF.md');
      expect(result.problems).toEqual([]);
      expect(result.frozenAt).toBe(2);
      for (const line of ledger.split('\n').filter((text) => /Body|Done/.test(text))) {
        expect(result.log?.text).toContain(line);
      }
      expect(ledgerSteps(result.ledger)).toEqual([]);
      expect(logLines(result.ledger).map((line) => line.text)).toEqual([
        `- ${DATE} · log frozen at step 2 · HANDOFF-log.md in the archive`,
      ]);
    });

    test(`a ${form}-form ledger keeps Style rules after the log`, () => {
      const result = migrateFold(BOARD, ledger, DATE, 'HANDOFF.md');
      expect(result.ledger).toMatch(/## Log\n\n- .*\n\n## Style rules\n\nKeep this.\n$/);
    });
  }

  test('the standing sections above the log are untouched', () => {
    const result = migrateFold(BOARD, BOLD_LEDGER, DATE, 'HANDOFF.md');
    expect(
      result.ledger.startsWith('# Ledger\n\n## Orientation\n\nRead this.\n\n## Log\n'),
    ).toBe(true);
  });

  test('a `###` standing section after the last step stays in the ledger', () => {
    const ledger = BOLD_LEDGER.replace(
      '## Style rules',
      '### Open questions\n\nOne.\n\n## Style rules',
    );
    const result = migrateFold(BOARD, ledger, DATE, 'HANDOFF.md');
    expect(result.ledger).toContain('### Open questions\n\nOne.');
    expect(result.log?.text).not.toContain('Open questions');
  });

  test('a log split by a standing section refuses rather than guess', () => {
    const split = BOLD_LEDGER.replace(
      '**2. Patched',
      '## Known facts\n\nA fact.\n\n**2. Patched',
    );
    const result = migrateFold(BOARD, split, DATE, 'HANDOFF.md');
    expect(result.problems).toEqual(['the step log is split by `## Known facts` at line 15']);
    expect(result.ledger).toBe(split);
  });
});

async function run(cwd: string, args: string[], home: string) {
  const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
    cwd,
    env: { ...process.env, HOME: home },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (stderr !== '') throw new Error(`stderr: ${stderr}`);
  return { code, stdout };
}

const CONFIG = (archive: string) =>
  `${JSON.stringify({ ledgerFile: 'HANDOFF.md', boardFile: 'PASSOFF.md', archiveHome: archive }, null, 2)}\n`;

async function legacyRepo() {
  const parent = await tempDir('pc-migrate-');
  const dir = join(parent, 'repo');
  const archive = join(parent, 'archive');
  const home = join(parent, 'home');
  await Bun.write(join(dir, 'PASSOFF.md'), BOARD);
  await Bun.write(join(dir, 'HANDOFF.md'), BOLD_LEDGER);
  await Bun.write(join(dir, '.personal-config.json'), CONFIG(archive));
  await Bun.write(join(archive, 'INDEX.md'), '# archive — index\n\n## Closed\n');
  await Bun.write(join(home, '.keep'), '');
  return { dir, archive, home, done: () => cleanup(parent) };
}

const read = (path: string) => readFile(path, 'utf8');

describe('fold migrate, end to end', () => {
  test(
    'archives, writes the item files, cuts both documents and writes the two keys',
    async () => {
      const repo = await legacyRepo();
      try {
        const { code } = await run(repo.dir, ['fold', 'migrate', '--force'], repo.home);
        expect(code).toBe(0);

        // `readdir` order is the filesystem's: sorted on macOS, not on Linux (CI).
        expect((await readdir(join(repo.dir, 'passoff'))).sort()).toEqual([
          '1.5-patch-the-first-thing.md',
          '5-build-the-scoped-thing.md',
        ]);
        expect(await read(join(repo.archive, 'HANDOFF-log.md'))).toContain('Body of two.');
        expect(await read(join(repo.archive, 'PASSOFF-closed.md'))).toContain(
          'The first prompt.',
        );

        const index = await read(join(repo.archive, 'INDEX.md'));
        expect(index).toContain('**HANDOFF-log.md**');
        expect(index).toContain('**PASSOFF-closed.md**');

        const config = JSON.parse(await read(join(repo.dir, '.personal-config.json')));
        expect(config).toMatchObject({ itemsDir: 'passoff', ledgerFrozenAt: 2 });
        expect(await read(join(repo.dir, 'PASSOFF.md'))).not.toContain('###');
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'the archive header counts the steps frozen, not the one block they travel in',
    async () => {
      const repo = await legacyRepo();
      try {
        const three = BOLD_LEDGER.replace(
          '## Style rules',
          '**3. Finished it.** Done 2026-10-03.\n\nBody of three.\n\n## Style rules',
        );
        await Bun.write(join(repo.dir, 'HANDOFF.md'), three);
        const { code } = await run(repo.dir, ['fold', 'migrate', '--force'], repo.home);
        expect(code).toBe(0);
        const log = await read(join(repo.archive, 'HANDOFF-log.md'));
        expect(log).toMatch(/^## Folded \d{4}-\d{2}-\d{2} from `HANDOFF.md` — 3 step\(s\)$/m);
        expect(log).toContain('Body of three.');
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'a second run refuses and changes nothing',
    async () => {
      const repo = await legacyRepo();
      try {
        await run(repo.dir, ['fold', 'migrate', '--force'], repo.home);
        const board = await read(join(repo.dir, 'PASSOFF.md'));
        const { code, stdout } = await run(repo.dir, ['fold', 'migrate', '--force'], repo.home);
        expect(code).toBe(1);
        expect(stdout).toContain('already migrated');
        expect(await read(join(repo.dir, 'PASSOFF.md'))).toBe(board);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'undo restores the board, the ledger and the config byte for byte',
    async () => {
      const repo = await legacyRepo();
      try {
        await run(repo.dir, ['fold', 'migrate', '--force'], repo.home);
        const { code } = await run(repo.dir, ['undo', '--force'], repo.home);
        expect(code).toBe(0);
        expect(await read(join(repo.dir, 'PASSOFF.md'))).toBe(BOARD);
        expect(await read(join(repo.dir, 'HANDOFF.md'))).toBe(BOLD_LEDGER);
        expect(await read(join(repo.dir, '.personal-config.json'))).toBe(CONFIG(repo.archive));
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'a board with two sections for one number refuses before anything is written',
    async () => {
      const repo = await legacyRepo();
      try {
        const twice = `${BOARD}\n### 5. Build it again\n`;
        await Bun.write(join(repo.dir, 'PASSOFF.md'), twice);
        const { code, stdout } = await run(repo.dir, ['fold', 'migrate', '--force'], repo.home);
        expect(code).toBe(1);
        expect(stdout).toContain('two sections for item 5');
        expect(await Bun.file(join(repo.archive, 'HANDOFF-log.md')).exists()).toBe(false);
        expect(await read(join(repo.dir, 'PASSOFF.md'))).toBe(twice);
      } finally {
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );
});
