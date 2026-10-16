import { describe, expect, test } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';
import { makeItemRepo } from './item-fixture.ts';

/**
 * F1 (HANDOFF-log step 112): the log fold kept a line only where the archive did not already
 * hold it as a substring. `- 2020-01-01 · closed item 8` sits inside an archived
 * `- 2020-01-01 · closed item 83`, so it was cut from the ledger, never appended, and the fold
 * exited 0. A log line is a whole line, so it is matched as one.
 */

const CLI = join(repoRoot(), 'src', 'cli.ts');
const SPAWN_TIMEOUT = 30_000;

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

describe('fold ledger, a log line that is a prefix of an archived one', () => {
  test(
    'is appended to the archive log, not dropped as already there',
    async () => {
      const repo = await makeItemRepo();
      const home = await tempDir('pc-home-');
      try {
        await writeFile(
          join(repo.archive, 'HANDOFF-log.md'),
          '# Folded log\n\n## Folded 2020-04-01\n\n- 2020-01-01 · closed item 83\n',
        );
        await writeFile(
          join(repo.dir, 'HANDOFF.md'),
          '# HANDOFF\n\n## Log\n\n- 2020-01-01 · closed item 8\n',
        );
        await writeFile(
          join(repo.dir, '.personal-config.json'),
          `${JSON.stringify({ archiveHome: repo.archive, ledgerFrozenAt: 105 })}\n`,
        );

        const { code } = await run(repo.dir, ['fold', 'ledger', '--force'], home);
        expect(code).toBe(0);

        const lines = (await readFile(join(repo.archive, 'HANDOFF-log.md'), 'utf8')).split(
          '\n',
        );
        expect(lines).toContain('- 2020-01-01 · closed item 8');
        expect(lines).toContain('- 2020-01-01 · closed item 83');
        expect(await readFile(join(repo.dir, 'HANDOFF.md'), 'utf8')).not.toContain('item 8');
      } finally {
        await cleanup(home);
        await repo.done();
      }
    },
    SPAWN_TIMEOUT,
  );
});
