import { describe, expect, test } from 'bun:test';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inFlight } from '../src/lib/board.ts';
import { withLock } from '../src/lib/lock.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A pid that is certainly dead: a child that has already exited. */
async function deadPid(): Promise<number> {
  const proc = Bun.spawn(['true'], { stdout: 'ignore', stderr: 'ignore' });
  await proc.exited;
  return proc.pid;
}

describe('withLock', () => {
  test('two holders run one after the other', async () => {
    const dir = await tempDir('pc-lock-');
    try {
      const path = join(dir, 'x.lock');
      const order: string[] = [];
      await Promise.all([
        withLock(path, async () => {
          order.push('a in');
          await sleep(150);
          order.push('a out');
        }),
        (async () => {
          await sleep(20);
          await withLock(path, async () => {
            order.push('b in');
          });
        })(),
      ]);
      expect(order).toEqual(['a in', 'a out', 'b in']);
    } finally {
      await cleanup(dir);
    }
  });

  test('a lock left by a dead process is taken over at once', async () => {
    const dir = await tempDir('pc-lock-');
    try {
      const path = join(dir, 'x.lock');
      await writeFile(path, `${await deadPid()}\n${new Date().toISOString()}\n`);
      const start = Date.now();
      await withLock(path, async () => undefined, { waitMs: 5_000 });
      expect(Date.now() - start).toBeLessThan(1_000);
    } finally {
      await cleanup(dir);
    }
  });

  test('a lock older than the staleness window is taken over, live pid or not', async () => {
    const dir = await tempDir('pc-lock-');
    try {
      const path = join(dir, 'x.lock');
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      await writeFile(path, `${process.pid}\n${twoHoursAgo}\n`);
      const start = Date.now();
      await withLock(path, async () => undefined, { waitMs: 5_000 });
      expect(Date.now() - start).toBeLessThan(1_000);
    } finally {
      await cleanup(dir);
    }
  });

  test('a fresh lock of a live process is refused by name after the wait', async () => {
    const dir = await tempDir('pc-lock-');
    try {
      const path = join(dir, 'x.lock');
      await writeFile(path, `${process.pid}\n${new Date().toISOString()}\n`);
      await expect(withLock(path, async () => undefined, { waitMs: 200 })).rejects.toThrow(
        `held by process ${process.pid}`,
      );
      // The refusal left the holder's file alone.
      expect(await readFile(path, 'utf8')).toContain(String(process.pid));
    } finally {
      await cleanup(dir);
    }
  });
});

describe('inFlight', () => {
  test('a tail after IN FLIGHT is still in flight; other statuses are not', () => {
    expect(inFlight('IN FLIGHT')).toBe(true);
    expect(inFlight('IN FLIGHT 2026-10-16: GATE 2 passed')).toBe(true);
    expect(inFlight('OPEN')).toBe(false);
    expect(inFlight('HELD')).toBe(false);
    expect(inFlight('DONE - 2026-10-16')).toBe(false);
  });
});

/** The CLI in a copy of the worked example, as two sessions would run it. */
async function claimAt(cwd: string, item: string): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(['bun', 'run', CLI, 'passoff', 'claim', item, '--force'], {
    cwd,
    env: process.env,
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

async function exampleBoard(): Promise<string> {
  const dir = await tempDir('pc-claim-');
  await cp(join(repoRoot(), 'examples'), dir, { recursive: true });
  return dir;
}

/**
 * The race the lock exists for. Before it, two claims of one row both printed "Claimed item 1"
 * and two claims of different rows lost one row's status, each in 30 of 30 runs (2026-10-16).
 */
describe('passoff claim under the lock', () => {
  /**
   * The worked example's board carries an adapted stamp, as `buy-in`'s and `felto`'s do. Until
   * 2026-10-16 the stamp guard read that stamp in the edited contents, kept the board, and the
   * claim still printed "Claimed": the item file said in flight and the board said open.
   */
  test('a board with an adapted stamp is written, not silently kept', async () => {
    const dir = await exampleBoard();
    try {
      const board = await readFile(join(dir, 'PASSOFF.md'), 'utf8');
      expect(board.split('\n')[0]).toContain('adapted');
      const { code, out } = await claimAt(dir, '1');
      expect(code).toBe(0);
      expect(out).toContain('Wrote 2 file(s)');
      expect(await readFile(join(dir, 'PASSOFF.md'), 'utf8')).toMatch(
        /^\| 1 \|[^\n]*`IN FLIGHT`/m,
      );
    } finally {
      await cleanup(dir);
    }
  });

  test('the same row claimed twice at once is claimed once and refused once', async () => {
    const dir = await exampleBoard();
    try {
      const [a, b] = await Promise.all([claimAt(dir, '1'), claimAt(dir, '1')]);
      const claimed = [a, b].filter((r) => r.out.includes('Claimed item 1'));
      const refused = [a, b].filter((r) => r.out.includes('is `IN FLIGHT`'));
      expect(claimed).toHaveLength(1);
      expect(refused).toHaveLength(1);
    } finally {
      await cleanup(dir);
    }
  });

  test('two rows claimed at once both land on the board and in their files', async () => {
    const dir = await exampleBoard();
    try {
      const [a, b] = await Promise.all([claimAt(dir, '1'), claimAt(dir, '2')]);
      expect(a.out).toContain('Claimed item 1');
      expect(b.out).toContain('Claimed item 2');
      const board = await readFile(join(dir, 'PASSOFF.md'), 'utf8');
      expect(board).toMatch(/^\| 1 \|[^\n]*`IN FLIGHT`/m);
      expect(board).toMatch(/^\| 2 \|[^\n]*`IN FLIGHT`/m);
      for (const name of [
        '1-give-the-click-sweep-backpressure.md',
        '2-custom-short-codes-reserved-word-list.md',
      ]) {
        expect(await readFile(join(dir, 'passoff', name), 'utf8')).toContain(
          'Claimed `IN FLIGHT`',
        );
      }
    } finally {
      await cleanup(dir);
    }
  });

  test('a status with a tail after IN FLIGHT still collides', async () => {
    const dir = await tempDir('pc-claim-');
    try {
      await writeFile(
        join(dir, 'PASSOFF.md'),
        [
          '# PASSOFF',
          '',
          '| # | Task | Status | Model | Lane | Waits on | Files it owns |',
          '|---|------|--------|-------|------|----------|---------------|',
          '| 1 | First | `OPEN` | Default | A | - | `src/a.ts` |',
          '| 2 | Second | `IN FLIGHT 2026-10-16: GATE 2 passed` | Default | B | - | `src/a.ts` |',
          '',
        ].join('\n'),
      );
      const proc = Bun.spawn(['bun', 'run', CLI, 'passoff', 'next'], {
        cwd: dir,
        env: process.env,
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const out = await new Response(proc.stdout).text();
      await proc.exited;
      expect(out).toContain('Collision: item 2 is IN FLIGHT');
    } finally {
      await cleanup(dir);
    }
  });
});
