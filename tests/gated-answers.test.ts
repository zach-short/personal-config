/**
 * PASSOFF item 56 stopped seven questions being asked on the tracks that discard them. Item 62
 * found `commit-policy`'s gate was one of the seven but should not have been: `commitRuleLine`
 * is read by `repo.ts`, `standard.ts` and `short-standard.ts` for any git target, non-code
 * included, so gating the question on `code` too silently defaulted a non-code-in-git run
 * instead of asking it — a real loss of choice, corrected by gating on git alone. Six of the
 * seven remain cut for a non-code track; `commit-policy` is not one of them where git is in
 * play. Two properties have to survive the cut that remains, and neither is visible from
 * `catalog.json`:
 *
 * **DIAL-7.** A question that is no longer asked still has a *stored* answer honoured. Profiles
 * saved before this row (or before item 62, for `commit-policy` specifically) carry answers to
 * all seven, and a renderer that still reads one must keep reading it — the cut is to the
 * asking, never to the rendering.
 *
 * **The one condition that is not the short-track negation.** `model-deep`, `model-fast` and
 * `model-routing` are gated on the weight alone rather than on `code && full`, because
 * `src/render/rules.ts` writes `model-routing.md` whenever the weight is full — non-code
 * included (setup-tracks `DESIGN.md` §3.1 row 4, D6). Tightening them to the conjunction would
 * stop asking a non-code person for tiers their own rule file still prints, and the table would
 * render `<unset>`. That is what the second test here would catch.
 *
 * A file of its own rather than lines appended to a suite another lane owns (X1).
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { planRepo } from '../src/commands/setup.ts';
import { defaultsPrompter } from '../src/lib/ask.ts';
import { claudeRulesDir } from '../src/lib/paths.ts';
import type { Answers, PlannedFile, RepoScan } from '../src/lib/types.ts';
import { renderAll } from '../src/render/index.ts';
import {
  cleanup,
  DEFAULT_ANSWERS,
  tempDir,
  testConfig,
  testContext,
  testScan,
} from './helpers.ts';

/** A non-code person keeping their work in a git repo of their own. */
const NON_CODE_IN_GIT: Answers = {
  ...DEFAULT_ANSWERS,
  workKind: 'non-code',
  configWeight: 'full',
  usesGit: 'yes',
  archiveHome: '',
};

function gitScan(dir: string): RepoScan {
  return testScan({ kind: 'git', name: 'accounts', path: dir, remoteOwner: 'me' });
}

async function renderFor(dir: string, answers: Answers): Promise<PlannedFile[]> {
  const plan = await planRepo(
    gitScan(dir),
    'me',
    { ...answers },
    testConfig(),
    defaultsPrompter(),
  );
  return renderAll(testContext(answers, plan));
}

function contentsAt(files: PlannedFile[], path: string): string {
  const found = files.find((f) => f.path === path);
  if (!found) throw new Error(`nothing planned at ${path}`);
  return found.contents;
}

describe('an answer that is no longer asked for is still honoured', () => {
  test('a stored `agent-commits` reaches a non-code router', async () => {
    const dir = await tempDir('pc-gated-');
    try {
      // `NON_CODE_IN_GIT` is now asked `commit-policy` itself (item 62) — this pins the
      // renderer's read of the answer, independent of whether this run's own catalog would
      // have asked for it, which is what a profile saved by an older catalog also needs.
      const files = await renderFor(dir, { ...NON_CODE_IN_GIT, commitPolicy: 'agent-commits' });

      const router = contentsAt(files, join(dir, 'CLAUDE.md'));
      expect(router).toContain('Commit in small slices');
      expect(router).not.toContain('Never run `git commit`');
    } finally {
      await cleanup(dir);
    }
  });

  test('the default is what an unanswered one falls back to, not an empty line', async () => {
    const dir = await tempDir('pc-gated-');
    try {
      // Simulates a profile from before the question existed at all, not a cut — item 62
      // means a fresh `NON_CODE_IN_GIT` run asks this one, but an old saved profile can still
      // lack the key, and the renderer must not blank the line for that.
      const { commitPolicy: _dropped, ...unanswered } = NON_CODE_IN_GIT;
      const files = await renderFor(dir, unanswered);

      expect(contentsAt(files, join(dir, 'CLAUDE.md'))).toContain('Never run `git commit`');
    } finally {
      await cleanup(dir);
    }
  });
});

describe('why the model questions are gated on the weight alone', () => {
  test('non-code + full still writes `model-routing.md`, so it is still asked for the tiers', async () => {
    const dir = await tempDir('pc-gated-');
    try {
      const files = await renderFor(dir, {
        ...NON_CODE_IN_GIT,
        modelRouting: 'delegate-or-stop',
      });

      // `testConfig` names the three tiers; the table prints `<unset>` for any that are empty,
      // which is exactly what cutting these questions from this shape would have produced.
      const rule = contentsAt(files, join(claudeRulesDir(), 'model-routing.md'));
      expect(rule).toContain('Deep Model');
      expect(rule).toContain('Fast Model');
      expect(rule).not.toContain('<unset>');
    } finally {
      await cleanup(dir);
    }
  });

  test('a light setup writes no such file, which is what the weight gate is for', async () => {
    const dir = await tempDir('pc-gated-');
    try {
      const files = await renderFor(dir, { ...NON_CODE_IN_GIT, configWeight: 'light' });

      expect(files.map((f) => f.path)).not.toContain(
        join(claudeRulesDir(), 'model-routing.md'),
      );
    } finally {
      await cleanup(dir);
    }
  });
});
