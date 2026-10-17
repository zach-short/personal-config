/**
 * Tests must never touch the real `~/.claude` or `~/.config`. `src/lib/paths.ts` reads `$HOME`
 * itself (Bun snapshots `os.homedir()` at start-up), so redirecting it here sends every global
 * renderer in this process into a throwaway tree, with no test-only branch in the engine. That
 * covers this process only: a child gets the sandbox through `inSandbox` below.
 */
import { afterAll, beforeEach, setDefaultTimeout } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sandbox = mkdtempSync(join(tmpdir(), 'pc-home-'));
process.env.HOME = sandbox;
process.env.PERSONAL_CONFIG_TEST_HOME = sandbox;

// Under Bun 1.2.9 a child spawned with no `env` by `Bun.spawn`, `Bun.spawnSync` or node's
// `spawnSync`, `execFileSync` or `execSync` gets the environment this process started with, not
// `process.env`: the real `$HOME` and `PATH`, and no variable set here. node's `spawn`,
// `execFile` and `exec` do pass `process.env`, so `src/`'s `git` and `pbcopy` are safe. Probed
// 2026-10-17; a libc `setenv` through `bun:ffi` did not reach the start-up copy. So
// `tests/completion-gate.test.ts`, which ran the hook with no `env`, added five lines to the real
// gate log on every run (board item 130). Filling `env` in here reaches every `Bun.spawn` and
// `Bun.spawnSync` in every test file, however it is written; an `env` the caller passes still
// wins. node's functions cannot be wrapped from here, because a file's named imports are bound
// before a preload could change them, so `tests/spawn-env.test.ts` refuses its sync forms.
function withEnv(options: unknown): object {
  const given = typeof options === 'object' && options !== null ? options : {};
  return 'env' in given && given.env !== undefined ? given : { ...given, env: process.env };
}

function inSandbox(spawn: typeof Bun.spawn | typeof Bun.spawnSync) {
  return (...args: unknown[]): unknown => {
    const at = Array.isArray(args[0]) ? 1 : 0;
    args[at] = withEnv(args[at]);
    return Reflect.apply(spawn, Bun, args);
  };
}

Object.assign(Bun, { spawn: inSandbox(Bun.spawn), spawnSync: inSandbox(Bun.spawnSync) });

// `setup` copies the Part 0 prompt with `pbcopy` (src/commands/setup.ts, copyPart0). Without this
// stub every test that runs setup overwrote the real clipboard, so a copy made while tests ran
// was replaced by a test's prompt (2026-10-17). A `pbcopy` first on PATH reads and discards stdin,
// so the engine keeps its code path and no test-only branch enters src/. A spawned bin finds it
// through `inSandbox` above. An in-process `runSetup` or `finish` finds it too, because node's
// `spawn` passes `process.env` (a stub first on `PATH` ran, probed 2026-10-17).
const stubBin = join(sandbox, 'stub-bin');
mkdirSync(stubBin);
writeFileSync(join(stubBin, 'pbcopy'), '#!/bin/sh\ncat > /dev/null\n', { mode: 0o755 });
process.env.PATH = `${stubBin}:${process.env.PATH ?? ''}`;

// A run in a terminal must draw what CI draws. `@clack/core` wraps each frame at
// `process.stdout.columns`, which is undefined off a terminal; in an 80-column terminal it wrapped
// the frame tests' 100-column screens and three of them failed (2026-10-16).
Object.defineProperty(process.stdout, 'columns', { value: undefined, configurable: true });
Object.defineProperty(process.stdout, 'rows', { value: undefined, configurable: true });

// Nine files spawn the real bin or git; Bun's 5s default test timeout can fire on any of them
// under memory pressure alone, with no bug in the spawned process (board item 49, HANDOFF 53).
// Bun 1.2.9 scopes setDefaultTimeout per file, so a top-level call here reached only the first
// file of a run: a 6 s probe test passed alone and timed out at 5000 ms after
// tests/archive.test.ts (board item 128). A preload `beforeEach` runs before every test in every
// file. `[test] timeout` in bunfig.toml is ignored, and `--timeout` would need every caller of
// `bun test` (the gate line, CI, the docs) to pass it.
beforeEach(() => setDefaultTimeout(30_000));

// One sandbox per `bun test` invocation and nothing removed them, so they accumulated in
// $TMPDIR — 118 by 2026-09-15. `afterAll` at preload scope is the only hook that fires here:
// under Bun 1.2.9's test runner `process.on('exit')` and `'beforeExit'` never run, measured
// with a probe preload that logged from all three. It fires once for the whole run, not once
// per file, so the sandbox outlives every test that shares it.
afterAll(async () => {
  await rm(sandbox, { recursive: true, force: true });
});
