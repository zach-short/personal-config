/**
 * Autonomous-autopilot Phase 3 (design D7, D10, 4.2, 4.4): under `agent-pushes` the run commits its
 * own folder by name at the end, and `/passoff` tells the writer how to mark a question the
 * unattended decider must not answer. Every other policy and shape renders neither.
 *
 * A file of its own rather than lines appended to the skill suites, which another phase edits (X1).
 */
import { describe, expect, test } from 'bun:test';
import type { Answers, PlannedFile, RepoPlan, WorkProfile } from '../src/lib/types.ts';
import { DEFAULT_ANSWERS, everySkill, testContext, testRepoPlan } from './helpers.ts';

const OWNERS_CALL = "write **owner's call** before it";

async function skill(
  name: string,
  commitPolicy: string,
  overrides: Partial<Answers> = {},
  workProfile: WorkProfile = 'ledger',
): Promise<string> {
  const answers: Answers = {
    ...DEFAULT_ANSWERS,
    workKind: 'code',
    configWeight: 'full',
    usesGit: 'yes',
    skills: 'all',
    commitPolicy,
    ...overrides,
  };
  const plan: RepoPlan = testRepoPlan({ workProfile });
  const files: PlannedFile[] = await everySkill(testContext(answers, plan));
  return files.find((f) => f.path.endsWith(`${name}/SKILL.md`))?.contents ?? '';
}

/** Section 8's step 4, from its log line to step 5, so a hit elsewhere in the skill cannot pass. */
function stepFour(text: string): string {
  const start = text.indexOf('4. Add one line at the end of the log');
  return text.slice(start, text.indexOf('\n5. ', start));
}

describe('/autopilot commits its own run at the end under agent-pushes', () => {
  test('passes: step 4 names the run folder files, the message and the untracked rule', async () => {
    const step = stepFour(await skill('autopilot', 'agent-pushes'));
    expect(step).toContain('-m "autopilot run <date>"');
    expect(step).toContain('Untracked records\n   stay as they are.');
    expect(step).toContain('STATE.md and RUNDOWN.md');
  });

  test('violates: agent-commits renders no end-of-run commit', async () => {
    const text = await skill('autopilot', 'agent-commits');
    expect(text).toContain('4. Add one line at the end of the log');
    expect(text).not.toContain('autopilot run <date>');
    expect(text).not.toContain('Untracked records');
  });

  test('every git add in the skill names files: no -A, no --all and no bare dot', async () => {
    const text = await skill('autopilot', 'agent-pushes');
    expect(text).toContain('`git add <');
    expect(text).not.toMatch(/git add (-A|--all|\.)(\s|`|$)/m);
  });
});

describe('/passoff marks the questions an unattended run must hold', () => {
  test('passes: agent-pushes on a board renders the sentence after part 7', async () => {
    const text = await skill('passoff', 'agent-pushes');
    expect(text).toContain(
      'either answer may be no.\n   Where a question must wait for the owner',
    );
    expect(text).toContain("`/autopilot`'s decider holds a row on those words");
  });

  test('violates: print-blocks, and agent-pushes where /autopilot does not render, omit it', async () => {
    const cases = [
      await skill('passoff', 'print-blocks'),
      await skill('passoff', 'agent-pushes', {}, 'folders'),
      await skill('passoff', 'agent-pushes', { workKind: 'non-code' }),
      await skill('passoff', 'agent-pushes', { usesGit: 'no' }),
    ];
    for (const text of cases) {
      expect(text).toContain('either answer may be no.\n');
      expect(text).not.toContain(OWNERS_CALL);
    }
  });

  test('the lighter setup installs no /passoff, so it cannot carry the sentence', async () => {
    expect(await skill('passoff', 'agent-pushes', { configWeight: 'light' })).toBe('');
  });
});
