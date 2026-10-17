/**
 * Tests must never touch the real `~/.claude` or `~/.config`. `os.homedir()` honours `$HOME`
 * on POSIX, so redirecting it here makes every global renderer write into a throwaway tree
 * with no test-only branch anywhere in the engine.
 */
import { afterAll, beforeEach, setDefaultTimeout } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sandbox = mkdtempSync(join(tmpdir(), 'pc-home-'));
process.env.HOME = sandbox;
process.env.PERSONAL_CONFIG_TEST_HOME = sandbox;

// `setup` copies the Part 0 prompt with `pbcopy` (src/commands/setup.ts, copyPart0). Without this
// stub every test that runs setup overwrote the real clipboard, so a copy made while tests ran
// was replaced by a test's prompt (2026-10-17). A `pbcopy` first on PATH reads and discards stdin,
// so the engine keeps its code path and no test-only branch enters src/. It reaches a child only
// through an explicit `env`, which is how the tests run the bin: under Bun 1.2.9 a child spawned
// with no `env` gets the environment this process started with, so an in-process `runSetup` or
// `finish` that writes a Part 0 prompt still finds `/usr/bin/pbcopy` (probed 2026-10-17).
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
