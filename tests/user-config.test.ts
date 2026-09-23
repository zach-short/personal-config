import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { parseCli } from '../src/lib/args.ts';
import { configHash, loadConfig, personalAnswers } from '../src/lib/config.ts';
import { configFile } from '../src/lib/paths.ts';
import { renderUserConfig } from '../src/render/user-config.ts';
import { cleanup, DEFAULT_ANSWERS, tempDir, testConfig, testContext } from './helpers.ts';

/**
 * Every write here lands under the throwaway `$HOME` `tests/preload.ts` sets (`X2`).
 * `configFile()` resolves through `src/lib/paths.ts`, which reads `$HOME` itself, so the real
 * `~/.config` is unreachable from this file by construction rather than by care.
 */
async function withSavedConfig<T>(body: unknown, run: () => Promise<T>): Promise<T> {
  await Bun.write(configFile(), `${JSON.stringify(body, null, 2)}\n`);
  try {
    return await run();
  } finally {
    await Bun.write(configFile(), '{}');
  }
}

describe('which answers are the person’s', () => {
  test('keeps the person’s answers and drops the repo’s', () => {
    const saved = personalAnswers({
      ...DEFAULT_ANSWERS,
      'models.deep': 'Deep Model',
      archiveHome: '~/elsewhere/<repo>',
      projectsDir: '/somewhere',
      tracker: 'linear',
    });

    expect(Object.keys(saved)).toContain('commitPolicy');
    expect(Object.keys(saved)).toContain('models.deep');
    expect(Object.keys(saved)).toContain('skills');
    expect(Object.keys(saved)).not.toContain('workProfile');
    expect(Object.keys(saved)).not.toContain('trackMode');
    expect(Object.keys(saved)).not.toContain('archiveHome');
    expect(Object.keys(saved)).not.toContain('projectsDir');
    expect(Object.keys(saved)).not.toContain('tracker');
  });

  test('no practices.* answer is ever saved for the person', () => {
    const saved = personalAnswers(DEFAULT_ANSWERS);
    const practices = Object.keys(saved).filter((key) => key.startsWith('practices.'));
    expect(practices).toEqual([]);
    // The fixture really does carry some, or the assertion above proves nothing.
    expect(Object.keys(DEFAULT_ANSWERS).some((k) => k.startsWith('practices.'))).toBe(true);
  });

  test('the key order is stable, so the file diffs cleanly across runs', () => {
    const forward = personalAnswers({ skills: 'none', attribution: 'none', hooks: 'none' });
    const backward = personalAnswers({ hooks: 'none', attribution: 'none', skills: 'none' });
    expect(Object.keys(forward)).toEqual(Object.keys(backward));
    expect(Object.keys(forward)).toEqual(['attribution', 'hooks', 'skills']);
  });
});

describe('the saved config renderer', () => {
  test('plans one unstamped file at the user config path', () => {
    const files = renderUserConfig(testContext(DEFAULT_ANSWERS));
    expect(files).toHaveLength(1);

    const file = files[0];
    if (!file) throw new Error('renderUserConfig planned nothing');
    expect(file.path).toBe(configFile());
    expect(file.strategy).toBe('overwrite');
    // A stamp would make an input to rendering look like an output of it.
    expect(file.contents.startsWith('{')).toBe(true);

    const parsed = JSON.parse(file.contents) as {
      models: unknown;
      answers: Record<string, unknown>;
    };
    expect(parsed.answers.commitPolicy).toBe('print-blocks');
    expect(parsed.answers['practices.comments']).toBeUndefined();
    expect(parsed.models).toEqual({
      deep: 'Deep Model',
      default: 'Default Model',
      fast: 'Fast Model',
      light: 'Light Model',
    });
  });

  test('plans nothing when no answer belongs to the person', () => {
    expect(renderUserConfig(testContext({ 'practices.comments': 'why-only' }))).toEqual([]);
  });

  test('what it writes is what loadConfig reads back', async () => {
    const files = renderUserConfig(testContext(DEFAULT_ANSWERS));
    const file = files[0];
    if (!file) throw new Error('renderUserConfig planned nothing');

    await withSavedConfig(JSON.parse(file.contents), async () => {
      const config = await loadConfig(parseCli(['setup']), null);
      expect(config.answers.commitPolicy).toBe('print-blocks');
      expect(config.models.default).toBe('Default Model');
    });
  });
});

describe('the saved layer’s rank in the merge', () => {
  test('a saved answer outranks the profile and is outranked by the repo', async () => {
    const dir = await tempDir();
    try {
      await withSavedConfig({ answers: { commitPolicy: 'from-user-config' } }, async () => {
        const withoutRepo = await loadConfig(parseCli(['setup', '--profile', 'zach']), null);
        expect(withoutRepo.answers.commitPolicy).toBe('from-user-config');

        await Bun.write(
          join(dir, '.personal-config.json'),
          JSON.stringify({ answers: { commitPolicy: 'from-the-repo' } }),
        );
        const withRepo = await loadConfig(parseCli(['setup', '--profile', 'zach']), dir);
        expect(withRepo.answers.commitPolicy).toBe('from-the-repo');
      });
    } finally {
      await cleanup(dir);
    }
  });
});

/**
 * HANDOFF 5's constraint, pinned as a test rather than argued. The saved layer may not move a
 * configured repo's stamp — and the reason it cannot is structural: `setup` saves the whole
 * hashed set into `.personal-config.json`, which outranks the user config for every key it
 * holds. The second test is the other half, and the one that would actually bite: a key no
 * repo has saved *is* a new hash input.
 */
describe('the saved layer and the config hash', () => {
  const repoAnswers = { commitPolicy: 'print-blocks', attribution: 'none' };
  const tiers = { deep: 'Deep Model', default: 'Default Model', fast: 'Fast Model' };

  test('a saved answer the repo already holds cannot move the stamp', async () => {
    const dir = await tempDir();
    try {
      await Bun.write(
        join(dir, '.personal-config.json'),
        JSON.stringify({ models: tiers, answers: repoAnswers, archiveHome: '' }),
      );
      // The hash a repo rendered with these answers was stamped with.
      const before = await configHash(await loadConfig(parseCli(['setup']), dir));

      // The person now saves a *different* value for a key that repo already holds.
      await withSavedConfig({ answers: { commitPolicy: 'agent-commits' } }, async () => {
        const after = await configHash(await loadConfig(parseCli(['setup']), dir));
        expect(after).toBe(before);
      });
    } finally {
      await cleanup(dir);
    }
  });

  test('a saved key no repo has seen does move the stamp — which is why the set is an allowlist', async () => {
    const asRendered = await configHash(testConfig({ answers: repoAnswers }));
    const withNewKey = { ...repoAnswers, somethingNoRepoSaved: 'yes' };
    expect(await configHash(testConfig({ answers: withNewKey }))).not.toBe(asRendered);
  });

  test('the model tier answers stay out of the hash even when the person saves them', async () => {
    const base = await configHash(testConfig({ answers: repoAnswers }));
    const withTiers = {
      ...repoAnswers,
      'models.deep': 'Deep Model',
      'models.fast': 'Fast Model',
    };
    expect(await configHash(testConfig({ answers: withTiers }))).toBe(base);
  });
});
