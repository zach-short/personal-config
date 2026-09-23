import { describe, expect, test } from 'bun:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { unfolded } from '../src/doctor/rules/unfolded.ts';
import type { Doc } from '../src/doctor/scan.ts';
import { parseBoard } from '../src/lib/board.ts';
import {
  applyFold,
  boardFold,
  DEFAULT_KEEP,
  foldedLines,
  ledgerFold,
} from '../src/lib/fold.ts';
import { ledgerSteps, nextFreeStep } from '../src/lib/ledger.ts';
import { headingBlock } from '../src/lib/markdown.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');
const SPAWN_TIMEOUT = 30_000;

const BOARD = [
  '# PASSOFF — example (the board)',
  '',
  '| # | Task | Status | Model | Lane | Waits on | Files it owns |',
  '|---|------|--------|-------|------|----------|---------------|',
  '| 1 | Build the thing | `DONE — HANDOFF 2` | Opus 5 | A | — | `src/a.ts` |',
  '| 2 | Scope the other thing | `DONE — HANDOFF 3` | Opus 5 | A | — | `src/b.ts` |',
  '| 3 | Park the third | `SETTLED AS NO` | Opus 5 | A | — | none |',
  '| 4 | The replaced one | `SUPERSEDED` | Opus 5 | A | — | none |',
  '| 5 | Still to do | `OPEN` | Opus 5 | A | — | `src/e.ts` |',
  '',
  '---',
  '',
  '### 1. Build the thing',
  '',
  'A long prompt that has already been executed.',
  '',
  '---',
  '',
  '### 2. Scope the other thing',
  '',
  'Another executed prompt.',
  '',
  '#### SCOPE — written 2026-09-15',
  '',
  'Nested under item 2, and part of it.',
  '',
  '---',
  '',
  '### 3. Park the third',
  '',
  '*2026-09-16.* Settled as no because the cost lands on every reader and nobody asked for it.',
  '',
  '---',
  '',
  '### 4. The replaced one',
  '',
  '*2026-09-16.* Superseded by item 5, which does the same work in one pass.',
  '',
  '---',
  '',
  '### 5. Still to do',
  '',
  'A live prompt.',
  '',
].join('\n');

function ledgerOf(steps: number, bodyLines = 4): string {
  const log = [];
  for (let n = 1; n <= steps; n += 1) {
    log.push(
      `**${n}. Did thing ${n}.** Done 2026-09-${String((n % 28) + 1).padStart(2, '0')}, Opus 5.`,
    );
    for (let line = 0; line < bodyLines; line += 1) log.push(`Body line ${line} of step ${n}.`);
    log.push('');
  }
  return [
    '# HANDOFF — example',
    '',
    '## Step log',
    '',
    ...log,
    '## Style rules',
    '',
    'Short.',
    '',
  ].join('\n');
}

describe('the board half folds only what is genuinely dead', () => {
  test('a DONE prompt goes; the board keeps every row', () => {
    const fold = boardFold(BOARD);
    expect(fold.folded.map((block) => block.id)).toEqual(['1', '2']);
    expect(parseBoard(fold.trimmed)?.rows).toHaveLength(5);
    expect(fold.trimmed).toContain('| 1 | Build the thing | `DONE — HANDOFF 2` |');
  });

  /**
   * Not a preference: `doctor`'s §2.3 rule reads both sections — `supersededProblem` for what
   * replaced the item, `settledProblem` for the dated reason it was a no. Folding either would
   * make this tool's own checker fire on the file this tool just wrote.
   */
  test('SETTLED AS NO and SUPERSEDED keep their sections', () => {
    const { trimmed } = boardFold(BOARD);
    expect(trimmed).toContain('### 3. Park the third');
    expect(trimmed).toContain('Settled as no because the cost lands');
    expect(trimmed).toContain('### 4. The replaced one');
    expect(trimmed).toContain('Superseded by item 5');
  });

  test('an OPEN prompt is left alone', () => {
    expect(boardFold(BOARD).trimmed).toContain('### 5. Still to do');
  });

  /** Board item 5 in this repo carries a `#### SCOPE` inside it (`PASSOFF.md:493`). */
  test('a nested deeper heading is lifted with its item, not stranded', () => {
    const block = headingBlock(BOARD, '2');
    expect(block?.body).toContain('#### SCOPE — written 2026-09-15');
    const { trimmed } = boardFold(BOARD);
    expect(trimmed).not.toContain('#### SCOPE');
    expect(trimmed).not.toContain('Nested under item 2');
  });

  test('folding twice changes nothing the second time', () => {
    const once = boardFold(BOARD).trimmed;
    expect(boardFold(once).folded).toHaveLength(0);
  });
});

describe('the ledger half keeps every citation resolvable', () => {
  const led = ledgerOf(30);

  test('step numbers survive exactly, so `handoff step` hands out the same one', () => {
    const { trimmed } = ledgerFold(led, 10, '2026-09-23');
    expect(ledgerSteps(trimmed).map((s) => s.number)).toEqual(
      ledgerSteps(led).map((s) => s.number),
    );
    expect(nextFreeStep(ledgerSteps(trimmed))).toBe(nextFreeStep(ledgerSteps(led)));
  });

  test('a folded step keeps its title and its own date', () => {
    const { folded } = ledgerFold(led, 10, '2026-09-23');
    expect(folded[0]?.stub).toBe(
      '**1. Did thing 1.** Done 2026-09-02. Body folded 2026-09-23.',
    );
  });

  test('the newest --keep steps keep their bodies', () => {
    const { trimmed } = ledgerFold(led, 10, '2026-09-23');
    expect(trimmed).toContain('Body line 0 of step 30.');
    expect(trimmed).not.toContain('Body line 0 of step 1.');
  });

  /** This repo's log ends at `HANDOFF.md:5075` and `## Style rules` opens at 5076. */
  test('a standing section after the log is never swallowed', () => {
    const { trimmed } = ledgerFold(ledgerOf(30), 0, '2026-09-23');
    expect(trimmed).toContain('## Style rules');
    expect(trimmed).toContain('Short.');
  });

  test('folding twice changes nothing the second time', () => {
    const once = ledgerFold(led, 10, '2026-09-23').trimmed;
    expect(ledgerFold(once, 10, '2026-09-23').folded).toHaveLength(0);
  });
});

describe('the splice', () => {
  test('heals the gap a cut leaves and no other', () => {
    const source = ['a', '', '', 'b', 'CUT', '', 'c'].join('\n');
    const folded = [{ id: 'x', heading: 'CUT', text: 'CUT', start: 5, end: 5, stub: null }];
    // The double blank between `a` and `b` is the document's own and is kept; the one left
    // hanging where `CUT` was is the seam, and goes.
    expect(applyFold(source, folded)).toBe(['a', '', '', 'b', '', 'c'].join('\n'));
  });

  test('counts the lines it would remove', () => {
    expect(foldedLines(boardFold(BOARD))).toBeGreaterThan(8);
  });
});

describe('the doctor rule', () => {
  function doc(kind: Doc['kind'], text: string): Doc {
    return {
      path: `/tmp/${kind}.md`,
      kind,
      text,
      lines: text.split('\n'),
      isTemplate: false,
      ledgerStem: 'HANDOFF',
    };
  }

  test('fires on a board carrying more than the threshold in closed prompts', () => {
    const big = BOARD.replace(
      'A long prompt that has already been executed.',
      'filler\n'.repeat(500),
    );
    const findings = unfolded.check(doc('board', big));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('closed prompt(s) still on the board');
    expect(findings[0]?.standardId).toBe('§2.1');
  });

  test('fires on a ledger whose old step bodies pass the threshold', () => {
    const findings = unfolded.check(doc('ledger', ledgerOf(DEFAULT_KEEP + 120)));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(`older than the newest ${DEFAULT_KEEP}`);
  });

  test('says nothing about a board and a log that are already small', () => {
    expect(unfolded.check(doc('board', BOARD))).toEqual([]);
    expect(unfolded.check(doc('ledger', ledgerOf(DEFAULT_KEEP + 2)))).toEqual([]);
  });
});

describe('the command, end to end', () => {
  async function world() {
    const dir = await tempDir('pc-fold-');
    const repo = join(dir, 'repo');
    const archive = join(dir, 'archive');
    await mkdir(repo, { recursive: true });
    await mkdir(archive, { recursive: true });
    await writeFile(join(repo, 'PASSOFF.md'), BOARD);
    await writeFile(join(repo, 'HANDOFF.md'), ledgerOf(30));
    await writeFile(
      join(repo, '.personal-config.json'),
      JSON.stringify({ archiveHome: archive }),
    );
    await writeFile(join(archive, 'INDEX.md'), '# archive — index\n\n## Closed\n\n');
    return { dir, repo, archive };
  }

  /**
   * `home` is a parameter because the backup store lives under it: a case that folds and then
   * undoes has to be one person's machine, not two. Passing separate temp homes made `undo`
   * look for a manifest the fold had written somewhere else, and pass for the wrong reason.
   */
  async function run(cwd: string, args: string[], sharedHome?: string) {
    const home = sharedHome ?? (await tempDir('pc-home-'));
    try {
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
    } finally {
      if (sharedHome === undefined) await cleanup(home);
    }
  }

  test(
    'archives both halves, trims both documents, and indexes the two files',
    async () => {
      const { dir, repo, archive } = await world();
      try {
        const { code } = await run(repo, ['fold', '--keep', '10', '--force']);
        expect(code).toBe(0);

        const closed = await readFile(join(archive, 'PASSOFF-closed.md'), 'utf8');
        expect(closed).toContain('### 1. Build the thing');
        expect(closed).toContain('#### SCOPE — written 2026-09-15');

        const log = await readFile(join(archive, 'HANDOFF-log.md'), 'utf8');
        expect(log).toContain('Body line 0 of step 1.');

        const board = await readFile(join(repo, 'PASSOFF.md'), 'utf8');
        expect(parseBoard(board)?.rows).toHaveLength(5);
        expect(board).not.toContain('A long prompt');
        expect(board).toContain('### 3. Park the third');

        const ledger = await readFile(join(repo, 'HANDOFF.md'), 'utf8');
        expect(ledgerSteps(ledger)).toHaveLength(30);
        expect(ledger).toContain('## Style rules');

        const index = await readFile(join(archive, 'INDEX.md'), 'utf8');
        expect(index).toContain('**PASSOFF-closed.md**');
        expect(index).toContain('**HANDOFF-log.md**');
      } finally {
        await cleanup(dir);
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    '--dry-run writes nothing at all',
    async () => {
      const { dir, repo, archive } = await world();
      try {
        const { code, stdout } = await run(repo, ['fold', '--dry-run']);
        expect(code).toBe(0);
        expect(stdout).toContain('--dry-run');
        expect(await readFile(join(repo, 'PASSOFF.md'), 'utf8')).toBe(BOARD);
        expect(await readFile(join(archive, 'INDEX.md'), 'utf8')).not.toContain(
          'PASSOFF-closed',
        );
      } finally {
        await cleanup(dir);
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'refuses when the repo has no archive home, rather than deleting into nowhere',
    async () => {
      const { dir, repo } = await world();
      try {
        await writeFile(join(repo, '.personal-config.json'), '{}');
        const { code, stdout } = await run(repo, ['fold', '--force']);
        expect(code).toBe(1);
        expect(stdout).toContain('no archive home');
        expect(await readFile(join(repo, 'PASSOFF.md'), 'utf8')).toBe(BOARD);
      } finally {
        await cleanup(dir);
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'undo puts every folded document back',
    async () => {
      const { dir, repo, archive } = await world();
      const home = await tempDir('pc-home-');
      try {
        await run(repo, ['fold', '--keep', '10', '--force'], home);
        expect(await readFile(join(repo, 'PASSOFF.md'), 'utf8')).not.toBe(BOARD);

        await run(repo, ['undo', '--force'], home);
        expect(await readFile(join(repo, 'PASSOFF.md'), 'utf8')).toBe(BOARD);

        // And folding again is safe rather than duplicating: the archive already holds these.
        await run(repo, ['fold', '--keep', '10', '--force'], home);
        const closed = await readFile(join(archive, 'PASSOFF-closed.md'), 'utf8');
        expect(closed.split('### 1. Build the thing')).toHaveLength(2);
      } finally {
        await cleanup(home);
        await cleanup(dir);
      }
    },
    SPAWN_TIMEOUT,
  );
});
