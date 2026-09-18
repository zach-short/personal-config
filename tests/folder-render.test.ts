/**
 * What a plan for a plain directory writes — the half of setup-tracks `DESIGN.md` D5 that the
 * discovery tests in `folder-targets.test.ts` cannot see, and a separate file so this lane does
 * not edit one another lane has open. A folder has no `.git`, and a renderer that reaches for
 * `.git/info/exclude` anyway *creates* the directory it assumed: `writeText` makes parent
 * directories (`src/lib/disk.ts`), so the result was a `.git/` inside a folder that was never a
 * repository. Found 2026-09-17 by rendering a folder plan, which nothing had done before.
 */
import { describe, expect, test } from 'bun:test';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { planRepo } from '../src/commands/setup.ts';
import { defaultsPrompter } from '../src/lib/ask.ts';
import { isGitRepo } from '../src/lib/git.ts';
import type { Answers, RepoPlan } from '../src/lib/types.ts';
import { commitPlan, resolvePlan } from '../src/lib/write-plan.ts';
import { renderAll } from '../src/render/index.ts';
import {
  cleanup,
  clearSavedAnswers,
  DEFAULT_ANSWERS,
  tempDir,
  testConfig,
  testContext,
  testScan,
} from './helpers.ts';

const ANSWERS: Answers = { ...DEFAULT_ANSWERS, usesGit: 'no', archiveHome: '' };

/** The real path from a scanned folder to a plan, so `trackMode` is what `planRepo` records. */
async function folderPlan(dir: string): Promise<RepoPlan> {
  const scan = testScan({
    kind: 'folder',
    name: 'accounts',
    path: dir,
    remoteOwner: null,
    languages: [],
    packageManager: null,
    hasCi: false,
  });
  return planRepo(scan, null, ANSWERS, testConfig(), defaultsPrompter());
}

describe('a folder plan never reaches into a .git that is not there', () => {
  test('violates: no planned path has a `.git/` segment, and no ignore file is planned', async () => {
    const dir = await tempDir('pc-folder-');
    try {
      const files = await renderAll(testContext(ANSWERS, await folderPlan(dir)));
      const paths = files.map((f) => f.path);

      expect(paths.filter((p) => p.includes('/.git/'))).toEqual([]);
      expect(paths).not.toContain(join(dir, '.gitignore'));
      // Nothing is tracked or untracked here, so the plain names apply.
      expect(paths).toContain(join(dir, 'CLAUDE.md'));
      expect(paths).toContain(join(dir, 'docs', 'AGENT-PRACTICES.md'));
      expect(paths).not.toContain(join(dir, 'CLAUDE.local.md'));
      expect(paths).not.toContain(join(dir, 'AGENT-PRACTICES.local.md'));
    } finally {
      await cleanup(dir);
    }
  });

  test('violates: committing the plan leaves the folder a folder — no `.git` appears on disk', async () => {
    const dir = await tempDir('pc-folder-');
    try {
      const files = await renderAll(testContext(ANSWERS, await folderPlan(dir)));
      await commitPlan(await resolvePlan(files));

      expect(await stat(join(dir, '.git')).catch(() => null)).toBeNull();
      expect(await isGitRepo(dir)).toBe(false);
      expect(await stat(join(dir, 'CLAUDE.md')).then((s) => s.isFile())).toBe(true);
    } finally {
      await cleanup(dir);
      await clearSavedAnswers();
    }
  });

  test('passes: the router is a router, in neither the tracked nor the untracked wording', async () => {
    const dir = await tempDir('pc-folder-');
    try {
      const files = await renderAll(testContext(ANSWERS, await folderPlan(dir)));
      const router = files.find((f) => f.path === join(dir, 'CLAUDE.md'));

      expect(router?.label).toBe('router');
      expect(router?.contents).not.toContain('untracked');
      expect(router?.contents).toContain('`docs/AGENT-PRACTICES.md`');
    } finally {
      await cleanup(dir);
    }
  });
});
