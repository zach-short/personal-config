/**
 * `haiku-tier` D1: Light, the opt-in fourth tier below Mechanical. A file of its own rather than
 * lines appended to a suite another lane owns (X1). Three properties, each on and off:
 *
 * - The `model-light` question is asked only when `modelLightEnabled` is `'yes'`, never on the
 *   weight gate alone (unlike `model-deep`/`model-fast`, and unlike `model-light-enabled` itself).
 * - `model-routing.md`'s table grows a fourth row only under the same condition.
 * - Mechanical's row and Light's row do not share the same worked example — the duplication D1
 *   exists to prevent.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { planRepo } from '../src/commands/setup.ts';
import { defaultsPrompter } from '../src/lib/ask.ts';
import { claudeRulesDir } from '../src/lib/paths.ts';
import type { Answers, PlannedFile, RepoScan } from '../src/lib/types.ts';
import { matchesWhen } from '../src/lib/when.ts';
import { questionsFor } from '../src/questions/index.ts';
import { renderAll } from '../src/render/index.ts';
import {
  cleanup,
  DEFAULT_ANSWERS,
  tempDir,
  testConfig,
  testContext,
  testScan,
} from './helpers.ts';

const FULL: Answers = {
  ...DEFAULT_ANSWERS,
  workKind: 'code',
  configWeight: 'full',
  usesGit: 'yes',
};

function gitScan(dir: string): RepoScan {
  return testScan({ kind: 'git', name: 'accounts', path: dir, remoteOwner: 'me' });
}

/** `config.models` names the tiers, independent of `answers` — `planRepo` and `testContext`
 * both take it explicitly, so a test naming Light's model passes it here, not in `answers`. */
async function renderFor(
  dir: string,
  answers: Answers,
  config = testConfig(),
): Promise<PlannedFile[]> {
  const plan = await planRepo(gitScan(dir), 'me', { ...answers }, config, defaultsPrompter());
  return renderAll(testContext(answers, plan, config));
}

function ruleContents(files: PlannedFile[]): string {
  const found = files.find((f) => f.path === join(claudeRulesDir(), 'model-routing.md'));
  if (!found) throw new Error('model-routing.md was not planned');
  return found.contents;
}

describe('the model-light question is gated on the opt-in, not the weight alone', () => {
  const question = questionsFor('you').find((q) => q.id === 'model-light');

  test('unset defaults to not asked, even on the full weight', () => {
    expect(matchesWhen(question?.when, { configWeight: 'full' })).toBe(false);
  });

  test('a `no` is the same as unset', () => {
    expect(matchesWhen(question?.when, { configWeight: 'full', modelLightEnabled: 'no' })).toBe(
      false,
    );
  });

  test('`yes` on the full weight is the one case that asks it', () => {
    expect(
      matchesWhen(question?.when, { configWeight: 'full', modelLightEnabled: 'yes' }),
    ).toBe(true);
  });

  test('`yes` on a light weight still does not — there is no table for the row to join', () => {
    expect(
      matchesWhen(question?.when, { configWeight: 'light', modelLightEnabled: 'yes' }),
    ).toBe(false);
  });
});

describe('the fourth row rides on the opt-in answer', () => {
  test('not opted in: three rows, no mention of Light', async () => {
    const dir = await tempDir('pc-light-');
    try {
      const rule = ruleContents(await renderFor(dir, FULL));
      expect(rule).toContain('| Mechanical |');
      expect(rule).not.toContain('| Light |');
    } finally {
      await cleanup(dir);
    }
  });

  test('opted in: a fourth row, naming the Light model', async () => {
    const dir = await tempDir('pc-light-');
    try {
      const rule = ruleContents(await renderFor(dir, { ...FULL, modelLightEnabled: 'yes' }));
      // `testConfig()`'s default names Light `'Light Model'`, the same way the pre-existing
      // gated-answers tests check for `'Deep Model'`/`'Fast Model'` rather than passing a name
      // through `answers` — `config.models` is what the renderer reads.
      expect(rule).toContain('| Light | Light Model |');
    } finally {
      await cleanup(dir);
    }
  });

  test('opted in but no model named: the row still appears, `<unset>` and all', async () => {
    const dir = await tempDir('pc-light-');
    const noLightName = testConfig({
      models: { deep: 'Deep Model', default: 'Default Model', fast: 'Fast Model', light: '' },
    });
    try {
      const rule = ruleContents(
        await renderFor(dir, { ...FULL, modelLightEnabled: 'yes' }, noLightName),
      );
      expect(rule).toContain('| Light | <unset> |');
    } finally {
      await cleanup(dir);
    }
  });
});

describe('Mechanical and Light do not claim the same worked example', () => {
  test('the phrase that moved to Light is not still in Mechanical’s row', async () => {
    const dir = await tempDir('pc-light-');
    try {
      const rule = ruleContents(await renderFor(dir, { ...FULL, modelLightEnabled: 'yes' }));
      const mechanicalRow = rule.split('\n').find((line) => line.startsWith('| Mechanical |'));
      const lightRow = rule.split('\n').find((line) => line.startsWith('| Light |'));
      expect(mechanicalRow).not.toContain('read-only');
      expect(lightRow).toContain('read-only');
    } finally {
      await cleanup(dir);
    }
  });
});
