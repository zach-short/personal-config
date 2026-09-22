/**
 * One person, two shapes of target (PASSOFF item 54). `usesGit` is a fact about the *person* —
 * "will you use this config in git repos at all?" (setup-tracks `DESIGN.md` D4) — so somebody
 * with one repo and one plain folder answers `yes`, truthfully, and every per-target renderer
 * then read that answer where the target's own `kind` is what applies. The folder was handed a
 * router telling it never to run `git commit` and a standard whose Part 0 was never told to cut
 * the worktree part. Nothing errored and every gate stayed green.
 *
 * D5 gave the scan a `kind` for exactly this, and `renderIgnore` already tested `trackMode`
 * first (`src/render/repo.ts`), which is why no folder has ever been planned a
 * `.git/info/exclude`. These are the four sites that were still reading the person's answer.
 *
 * The rule the fix writes down: **git content is rendered only when the target is a git repo
 * *and* the person's answer is not `no`.** A folder never gets it; a repo belonging to someone
 * who keeps nothing in git does not get it either, because an answer given is honoured.
 *
 * A separate file from `folder-render.test.ts` so this lane does not edit one another lane owns.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { planRepo } from '../src/commands/setup.ts';
import { defaultsPrompter } from '../src/lib/ask.ts';
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

/** The router's commit line, from `commitRuleLine` under the default `print-blocks` policy. */
const COMMIT_LINE = 'Never run `git commit`, `git push`, `git add -A`';

/** Part 11's generated commit paragraph. The boilerplate's own Part 11 is replaced wholesale. */
const COMMIT_POLICY = 'print exactly two copyable `bash` blocks';

/** Part 0's cut hint — the designed mechanism for removing Part 6 from a non-git target. */
const CUT_PART_SIX = 'Part 6 — parallel sessions, worktrees and the commit rules';

/** The short standard's conditional git section. */
const IN_GIT = '## If this work is in git';

const GIT_YES: Answers = { ...DEFAULT_ANSWERS, usesGit: 'yes', archiveHome: '' };
const GIT_NO: Answers = { ...DEFAULT_ANSWERS, usesGit: 'no', archiveHome: '' };
const LIGHT_GIT_YES: Answers = { ...GIT_YES, configWeight: 'light' };

function folderScan(dir: string): RepoScan {
  return testScan({
    kind: 'folder',
    name: 'accounts',
    path: dir,
    remoteOwner: null,
    languages: [],
    packageManager: null,
    hasCi: false,
  });
}

function gitScan(dir: string): RepoScan {
  return testScan({ kind: 'git', name: 'ledger-app', path: dir, remoteOwner: 'me' });
}

/**
 * The real path from a scan to a plan, so `trackMode` is what `planRepo` records rather than
 * what a test asserted it would be. `planRepo` copies the shared answers back into the object
 * it is handed, so it gets a copy and the constants above stay constant.
 */
async function renderFor(
  scan: RepoScan,
  answers: Answers,
  login: string | null,
): Promise<PlannedFile[]> {
  const plan = await planRepo(scan, login, { ...answers }, testConfig(), defaultsPrompter());
  return renderAll(testContext(answers, plan));
}

function contentsAt(files: PlannedFile[], ...segments: string[]): string {
  const path = join(...segments);
  const found = files.find((f) => f.path === path);
  if (!found) throw new Error(`nothing planned at ${path}`);
  return found.contents;
}

describe('a folder target is rendered as a folder, whatever the person answered', () => {
  test('violates: the router hands a folder a rule about `git commit`', async () => {
    const dir = await tempDir('pc-mixed-');
    try {
      const files = await renderFor(folderScan(dir), GIT_YES, null);

      expect(contentsAt(files, dir, 'CLAUDE.md')).not.toContain(COMMIT_LINE);
    } finally {
      await cleanup(dir);
    }
  });

  test('violates: the standard hands a folder a commit policy for Part 11', async () => {
    const dir = await tempDir('pc-mixed-');
    try {
      const files = await renderFor(folderScan(dir), GIT_YES, null);

      expect(contentsAt(files, dir, 'docs', 'AGENT-PRACTICES.md')).not.toContain(COMMIT_POLICY);
    } finally {
      await cleanup(dir);
    }
  });

  test('violates: Part 0 is never told Part 6 is a candidate to cut', async () => {
    const dir = await tempDir('pc-mixed-');
    try {
      const files = await renderFor(folderScan(dir), GIT_YES, null);
      const part0 = contentsAt(files, dir, 'PART0-PROMPT.md');

      expect(part0).toContain(CUT_PART_SIX);
      expect(part0).not.toContain(COMMIT_LINE);
    } finally {
      await cleanup(dir);
    }
  });

  test('violates: the short standard keeps its git section for a folder', async () => {
    const dir = await tempDir('pc-mixed-');
    try {
      const files = await renderFor(folderScan(dir), LIGHT_GIT_YES, null);

      expect(contentsAt(files, dir, 'docs', 'AGENT-PRACTICES.md')).not.toContain(IN_GIT);
    } finally {
      await cleanup(dir);
    }
  });

  /**
   * The boundary, pinned so it is not mistaken for an oversight. Part 6's own text is *not* cut
   * from the long standard by any of the four sites, and `{{WORKTREE_SETUP}}` is one of the two
   * placeholders Part 0 owns. §3.1 row 2 says a non-git code target renders "the output minus
   * the commit rules" — not minus Part 6 — and the Part 0 cut hint above is the mechanism the
   * design chose for the rest. A session that wants Part 6 gone reads that hint and cuts it.
   */
  test('passes: Part 6 still ships, and the cut hint is what says to remove it', async () => {
    const dir = await tempDir('pc-mixed-');
    try {
      const files = await renderFor(folderScan(dir), GIT_YES, null);
      const standard = contentsAt(files, dir, 'docs', 'AGENT-PRACTICES.md');

      expect(standard).toContain('# Part 6 — Parallel sessions');
      expect(standard).toContain('{{WORKTREE_SETUP}}');
      expect(contentsAt(files, dir, 'PART0-PROMPT.md')).toContain(CUT_PART_SIX);
    } finally {
      await cleanup(dir);
    }
  });

  /** The precedent this fix copies: a folder never gets an ignore file (DIAL-11). */
  test('passes: no ignore file is planned for a folder, git answer or not', async () => {
    const dir = await tempDir('pc-mixed-');
    try {
      const files = await renderFor(folderScan(dir), GIT_YES, null);
      const paths = files.map((f) => f.path);

      expect(paths).not.toContain(join(dir, '.gitignore'));
      expect(paths.filter((p) => p.includes('/.git/'))).toEqual([]);
    } finally {
      await cleanup(dir);
    }
  });
});

describe('a git target under `usesGit: no` still honours the answer given', () => {
  /**
   * The resolved half of item 54. The target really is a repository, so `kind` alone would
   * render git content into it — but the person said they keep nothing in git, and an answer
   * given is not overruled by what the filesystem happens to show. The rule is written
   * `usesGit !== 'no'` rather than `=== 'yes'`, matching `track-mode`'s `isNot` spec, so a third
   * answer added later (item 58) reads as "not no" rather than silently suppressing everything.
   */
  test('passes: no commit rule, no commit policy, no ignore file, and Part 0 is told to cut', async () => {
    const dir = await tempDir('pc-mixed-');
    try {
      const files = await renderFor(gitScan(dir), GIT_NO, 'me');
      const paths = files.map((f) => f.path);

      expect(contentsAt(files, dir, 'CLAUDE.md')).not.toContain(COMMIT_LINE);
      expect(contentsAt(files, dir, 'docs', 'AGENT-PRACTICES.md')).not.toContain(COMMIT_POLICY);
      expect(contentsAt(files, dir, 'PART0-PROMPT.md')).toContain(CUT_PART_SIX);
      expect(paths).not.toContain(join(dir, '.gitignore'));
    } finally {
      await cleanup(dir);
    }
  });

  test('passes: the short standard cuts its git section when the answer is no', async () => {
    const dir = await tempDir('pc-mixed-');
    try {
      const files = await renderFor(gitScan(dir), { ...GIT_NO, configWeight: 'light' }, 'me');

      expect(contentsAt(files, dir, 'docs', 'AGENT-PRACTICES.md')).not.toContain(IN_GIT);
    } finally {
      await cleanup(dir);
    }
  });
});

describe('a git target under `usesGit: yes` is unchanged', () => {
  /**
   * The regression guard the other two describes need. Every assertion above is a *removal*, and
   * a fix that removed git content from everything would pass all of them.
   */
  test('passes: the repo still gets the commit rule, the policy and an ignore file', async () => {
    const dir = await tempDir('pc-mixed-');
    try {
      const files = await renderFor(gitScan(dir), GIT_YES, 'me');

      expect(contentsAt(files, dir, 'CLAUDE.md')).toContain(COMMIT_LINE);
      expect(contentsAt(files, dir, 'docs', 'AGENT-PRACTICES.md')).toContain(COMMIT_POLICY);
      expect(contentsAt(files, dir, 'PART0-PROMPT.md')).not.toContain(CUT_PART_SIX);
      expect(files.map((f) => f.path)).toContain(join(dir, '.gitignore'));
    } finally {
      await cleanup(dir);
    }
  });
});
