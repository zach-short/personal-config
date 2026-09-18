import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `$HOME` wins over `os.homedir()`, which is what a POSIX CLI is expected to do — and it is
 * what lets the test suite run against a throwaway home without a test-only branch in here.
 */
export function home(): string {
  return process.env.HOME ?? homedir();
}

/** `~/foo` → `/Users/you/foo`. Written paths are stored with `~` so a config is portable. */
export function expandHome(input: string): string {
  if (input === '~') return home();
  if (input.startsWith('~/')) return join(home(), input.slice(2));
  return input;
}

export function contractHome(input: string): string {
  const dir = home();
  return input.startsWith(dir) ? `~${input.slice(dir.length)}` : input;
}

export function configDir(): string {
  return join(home(), '.config', 'personal-config');
}

export function configFile(): string {
  return join(configDir(), 'config.json');
}

export function backupsDir(): string {
  return join(configDir(), 'backups');
}

export function claudeDir(): string {
  return join(home(), '.claude');
}

export function claudeRulesDir(): string {
  return join(claudeDir(), 'rules');
}

export function claudeSkillsDir(): string {
  return join(claudeDir(), 'skills');
}

export function claudeSettingsFile(): string {
  return join(claudeDir(), 'settings.json');
}

/**
 * Where the generated hook scripts go. A function like every other path here, and for the same
 * reason: `home()` reads `$HOME` at call time. `src/render/hooks.ts` held this as a
 * module-level `const` until 2026-09-17, which froze it against whatever `$HOME` was when the
 * module graph first loaded — so a caller that moved `$HOME` afterwards, which is exactly what
 * the suite's `inTempHome` does, kept writing to the old one. Harmless while the old one was
 * also a sandbox, and an `X2` breach the first time it was not.
 */
export function claudeHooksDir(): string {
  return join(claudeDir(), 'hooks', 'personal-config');
}

/**
 * The directory this CLI was installed into — where `standard/` and `templates/` live.
 *
 * Found by walking up to the nearest `package.json` rather than by counting `..` segments,
 * because the two layouts sit at different depths: a checkout runs this file from `src/lib/`,
 * and the published bin is one bundled file at `dist/cli.js`. A fixed count is wrong in one of
 * them, and wrong here resolves to `node_modules/` — which surfaces much later as a missing
 * profile or template rather than as a crash at startup.
 *
 * `import.meta.url` rather than `import.meta.dir`: the latter is Bun's, and this runs on Node.
 */
export function repoRoot(): string {
  const start = dirname(fileURLToPath(import.meta.url));
  let dir = start;
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`No package.json above ${start}`);
    dir = parent;
  }
  return dir;
}

/**
 * The harness names a project's transcript directory after its working directory, one `-` per
 * character it cannot use. Built here rather than spelled inline at the call site so that the
 * test suite's `$HOME` redirection keeps holding — `X2`.
 */
export function claudeProjectsDir(cwd: string): string {
  return join(claudeDir(), 'projects', projectSlug(cwd));
}

export function projectSlug(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, '-');
}
