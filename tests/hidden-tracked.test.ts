/**
 * Board item 98: in tracked mode, setup's preview called `docs/AGENT-PRACTICES.md` tracked while
 * the owner's global excludes file hid it, so `git add` refused it and no worktree ever held it.
 * These pin that git is asked, that the rule is named, and that the plan's own ignore lines and
 * untracked repos are left out of the warning.
 *
 * The global ignore is a temp file reached through `GIT_CONFIG_GLOBAL`, so nothing here reads or
 * writes the real `~/.gitconfig` or `~/.config/git/ignore`.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { hiddenByIgnore, hiddenNote, meantToBeTracked } from '../src/lib/hidden-tracked.ts';
import type { PlannedFile, RepoPlan, TrackMode } from '../src/lib/types.ts';
import type { PlannedChange } from '../src/lib/write-plan.ts';
import { cleanup, tempDir, testScan } from './helpers.ts';

function file(
  path: string,
  strategy: PlannedFile['strategy'] = 'overwrite',
  contents = '',
): PlannedFile {
  return { path, contents, label: 'x', strategy };
}

function change(f: PlannedFile): PlannedChange {
  return { file: f, before: '', after: f.contents, summary: '', guard: 'none' };
}

function plan(path: string, trackMode: TrackMode): RepoPlan {
  return {
    scan: { ...testScan(), path },
    workProfile: 'ledger',
    trackMode,
    archiveHome: '',
    owned: true,
    proofLine: '',
    offLimits: '',
    tierCeiling: 'deep',
  };
}

function repoFiles(root: string): PlannedFile[] {
  return [
    file(join(root, 'CLAUDE.md')),
    file(join(root, 'HANDOFF.md')),
    file(join(root, 'docs', 'AGENT-PRACTICES.md')),
    file(join(root, '.personal-config.json')),
    file(join(root, '.claude', 'settings.local.json'), 'merge-json'),
    file(
      join(root, '.gitignore'),
      'append-lines',
      '/.personal-config.json\n/PART0-PROMPT.md\n',
    ),
    file('/elsewhere/.claude/CLAUDE.md'),
  ];
}

describe('meantToBeTracked', () => {
  test('keeps repo documents and drops the plan’s own ignores, ignore files and outside paths', () => {
    expect(meantToBeTracked('/r', repoFiles('/r'))).toEqual([
      'CLAUDE.md',
      'HANDOFF.md',
      'docs/AGENT-PRACTICES.md',
    ]);
  });
});

describe('hiddenByIgnore against a temp global ignore', () => {
  let dir = '';
  let saved: string | undefined;

  beforeEach(async () => {
    dir = await tempDir();
    saved = process.env.GIT_CONFIG_GLOBAL;
    const ignore = join(dir, 'global-ignore');
    await Bun.write(ignore, 'AGENT-PRACTICES.md\nHANDOFF.md\n.personal-config.json\n');
    const config = join(dir, 'global-config');
    await Bun.write(config, `[core]\n\texcludesFile = ${ignore}\n`);
    process.env.GIT_CONFIG_GLOBAL = config;
  });

  afterEach(async () => {
    if (saved === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = saved;
    await cleanup(dir);
  });

  async function repo(name: string): Promise<string> {
    const root = join(dir, name);
    await Bun.write(join(root, 'README.md'), 'x\n');
    expect(Bun.spawnSync(['git', 'init', '-q'], { cwd: root }).exitCode).toBe(0);
    return root;
  }

  test('names each hidden file and the rule that hides it', async () => {
    const root = await repo('mine');
    const changes = repoFiles(root).map(change);
    const hidden = await hiddenByIgnore([plan(root, 'tracked')], changes);
    expect(hidden.map((h) => `${h.repo}/${h.path}`)).toEqual([
      'mine/HANDOFF.md',
      'mine/docs/AGENT-PRACTICES.md',
    ]);
    expect(hidden[0]?.rule).toBe(`${join(dir, 'global-ignore')}:2:HANDOFF.md`);
    expect(hiddenNote(hidden)).toContain(
      `  mine/docs/AGENT-PRACTICES.md  (${join(dir, 'global-ignore')}:1:AGENT-PRACTICES.md)`,
    );
  });

  // `check-ignore -v` exits 0 and prints `.gitignore:1:!HANDOFF.md` here, though `git add` takes
  // the file: the last matching pattern is a negation. Found by the item 98 audit on git 2.49.0.
  test('says nothing for a file a repo negation re-includes', async () => {
    const root = await repo('negated');
    await Bun.write(join(root, '.gitignore'), '!HANDOFF.md\n');
    const changes = [change(file(join(root, 'HANDOFF.md')))];
    expect(await hiddenByIgnore([plan(root, 'tracked')], changes)).toEqual([]);
  });

  test('says nothing for a target that is not a git repository', async () => {
    const root = join(dir, 'plain');
    await Bun.write(join(root, 'notes.md'), 'x\n');
    const changes = [change(file(join(root, 'HANDOFF.md')))];
    expect(await hiddenByIgnore([plan(root, 'tracked')], changes)).toEqual([]);
  });

  test('says nothing for an untracked-mode repo, whose files are meant to be hidden', async () => {
    const root = await repo('theirs');
    const changes = repoFiles(root).map(change);
    expect(await hiddenByIgnore([plan(root, 'untracked')], changes)).toEqual([]);
  });

  test('says nothing for a file git already tracks', async () => {
    const root = await repo('committed');
    await Bun.write(join(root, 'HANDOFF.md'), 'x\n');
    expect(Bun.spawnSync(['git', 'add', '-f', 'HANDOFF.md'], { cwd: root }).exitCode).toBe(0);
    const changes = [change(file(join(root, 'HANDOFF.md')))];
    expect(await hiddenByIgnore([plan(root, 'tracked')], changes)).toEqual([]);
  });

  test('has no warning to print when nothing is hidden', () => {
    expect(hiddenNote([])).toBeNull();
  });
});
