/**
 * `/clean-up` — the judgment around `fold` and `archive`. It is rendered only for code + full,
 * the one track asked for an archive home, and there its prose turns on two axes: whether the
 * work record is a ledger and board (something to fold) or project folders (nothing to fold), and
 * whether there is git (without it `archive` refuses, so the skill cannot send the agent to it).
 */
import { describe, expect, test } from 'bun:test';
import { leftoverTokens } from '../src/lib/template.ts';
import type { Answers, PlannedFile, RepoPlan, WorkProfile } from '../src/lib/types.ts';
import { renderSkills } from '../src/render/skills.ts';
import { DEFAULT_ANSWERS, testContext, testRepoPlan } from './helpers.ts';

type Shape = {
  workKind: 'code' | 'non-code';
  configWeight: 'full' | 'light';
  usesGit: 'yes' | 'no';
};

const CODE_FULL_GIT: Shape = { workKind: 'code', configWeight: 'full', usesGit: 'yes' };
const CODE_FULL_NO_GIT: Shape = { workKind: 'code', configWeight: 'full', usesGit: 'no' };

async function render(
  shape: Shape,
  workProfile: WorkProfile = 'ledger',
): Promise<PlannedFile[]> {
  const answers: Answers = { ...DEFAULT_ANSWERS, skills: 'all', ...shape };
  const plan: RepoPlan = testRepoPlan({ workProfile });
  return renderSkills(testContext(answers, plan));
}

async function cleanUp(shape: Shape, workProfile: WorkProfile = 'ledger'): Promise<string> {
  const files = await render(shape, workProfile);
  return files.find((f) => f.path.endsWith('clean-up/SKILL.md'))?.contents ?? '';
}

describe('who gets /clean-up', () => {
  test('passes: code + full installs it beside the others, /delegate among them in git', async () => {
    const files = await render(CODE_FULL_GIT);
    expect(files.map((f) => f.path.split('/').at(-2)).sort()).toEqual([
      'clean-up',
      'close-out',
      'delegate',
      'handoff',
      'passoff',
      'scope',
    ]);
  });

  test('violates: non-code + full is never asked for an archive home, so it gets no /clean-up', async () => {
    const files = await render({ workKind: 'non-code', configWeight: 'full', usesGit: 'yes' });
    expect(files).toHaveLength(4);
    expect(files.some((f) => f.path.includes('clean-up'))).toBe(false);
  });

  test('violates: a light setup gets its two and nothing else', async () => {
    const files = await render({ workKind: 'code', configWeight: 'light', usesGit: 'yes' });
    expect(files.some((f) => f.path.includes('clean-up'))).toBe(false);
  });
});

describe('what /clean-up tells each shape', () => {
  test('a ledger with git folds the board and ledger, then archives folders behind the owner commit', async () => {
    const text = await cleanUp(CODE_FULL_GIT);
    for (const phrase of [
      'personal-config fold --dry-run',
      'personal-config archive <slug>',
      '--move --dry-run',
      "the commit is the\n   owner's",
      '`DONE — <step>`',
      'Report, never mark.',
      'a `DONE` row, a ledger step',
      '**The archive may be its own repository**',
    ])
      expect(text, phrase).toContain(phrase);
  });

  test('project folders are never told to fold a ledger or board they do not keep', async () => {
    const text = await cleanUp(CODE_FULL_GIT, 'folders');
    expect(text).toContain('1. **Each finished folder**');
    expect(text).toContain('closed project folders');
    for (const phrase of [
      'personal-config fold',
      'ledger step',
      'board row',
      'the ledger, the board',
    ])
      expect(text, phrase).not.toContain(phrase);
  });

  test('without git it is not sent to a command that refuses, nor told to commit', async () => {
    const text = await cleanUp(CODE_FULL_NO_GIT);
    expect(text).toContain('needs git and refuses without it');
    expect(text).toContain('verify\n   every file arrived before deleting the original');
    for (const phrase of ['personal-config archive <slug>', '--move', 'commit blocks'])
      expect(text, phrase).not.toContain(phrase);
  });

  for (const [name, shape, profile] of [
    ['ledger + git', CODE_FULL_GIT, 'ledger'],
    ['ledger, no git', CODE_FULL_NO_GIT, 'ledger'],
    ['folders + git', CODE_FULL_GIT, 'folders'],
    ['folders, no git', CODE_FULL_NO_GIT, 'folders'],
  ] as const) {
    test(`${name} leaves no token unfilled`, async () => {
      const text = await cleanUp(shape, profile);
      expect(text).not.toBe('');
      expect(leftoverTokens(text)).toEqual([]);
    });
  }

  test('the stamp sits below the frontmatter, where the harness can read it', async () => {
    const text = await cleanUp(CODE_FULL_GIT);
    expect(text.startsWith('---\nname: clean-up\n')).toBe(true);
  });
});
