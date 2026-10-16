/**
 * Autonomous-autopilot Phase 1 (design 4.5, G45, BD-6): under `agent-pushes` no rendered file
 * says the merge, the push or the commit is anyone's but the agent's. The sweep is six sentences
 * across four skills, so the check reads every file `renderAll` plans rather than one skill.
 *
 * A file of its own rather than lines appended to `agent-pushes.test.ts`, which pins the rule line
 * (X1).
 */
import { describe, expect, test } from 'bun:test';
import type { Answers, PlannedFile } from '../src/lib/types.ts';
import { renderAll } from '../src/render/index.ts';
import { DEFAULT_ANSWERS, testContext, testRepoPlan } from './helpers.ts';

/** Design 4.5, as written, global so `match` returns every hit. */
const OWNERS_GIT =
  /never (push|merge)|no branch is pushed|commits? (is|are) the owner|pushing is|owner'?s commit|owner has committed|landing it is yours|merges nothing|commit blocks for everything/gi;

/** Code + full + git with a board: the one shape that renders `/delegate` and `/autopilot`. */
async function render(commitPolicy: string): Promise<PlannedFile[]> {
  const answers: Answers = {
    ...DEFAULT_ANSWERS,
    workKind: 'code',
    configWeight: 'full',
    usesGit: 'yes',
    skills: 'all',
    commitPolicy,
  };
  return renderAll(testContext(answers, testRepoPlan()));
}

/** A sentence wrapped across two lines must still match, so whitespace reads as one space. */
function joined(files: PlannedFile[]): string {
  return files
    .map((f) => f.contents)
    .join('\n')
    .replace(/\s+/g, ' ');
}

describe('the sweep leaves no owner-only git sentence under agent-pushes', () => {
  test('passes: nothing rendered under agent-pushes matches', async () => {
    expect(joined(await render('agent-pushes')).match(OWNERS_GIT)).toBeNull();
  });

  test('violates: the agent-commits skills still match, so the regex sees the sentences', async () => {
    const skills = (await render('agent-commits')).filter((f) => f.path.endsWith('SKILL.md'));
    expect(joined(skills).match(OWNERS_GIT)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });

  // Deep review of row 113, finding 4: the regex missed `/clean-up`'s print-blocks sentence.
  test("violates: agent-commits' /clean-up commit-blocks sentence is one of the matches", async () => {
    const cleanUp = (await render('agent-commits')).filter((f) =>
      f.path.endsWith('clean-up/SKILL.md'),
    );
    expect(joined(cleanUp).match(OWNERS_GIT)).toContain('commit blocks for everything');
  });
});
