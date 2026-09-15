import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { parseCli } from '../src/lib/args.ts';
import { configHash, loadConfig } from '../src/lib/config.ts';
import { configFile } from '../src/lib/paths.ts';
import { cleanup, tempDir, testConfig } from './helpers.ts';

describe('profile merge', () => {
  test('starter is the floor', async () => {
    const config = await loadConfig(parseCli(['setup']), null);
    expect(config.profile).toBe('starter');
    expect(config.answers.commitPolicy).toBe('print-blocks');
  });

  test('--profile overrides starter', async () => {
    const config = await loadConfig(parseCli(['setup', '--profile', 'zach']), null);
    expect(config.models.default).toBe('Opus 5');
  });

  test('an unknown profile is an error, not a silent starter', async () => {
    expect(loadConfig(parseCli(['setup', '--profile', 'nope']), null)).rejects.toThrow('nope');
  });

  test('a per-repo .personal-config.json outranks the named profile', async () => {
    const dir = await tempDir();
    try {
      await Bun.write(
        join(dir, '.personal-config.json'),
        JSON.stringify({ models: { default: 'From The Repo' } }),
      );
      const config = await loadConfig(parseCli(['setup', '--profile', 'zach']), dir);
      expect(config.models.default).toBe('From The Repo');
      // Untouched keys still come from the profile below it.
      expect(config.models.deep).toBe('Fable 5.1');
    } finally {
      await cleanup(dir);
    }
  });

  test('the saved user config outranks the named profile and is outranked by the repo', async () => {
    await Bun.write(configFile(), JSON.stringify({ models: { default: 'From User Config' } }));
    const dir = await tempDir();
    try {
      const withoutRepo = await loadConfig(parseCli(['setup', '--profile', 'zach']), null);
      expect(withoutRepo.models.default).toBe('From User Config');

      await Bun.write(
        join(dir, '.personal-config.json'),
        JSON.stringify({ models: { default: 'From Repo' } }),
      );
      const withRepo = await loadConfig(parseCli(['setup', '--profile', 'zach']), dir);
      expect(withRepo.models.default).toBe('From Repo');
    } finally {
      await cleanup(dir);
      await Bun.write(configFile(), '{}');
    }
  });

  test('a CLI flag outranks every file', async () => {
    const dir = await tempDir();
    try {
      await Bun.write(
        join(dir, '.personal-config.json'),
        JSON.stringify({ projectsDir: '~/FromRepo' }),
      );
      const config = await loadConfig(parseCli(['setup', '--projects-dir', '/from/flag']), dir);
      expect(config.projectsDir).toBe('/from/flag');
    } finally {
      await cleanup(dir);
    }
  });
});

describe('config hash', () => {
  test('is stable across key order', async () => {
    const a = testConfig({ answers: { one: 'x', two: 'y' } });
    const b = testConfig({ answers: { two: 'y', one: 'x' } });
    expect(await configHash(a)).toBe(await configHash(b));
  });

  test('changes when an answer changes', async () => {
    const a = testConfig({ answers: { one: 'x' } });
    const b = testConfig({ answers: { one: 'z' } });
    expect(await configHash(a)).not.toBe(await configHash(b));
  });
});

describe('argument parsing', () => {
  test('flags and command', () => {
    const cli = parseCli(['setup', '--yes', '--dry-run', '--profile', 'zach']);
    expect(cli).toMatchObject({ command: 'setup', yes: true, dryRun: true, profile: 'zach' });
  });

  test('an unknown command falls back to help rather than running something', () => {
    expect(parseCli(['nonsense']).command).toBe('help');
    expect(parseCli([]).command).toBe('help');
  });

  test('doctor takes positional paths', () => {
    expect(parseCli(['doctor', 'a', 'b']).paths).toEqual(['a', 'b']);
  });
});
