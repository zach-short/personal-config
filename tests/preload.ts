/**
 * Tests must never touch the real `~/.claude` or `~/.config`. `os.homedir()` honours `$HOME`
 * on POSIX, so redirecting it here makes every global renderer write into a throwaway tree
 * with no test-only branch anywhere in the engine.
 */
import { afterAll } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sandbox = mkdtempSync(join(tmpdir(), 'pc-home-'));
process.env.HOME = sandbox;
process.env.PERSONAL_CONFIG_TEST_HOME = sandbox;

// One sandbox per `bun test` invocation and nothing removed them, so they accumulated in
// $TMPDIR — 118 by 2026-09-15. `afterAll` at preload scope is the only hook that fires here:
// under Bun 1.2.9's test runner `process.on('exit')` and `'beforeExit'` never run, measured
// with a probe preload that logged from all three. It fires once for the whole run, not once
// per file, so the sandbox outlives every test that shares it.
afterAll(async () => {
  await rm(sandbox, { recursive: true, force: true });
});
