/**
 * Board item 96: a profile's Light model name reached the rendered files as `<unset>`. The
 * profile is the promise that `--yes` reproduces a person's setup, so this runs the real bin on
 * the `zach` profile in a sandbox `HOME` and reads the tier table it wrote. The expected name is
 * read from the profile file, so the profile can move to another model without editing this.
 */
import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from '../src/lib/paths.ts';
import { cleanup, tempDir } from './helpers.ts';

const CLI = join(repoRoot(), 'src', 'cli.ts');

async function profileLight(): Promise<string> {
  const raw = await readFile(join(repoRoot(), 'profiles', 'zach.json'), 'utf8');
  return JSON.parse(raw).models.light;
}

async function setupZach(home: string, projects: string) {
  const args = ['setup', '--profile', 'zach', '--yes', '--force', '--projects-dir', projects];
  const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
    cwd: repoRoot(),
    env: { ...process.env, HOME: home },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stderr = await new Response(proc.stderr).text();
  return { code: await proc.exited, stderr };
}

describe('the zach profile under --yes', () => {
  test('names the profile Light model in the tier table and the saved config', async () => {
    const light = await profileLight();
    expect(light).not.toBe('');
    const home = await tempDir('pc-home-');
    const projects = await tempDir('pc-projects-');
    try {
      const result = await setupZach(home, projects);
      expect(result.stderr).toBe('');
      expect(result.code).toBe(0);

      const routing = await readFile(
        join(home, '.claude', 'rules', 'model-routing.md'),
        'utf8',
      );
      expect(routing).toContain(`| Light | ${light} |`);

      const saved = join(home, '.config', 'personal-config', 'config.json');
      const config = JSON.parse(await readFile(saved, 'utf8'));
      expect(config.models.light).toBe(light);
    } finally {
      await cleanup(home);
      await cleanup(projects);
    }
  });
});
