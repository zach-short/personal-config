/**
 * Autonomous-autopilot Phase 1 (design 4.5, G45, BD-6): under `agent-pushes` no rendered file
 * says the merge, the push or the commit is anyone's but the agent's. The sweep is six sentences
 * across four skills, so the check reads every file `renderAll` plans rather than one skill.
 * It runs on both work-record shapes: project folders get no land step, and their builder rule
 * and worktree step say who lands instead (D6 As built, 2026-10-16).
 *
 * A file of its own rather than lines appended to `agent-pushes.test.ts`, which pins the rule line
 * (X1).
 */
import { describe, expect, test } from 'bun:test';
import type { Answers, PlannedFile, WorkProfile } from '../src/lib/types.ts';
import { renderAll } from '../src/render/index.ts';
import { DEFAULT_ANSWERS, PROSE_LAND_STEP, testContext, testRepoPlan } from './helpers.ts';

/** Design 4.5, as written, global so `match` returns every hit. */
const OWNERS_GIT =
  /never (push|merge)|no branch is pushed|commits? (is|are) the owner|pushing is|owner'?s commit|owner has committed|landing it is yours|merges nothing|commit blocks for everything/gi;

/**
 * Code + full + git: on a board it renders `/delegate` and `/autopilot`, on project folders
 * `/delegate` alone (D22).
 */
async function render(
  commitPolicy: string,
  workProfile: WorkProfile = 'ledger',
  profileKeys: Answers = PROSE_LAND_STEP,
): Promise<PlannedFile[]> {
  const answers: Answers = {
    ...DEFAULT_ANSWERS,
    ...profileKeys,
    workKind: 'code',
    configWeight: 'full',
    usesGit: 'yes',
    skills: 'all',
    commitPolicy,
  };
  return renderAll(testContext(answers, testRepoPlan({ workProfile })));
}

/** A sentence wrapped across two lines must still match, so whitespace reads as one space. */
function joined(files: PlannedFile[]): string {
  return files
    .map((f) => f.contents)
    .join('\n')
    .replace(/\s+/g, ' ');
}

function skillText(files: PlannedFile[], name: string): string {
  return joined(files.filter((f) => f.path.endsWith(`${name}/SKILL.md`)));
}

describe('the sweep leaves no owner-only git sentence under agent-pushes', () => {
  test('passes: nothing rendered under agent-pushes matches', async () => {
    expect(joined(await render('agent-pushes')).match(OWNERS_GIT)).toBeNull();
  });

  // Decision 13, 2026-10-16: the default leaves out the land step, and the lead still lands.
  test('passes: nothing rendered on a board without the land-step key matches', async () => {
    expect(joined(await render('agent-pushes', 'ledger', {})).match(OWNERS_GIT)).toBeNull();
  });

  test('passes: nothing rendered on project folders under agent-pushes matches', async () => {
    expect(joined(await render('agent-pushes', 'folders')).match(OWNERS_GIT)).toBeNull();
  });

  test('violates: the agent-commits skills still match, so the regex sees the sentences', async () => {
    const skills = (await render('agent-commits')).filter((f) => f.path.endsWith('SKILL.md'));
    expect(joined(skills).match(OWNERS_GIT)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });

  test('violates: the agent-commits skills on project folders still match', async () => {
    const files = await render('agent-commits', 'folders');
    const hits = [skillText(files, 'delegate'), skillText(files, 'close-out')]
      .join(' ')
      .match(OWNERS_GIT);
    // `/delegate`: "Never push", "never merge", "merges nothing", "owner's commit";
    // `/close-out`: "merges nothing", "owner's commit".
    expect(hits?.length ?? 0).toBeGreaterThanOrEqual(6);
  });

  // Deep review of row 113, finding 4: the regex missed `/clean-up`'s print-blocks sentence.
  test("violates: agent-commits' /clean-up commit-blocks sentence is one of the matches", async () => {
    const cleanUp = (await render('agent-commits')).filter((f) =>
      f.path.endsWith('clean-up/SKILL.md'),
    );
    expect(joined(cleanUp).match(OWNERS_GIT)).toContain('commit blocks for everything');
  });
});

/** D6 As built, 2026-10-16: who lands on project folders, stated as a fact. */
const FOLDERS_BUILDER =
  'This session lands your branch once the item is signed off: it runs `git merge --ff-only` and `git push` on the base.';
const FOLDERS_LAND =
  'First land each branch whose work is signed off: from the primary checkout, with `git -C` and the branch name written out, run `git merge --ff-only <branch>`, then `git push`.';

describe('project folders under agent-pushes say the session lands', () => {
  test('passes: /delegate names the landing in the builder rule and step 6, /close-out in step 4', async () => {
    const files = await render('agent-pushes', 'folders');
    const delegate = skillText(files, 'delegate');
    expect(delegate).toContain(FOLDERS_BUILDER);
    expect(delegate).toContain(FOLDERS_LAND);
    expect(skillText(files, 'close-out')).toContain(FOLDERS_LAND);
  });

  test('violates: no other policy and no board renders the folders landing text', async () => {
    const renders: Array<[string, WorkProfile]> = [
      ['agent-commits', 'folders'],
      ['print-blocks', 'folders'],
      ['no-rule', 'folders'],
      ['agent-pushes', 'ledger'],
    ];
    for (const [policy, profile] of renders) {
      const text = joined(await render(policy, profile));
      expect(text, `${policy} ${profile}`).not.toContain(FOLDERS_BUILDER);
      expect(text, `${policy} ${profile}`).not.toContain(FOLDERS_LAND);
    }
  });
});
