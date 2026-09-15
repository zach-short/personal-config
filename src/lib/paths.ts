import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

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

/** The directory this CLI was installed into — where `standard/` and `templates/` live. */
export function repoRoot(): string {
  return resolve(import.meta.dir, '..', '..');
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
