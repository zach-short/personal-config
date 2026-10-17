import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import * as disk from '../src/lib/disk.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

/**
 * Bun 1.2.9 on macOS loses the completion of an `fs.promises` call when another one is in flight,
 * and the process then never exits (board item 131; the evidence is in the comment above
 * `inTurn`). The chance is small per process, so no test here can show the hang itself. What a
 * test can pin is what the fix rests on: no two calls overlap, and no file in `src/` can start one
 * that bypasses `disk.ts`.
 */

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('inTurn', () => {
  test('runs calls one at a time, in the order they were started', async () => {
    const order: string[] = [];
    let running = 0;
    let most = 0;
    const job = (name: string, ms: number) =>
      disk.inTurn(async () => {
        running += 1;
        most = Math.max(most, running);
        order.push(`start ${name}`);
        await sleep(ms);
        order.push(`end ${name}`);
        running -= 1;
        return name;
      });

    const names = await Promise.all([job('a', 20), job('b', 1), job('c', 10)]);

    expect(names).toEqual(['a', 'b', 'c']);
    expect(most).toBe(1);
    expect(order).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  test('a call that rejects goes to its own caller and does not hold up the next', async () => {
    const failing = disk.inTurn(async () => {
      throw new Error('boom');
    });
    const next = disk.inTurn(async () => 'ran');

    await expect(failing).rejects.toThrow('boom');
    expect(await next).toBe('ran');
  });
});

describe('every disk function takes its turn', () => {
  /** Holds the turn until `release()`, so a function that skips the queue settles first. */
  async function holdTheTurn(): Promise<() => Promise<void>> {
    let release = () => {};
    const held = disk.inTurn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await sleep(0);
    return () => {
      release();
      return held;
    };
  }

  async function settledWhileHeld(start: () => Promise<unknown>): Promise<boolean> {
    const release = await holdTheTurn();
    const call = start().then(
      () => true,
      () => true,
    );
    const early = await Promise.race([call, sleep(60).then(() => false)]);
    await release();
    await call;
    return early;
  }

  test('none settles while another call holds the turn', async () => {
    const dir = await tempDir('pc-in-turn-');
    try {
      const file = join(dir, 'a.txt');
      const other = join(dir, 'b.txt');
      await disk.writeText(file, '{}\n');
      const calls: Record<string, () => Promise<unknown>> = {
        stat: () => disk.stat(file),
        readdir: () => disk.readdir(dir),
        'readdir, with types': () => disk.readdir(dir, { withFileTypes: true }),
        readBytes: () => disk.readBytes(file),
        mkdir: () => disk.mkdir(join(dir, 'sub', 'deeper'), { recursive: true }),
        rename: () => disk.rename(file, other),
        rm: () => disk.rm(other, { force: true }),
        unlink: () => disk.unlink(join(dir, 'missing.txt')),
        realpath: () => disk.realpath(dir),
        writeNew: () => disk.writeNew(join(dir, 'new.txt'), 'x'),
        exists: () => disk.exists(file),
        modeOf: () => disk.modeOf(file),
        readText: () => disk.readText(file),
        readJson: () => disk.readJson(file),
        writeText: () => disk.writeText(join(dir, 'w.txt'), 'x'),
        setMode: () => disk.setMode(join(dir, 'w.txt'), 0o644),
        copyTo: () => disk.copyTo(join(dir, 'w.txt'), join(dir, 'c', 'w.txt')),
        removeIfEmpty: () => disk.removeIfEmpty(join(dir, 'sub', 'deeper')),
      };

      const exported = Object.keys(disk).filter((name) => name !== 'inTurn');
      const covered = Object.keys(calls).map((name) => name.split(',')[0] ?? name);
      expect(exported.filter((name) => !covered.includes(name))).toEqual([]);

      for (const [name, start] of Object.entries(calls)) {
        expect({ name, settled: await settledWhileHeld(start) }).toEqual({
          name,
          settled: false,
        });
      }
    } finally {
      await cleanup(dir);
    }
  });
});

describe('src/', () => {
  test('only disk.ts imports node:fs/promises', async () => {
    const source = join(repoRoot(), 'src');
    const importing: string[] = [];
    for await (const file of new Bun.Glob('**/*.ts').scan({ cwd: source })) {
      if (file === join('lib', 'disk.ts')) continue;
      const text = await Bun.file(join(source, file)).text();
      if (/(?:from|import\(|require\()\s*['"](?:node:)?fs\/promises['"]/.test(text)) {
        importing.push(file);
      }
    }
    expect(importing).toEqual([]);
  });
});
