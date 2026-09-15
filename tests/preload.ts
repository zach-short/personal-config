/**
 * Tests must never touch the real `~/.claude` or `~/.config`. `os.homedir()` honours `$HOME`
 * on POSIX, so redirecting it here makes every global renderer write into a throwaway tree
 * with no test-only branch anywhere in the engine.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sandbox = mkdtempSync(join(tmpdir(), 'pc-home-'));
process.env.HOME = sandbox;
process.env.PERSONAL_CONFIG_TEST_HOME = sandbox;
