import { describe, expect, test } from 'bun:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, tempDir } from './helpers.ts';

const HOOKS = join(import.meta.dir, '..', 'templates', 'hooks');

const BOARD = [
  '| # | Task | Status | Model | Lane | Waits on | Files it owns |',
  '|---|------|--------|-------|------|----------|---------------|',
  '| 1 | Done thing | `DONE - 2026-10-01` | D | A | - | - |',
  '| 15 | Open thing | `OPEN` | D | A | - | - |',
].join('\n');

/**
 * Per-item-board `DESIGN.md` §4.6: after the next open title, the item's own file when it exists,
 * so a session opens the one prompt it needs. `items` maps a folder to the file names in it.
 */
async function banner(
  items: Record<string, string[]>,
  extra: Record<string, string> = {},
): Promise<string> {
  const dir = await tempDir();
  try {
    const config = { ledgerFile: 'HANDOFF.md', boardFile: 'PASSOFF.md', ...extra };
    await Bun.write(join(dir, '.personal-config.json'), `${JSON.stringify(config, null, 2)}\n`);
    await Bun.write(join(dir, 'HANDOFF.md'), '# H\n');
    await Bun.write(join(dir, 'PASSOFF.md'), `${BOARD}\n`);
    for (const [folder, names] of Object.entries(items)) {
      await mkdir(join(dir, folder), { recursive: true });
      for (const name of names) await Bun.write(join(dir, folder, name), '# x\n');
    }
    const proc = Bun.spawn(['bash', join(HOOKS, 'session-banner.sh')], {
      cwd: dir,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const out = await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(0);
    return out;
  } finally {
    await cleanup(dir);
  }
}

describe('the session banner names the open item file', () => {
  test('passes: the open item has a file, and the banner prints its path', async () => {
    const out = await banner({ passoff: ['15-open-thing.md'] });
    expect(out).toContain('Next open: 15 · Open thing · passoff/15-open-thing.md');
  });

  test('violates: 15 never takes the file of 1 or 1.5, and 1 never takes 15', async () => {
    const out = await banner({ passoff: ['1-done-thing.md', '1.5-half.md', '150-other.md'] });
    expect(out).toContain('Next open: 15 · Open thing\n');
  });

  test('passes: `itemsDir` in the config names the folder', async () => {
    const out = await banner({ work: ['15-open-thing.md'] }, { itemsDir: 'work' });
    expect(out).toContain('Next open: 15 · Open thing · work/15-open-thing.md');
  });

  test('passes: a 1.x board with no items folder prints the title alone, as before', async () => {
    const out = await banner({});
    expect(out).toContain('Next open: 15 · Open thing\n');
  });
});
