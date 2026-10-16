/**
 * `/close-out` and `/autopilot` end with `/clean-up` (board item 107, ezhomesteading's
 * workflow-refinement D4 and BD-10): nothing else runs the sweep, so closed work piles up. The step
 * must be the last one, name both board shapes, and never render where `/clean-up` is not
 * installed, or a session is sent to a skill it does not have.
 */
import { describe, expect, test } from 'bun:test';
import { leftoverTokens } from '../src/lib/template.ts';
import type { Answers, WorkProfile } from '../src/lib/types.ts';
import { renderSkills } from '../src/render/skills.ts';
import { DEFAULT_ANSWERS, testContext, testRepoPlan } from './helpers.ts';

type Shape = {
  workKind: 'code' | 'non-code';
  configWeight: 'full' | 'light';
  usesGit: 'yes' | 'no';
};

const CODE_FULL_GIT: Shape = { workKind: 'code', configWeight: 'full', usesGit: 'yes' };

async function skill(
  name: string,
  shape: Shape,
  workProfile: WorkProfile = 'ledger',
): Promise<string> {
  const answers: Answers = { ...DEFAULT_ANSWERS, skills: 'all', ...shape };
  const files = await renderSkills(testContext(answers, testRepoPlan({ workProfile })));
  return files.find((f) => f.path.endsWith(`/${name}/SKILL.md`))?.contents ?? '';
}

function lastSection(text: string): string {
  return text.slice(text.lastIndexOf('\n## ') + 1);
}

describe('/close-out ends with /clean-up', () => {
  test('passes: code + full + git, step 5, after the worktree step, both board shapes named', async () => {
    const text = await skill('close-out', CODE_FULL_GIT);
    const last = lastSection(text);
    expect(last.startsWith('## 5. Run `/clean-up`, last\n')).toBe(true);
    expect(last).toContain('On a board with a `passoff/` folder');
    expect(last).toContain('a `DONE` row with no file gets an archive file that holds the row');
    expect(last).toContain('On a 1.x board, with no `passoff/` folder beside it');
    expect(text.indexOf('## 4. Remove the worktrees')).toBeLessThan(text.indexOf('## 5. Run'));
    expect(leftoverTokens(text)).toEqual([]);
  });

  test('passes: without git there is no worktree step, so it is step 4', async () => {
    const text = await skill('close-out', { ...CODE_FULL_GIT, usesGit: 'no' });
    expect(lastSection(text).startsWith('## 4. Run `/clean-up`, last\n')).toBe(true);
  });

  test('passes: project folders are swept as folders, with no board named', async () => {
    const last = lastSection(await skill('close-out', CODE_FULL_GIT, 'folders'));
    expect(last).toContain('Each project folder whose phases are all checked off');
    expect(last).not.toContain('1.x board');
  });

  test('violates: non-code + full has no /clean-up installed, so its close-out has no such step', async () => {
    const text = await skill('close-out', { ...CODE_FULL_GIT, workKind: 'non-code' });
    expect(text).not.toBe('');
    expect(text).not.toContain('Run `/clean-up`');
    expect(lastSection(text).startsWith('## 4. Remove the worktrees')).toBe(true);
  });
});

describe('/autopilot runs /clean-up before the rundown', () => {
  test('passes: step 2 of the end, before RUNDOWN.md, both board shapes named', async () => {
    const text = await skill('autopilot', CODE_FULL_GIT);
    const end = text.slice(text.indexOf('## 8. The end'), text.indexOf('## 9.'));
    expect(end).toContain('2. **Run `/clean-up`**');
    expect(end.indexOf('2. **Run `/clean-up`**')).toBeLessThan(
      end.indexOf('3. Write `RUNDOWN.md`'),
    );
    expect(end).toContain('On a board with a `passoff/` folder');
    expect(end).toContain('On a 1.x board, with no `passoff/` folder');
    expect(text).toContain('run ends with `/clean-up`, which moves finished work');
    expect(leftoverTokens(text)).toEqual([]);
  });
});
