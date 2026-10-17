/**
 * Board item 130: a child a test spawned with no `env` ran under the real `$HOME`, because Bun
 * 1.2.9 gives such a child the environment the test process started with, not the preload's
 * `process.env`. `tests/completion-gate.test.ts` added five lines to the real gate log on every
 * run that way. `tests/preload.ts` now fills `env` in for `Bun.spawn` and `Bun.spawnSync`; these
 * pin that it does, and keep out the node forms a preload cannot reach.
 */

import { describe, expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { readText } from '../src/lib/disk.ts';
import { repoRoot } from '../src/lib/paths.ts';

const PRINT_HOME = ['sh', '-c', 'printf %s "$HOME"'];

/**
 * node's sync forms, which give the child the start-up environment and cannot be wrapped from a
 * preload, named in an import or a call. `Bun.spawnSync` and an object key of that name are left
 * alone: the preload covers the one and sets the other. node's `spawn`, `execFile` and `exec`
 * pass `process.env`, so they are allowed.
 */
const NODE_SYNC_SPAWN = /(?<!Bun\.)\b(spawnSync|execFileSync|execSync)\b(?!\s*:)/;

async function tsFilesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === 'fixtures' ? [] : tsFilesUnder(full);
      return entry.name.endsWith('.ts') ? [full] : [];
    }),
  );
  return found.flat();
}

/** Strips block and line comments, so prose naming a function is not code calling it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('a child a test spawns gets the sandbox home', () => {
  test('passes: the sandbox is not the real home', () => {
    expect(process.env.HOME).not.toBe(homedir());
  });

  test.each([
    ['Bun.spawn, a command list', () => Bun.spawn(PRINT_HOME, { stdout: 'pipe' }).stdout],
    [
      'Bun.spawn, one options object',
      () => Bun.spawn({ cmd: PRINT_HOME, stdout: 'pipe' }).stdout,
    ],
    ['Bun.spawnSync, a command list', () => Bun.spawnSync(PRINT_HOME).stdout],
    ['Bun.spawnSync, one options object', () => Bun.spawnSync({ cmd: PRINT_HOME }).stdout],
  ])('violates the old behaviour: %s with no `env` sees the sandbox', async (_label, run) => {
    expect(await new Response(run()).text()).toBe(process.env.HOME ?? '');
  });

  test('passes: an `env` the caller passes still wins', async () => {
    const proc = Bun.spawn(PRINT_HOME, {
      env: { ...process.env, HOME: '/nowhere' },
      stdout: 'pipe',
    });
    expect(await new Response(proc.stdout).text()).toBe('/nowhere');
  });
});

describe("node's sync spawns stay out of the code a test runs", () => {
  test('passes: no file under `src/` or `tests/` calls one', async () => {
    const root = repoRoot();
    const files = [
      ...(await tsFilesUnder(join(root, 'src'))),
      ...(await tsFilesUnder(join(root, 'tests'))),
    ].filter((file) => file !== import.meta.path);
    const offenders: string[] = [];
    for (const file of files) {
      if (NODE_SYNC_SPAWN.test(stripComments(await readText(file)))) {
        offenders.push(relative(root, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  test('violates: the pattern names each sync form and leaves the covered ones alone', () => {
    const caught = [
      "import { execFileSync } from 'node:child_process';",
      "spawnSync('git')",
      "cp.execSync('git init')",
    ];
    for (const line of caught) expect(NODE_SYNC_SPAWN.test(line), line).toBe(true);
    const allowed = [
      "Bun.spawnSync(['git'])",
      '{ spawnSync: inSandbox(Bun.spawnSync) }',
      "execFile('git')",
      "spawn('pbcopy')",
    ];
    for (const line of allowed) expect(NODE_SYNC_SPAWN.test(line), line).toBe(false);
  });
});
