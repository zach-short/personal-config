/**
 * Discovery accepts plain directories, tagged (setup-tracks `DESIGN.md` D5), and the two
 * obligations that decision carries: the listing stays readable when the scan is pointed
 * somewhere broad (DIAL-10), and `trackMode` gets a real answer for a folder rather than a
 * silent skip (DIAL-11).
 *
 * The third thing here has no dial and is the one with judgement in it: **what makes a plain
 * directory a candidate at all.** Without the `isGitRepo` filter every directory one level
 * down qualifies, so these pin both halves — what the rule admits and what it keeps out.
 */

import { describe, expect, test } from 'bun:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { planRepo } from '../src/commands/setup.ts';
import type { Prompter } from '../src/lib/ask.ts';
import { scanProjectsDir } from '../src/lib/discover.ts';
import type { Answers, AnswerValue, Question, RepoScan } from '../src/lib/types.ts';
import { targetList } from '../src/lib/ui.ts';
import { cleanup, DEFAULT_ANSWERS, tempDir, testConfig, testScan } from './helpers.ts';

/** A folder with one file in it, which is the whole of what the admission rule asks for. */
async function folder(root: string, name: string, file = 'notes.md'): Promise<void> {
  await Bun.write(join(root, name, file), 'x\n');
}

/** Records which questions were actually put to a person, and answers from the fallback. */
function tracingPrompter(): { prompter: Prompter; asked: string[] } {
  const asked: string[] = [];
  const prompter: Prompter = {
    async ask(question: Question, fallback: AnswerValue) {
      asked.push(question.id);
      return fallback;
    },
    async confirm(_message: string, fallback: boolean) {
      return fallback;
    },
  };
  return { prompter, asked };
}

describe('what makes a plain directory a candidate', () => {
  test('a folder with something in it is a target; a tool’s directory and an empty one are not', async () => {
    const root = await tempDir();
    try {
      await folder(root, 'accounts-2026', 'reconciliation.md');
      await folder(root, 'lecture-notes');
      // The generated counterparts of markers the scanner already reads.
      await folder(root, 'node_modules', 'left-pad.js');
      await folder(root, 'dist', 'bundle.js');
      await folder(root, 'target', 'debug.bin');
      await folder(root, '__pycache__', 'mod.pyc');
      // Empty of anything a person would see: nothing there to configure.
      await mkdir(join(root, 'brand-new'), { recursive: true });
      await Bun.write(join(root, 'only-noise', '.DS_Store'), '');
      // Hidden, which is the existing rule these two extend rather than replace.
      await Bun.write(join(root, '.cache', 'blob'), '');

      const scans = await scanProjectsDir(root);
      expect(scans.map((s) => s.name)).toEqual(['accounts-2026', 'lecture-notes']);
      expect(scans.map((s) => s.kind)).toEqual(['folder', 'folder']);
      // A folder has no remote and no worktrees, and must not borrow an enclosing repo's.
      expect(scans.map((s) => s.remoteOwner)).toEqual([null, null]);
      expect(scans.map((s) => s.worktrees)).toEqual([0, 0]);
    } finally {
      await cleanup(root);
    }
  });

  /**
   * The exclusion is consulted for plain directories only. A git repo is a candidate on the
   * strength of its `.git` whatever it is called — which is what it was at 0.2.6, and the
   * narrowest possible statement of the no-change promise for this rule.
   */
  test('a git repo is never excluded by name, however it is spelled', async () => {
    const root = await tempDir();
    try {
      await folder(root, 'node_modules', 'index.js');
      await Bun.write(join(root, 'node_modules', '.git', 'HEAD'), 'ref: refs/heads/main\n');

      const scans = await scanProjectsDir(root);
      expect(scans.map((s) => s.name)).toEqual(['node_modules']);
      expect(scans[0]?.kind).toBe('git');
    } finally {
      await cleanup(root);
    }
  });

  test('an empty git repo is still a target — `.git` is the declaration', async () => {
    const root = await tempDir();
    try {
      await Bun.write(join(root, 'fresh-repo', '.git', 'HEAD'), 'ref: refs/heads/main\n');
      await mkdir(join(root, 'fresh-folder'), { recursive: true });

      const scans = await scanProjectsDir(root);
      expect(scans.map((s) => s.name)).toEqual(['fresh-repo']);
    } finally {
      await cleanup(root);
    }
  });
});

describe('DIAL-10 — the listing stays readable when the scan is broad', () => {
  const folders = (count: number): RepoScan[] =>
    Array.from({ length: count }, (_, i) =>
      testScan({ kind: 'folder', name: `folder-${String(i).padStart(2, '0')}`, languages: [] }),
    );

  test('fifty folders list twelve and count the rest', () => {
    const listed = targetList(folders(50), '~/Documents');
    const rows = listed.split('\n').filter((l) => l.includes('folder-'));
    expect(rows.length).toBe(12);
    expect(listed).toContain('Found 50 folder(s) under ~/Documents:');
    expect(listed).toContain('  … and 38 more');
    expect(listed).toContain('folder-11');
    expect(listed).not.toContain('folder-12');
    // Readable is a claim about the whole screen, not the folder block alone.
    expect(listed.split('\n').length).toBeLessThan(20);
  });

  test('twelve or fewer are listed whole, with nothing summarised', () => {
    const listed = targetList(folders(12), '~/Documents');
    expect(listed).not.toContain('… and');
    expect(listed.split('\n').filter((l) => l.includes('folder-')).length).toBe(12);
  });

  test('a mixed scan counts both and caps only the folders', () => {
    const scans = [...folders(30), testScan({ name: 'a-repo' })];
    const listed = targetList(scans, '~/Documents');
    expect(listed).toContain('Found 1 repo(s) and 30 folder(s) under ~/Documents:');
    expect(listed).toContain('a-repo');
    expect(listed).toContain('  … and 18 more');
  });
});

describe('DIAL-11 — trackMode for a folder target', () => {
  const answers = (): Answers => ({ ...DEFAULT_ANSWERS, usesGit: 'yes', archiveHome: '' });

  test('the question is not asked, and `n/a` is recorded rather than nothing', async () => {
    const { prompter, asked } = tracingPrompter();
    const plan = await planRepo(
      testScan({ kind: 'folder', name: 'accounts', remoteOwner: null }),
      'someone',
      answers(),
      testConfig(),
      prompter,
    );

    expect(asked).not.toContain('track-mode');
    expect(plan.trackMode).toBe('n/a');
  });

  /**
   * The half that would otherwise pass by accident. `ownsRepo(login, null)` answers `false`
   * for a folder — no remote is no proof — and that `false` forces `trackMode: 'untracked'`
   * one line later, which would overwrite `n/a` with a mode the target cannot have. The
   * decision is that a folder is owned; this is what says so out loud.
   */
  test('a folder is owned, so nothing forces a mode it cannot have', async () => {
    const { prompter } = tracingPrompter();
    const plan = await planRepo(
      testScan({ kind: 'folder', name: 'accounts', remoteOwner: null }),
      null,
      answers(),
      testConfig(),
      prompter,
    );

    expect(plan.owned).toBe(true);
    expect(plan.trackMode).toBe('n/a');
  });

  test('a git target still asks it, and still answers tracked or untracked', async () => {
    const { prompter, asked } = tracingPrompter();
    const mine = await planRepo(
      testScan({ remoteOwner: 'me' }),
      'me',
      answers(),
      testConfig(),
      prompter,
    );
    expect(asked).toContain('track-mode');
    expect(mine.trackMode).toBe('tracked');
    expect(mine.owned).toBe(true);

    const theirs = await planRepo(
      testScan({ remoteOwner: 'someone-else' }),
      'me',
      answers(),
      testConfig(),
      tracingPrompter().prompter,
    );
    expect(theirs.trackMode).toBe('untracked');
    expect(theirs.owned).toBe(false);
  });

  /**
   * The proof line (D7) is asked of every target, folders included — it is the one question in
   * `discover` that a folder needs *more* than a repo does, since it has no gates to stand in
   * for it. Skipping `track-mode` by id must not take its neighbours with it.
   */
  test('skipping track-mode leaves the rest of the discover phase asked', async () => {
    const { prompter, asked } = tracingPrompter();
    await planRepo(
      testScan({ kind: 'folder', name: 'accounts', remoteOwner: null }),
      null,
      answers(),
      testConfig(),
      prompter,
    );
    expect(asked).toContain('proof-line');
    expect(asked).toContain('work-profile');
    expect(asked).not.toContain('projects-dir');
  });
});
