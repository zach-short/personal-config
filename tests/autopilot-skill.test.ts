/**
 * `/autopilot` (delegate-autopilot Phase 2, board row 84). It is offered where `/delegate` is,
 * except on project folders, which keep no board (D22). Only a person can start it (D2), its
 * defaults are written once (D17, DIAL-11), its rundown has fixed sections in a fixed order (D13),
 * and a row after one this run did not commit waits or builds by the commit policy (D24).
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { readText } from '../src/lib/disk.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { leftoverTokens } from '../src/lib/template.ts';
import type { Answers, PlannedFile, WorkProfile } from '../src/lib/types.ts';
import { renderSkills } from '../src/render/skills.ts';
import { DEFAULT_ANSWERS, testContext, testRepoPlan } from './helpers.ts';

const CODE_FULL_GIT = { workKind: 'code', configWeight: 'full', usesGit: 'yes' } as const;

async function render(overrides: Answers = {}, workProfile: WorkProfile = 'ledger') {
  const answers: Answers = {
    ...DEFAULT_ANSWERS,
    skills: 'all',
    ...CODE_FULL_GIT,
    ...overrides,
  };
  return renderSkills(testContext(answers, testRepoPlan({ workProfile })));
}

function skill(files: PlannedFile[], name: string): string {
  return files.find((f) => f.path.endsWith(join(name, 'SKILL.md')))?.contents ?? '';
}

async function autopilot(overrides: Answers = {}): Promise<string> {
  return skill(await render(overrides), 'autopilot');
}

describe('who gets /autopilot', () => {
  test('passes: code + full + git with a board gets it beside /delegate', async () => {
    const files = await render();
    expect(skill(files, 'autopilot')).not.toBe('');
    expect(skill(files, 'delegate')).not.toBe('');
  });

  const without: Array<[string, Answers, WorkProfile]> = [
    ['project folders, which keep no board (D22)', {}, 'folders'],
    ['skills: none', { skills: 'none' }, 'ledger'],
    ['the lighter setup', { configWeight: 'light' }, 'ledger'],
    ['non-code work on the full setup', { workKind: 'non-code' }, 'ledger'],
    ['code + full without git', { usesGit: 'no' }, 'ledger'],
  ];
  for (const [name, overrides, profile] of without) {
    test(`violates: ${name} gets no /autopilot`, async () => {
      expect(skill(await render(overrides, profile), 'autopilot')).toBe('');
    });
  }
});

describe('only a person starts it (D2)', () => {
  test('its frontmatter carries disable-model-invocation, and /delegate does not', async () => {
    const files = await render();
    const head = (text: string) => text.slice(0, text.indexOf('\n---\n'));
    expect(head(skill(files, 'autopilot'))).toContain('\ndisable-model-invocation: true');
    expect(head(skill(files, 'delegate'))).not.toContain('disable-model-invocation');
  });

  test('the description is the ratified copy, word for word (D16)', async () => {
    expect(await autopilot()).toContain(
      '\ndescription: Run the board unattended: each open row goes to its model in a worktree, is reviewed, and is reported back. Stops when the board is done or the budget you set is spent.\n',
    );
  });

  test('its first instruction refuses a run the person did not type (BD-4)', async () => {
    const text = await autopilot();
    const body = text.slice(text.indexOf('# /autopilot'));
    expect(body.split('\n')[2]).toBe(
      '**Run only when the person typed `/autopilot` in this session.** If you loaded this skill on your',
    );
  });
});

describe('what /autopilot says', () => {
  test('each default is written once (D17, DIAL-11)', async () => {
    const text = await autopilot();
    for (const value of [
      '25 points',
      '75%',
      '6, of which at most 4 are builders',
      '8 hours after the start',
      '2, then the row is held',
      '3600 seconds',
      '1800 seconds',
      '3, so at most 12 row questions',
    ])
      expect(text.split(value), value).toHaveLength(2);
  });

  test("the rundown's sections appear in D13's order", async () => {
    const text = await autopilot();
    const sections = [
      '**In one paragraph**',
      '**Rows**: for each row',
      '**Defects found and not fixed.**',
      '**Collisions and merge order**',
      '**Judgment calls**, each',
      '**Decisions waiting for the owner**',
      '**Budget**',
      '**Not verified**',
      '**Warnings**',
      '**Commit blocks**',
    ];
    const at = sections.map((s) => text.indexOf(s, text.indexOf('Write `RUNDOWN.md`')));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  test('it says four questions per call, and asks nothing after the opening round', async () => {
    const text = await autopilot();
    expect(text).toContain('At most four questions in each `AskUserQuestion` call.');
    expect(text).toContain('After the round, ask nothing more.');
  });

  test('the template names no model family and no Part of the standard, and has no em dash', async () => {
    const source = await readText(join(repoRoot(), 'templates', 'skills', 'autopilot.md'));
    expect(source.toLowerCase()).not.toMatch(/fable|opus|sonnet|haiku/);
    expect(source).not.toMatch(/Part \d/);
    expect(source).not.toContain('—');
  });

  test('it shows the tier names the person gave, for the opening round to confirm (D12)', async () => {
    expect(await autopilot()).toContain(
      '   | Deep | Deep Model |\n   | Default | Default Model |',
    );
  });

  test('under print-blocks a row after an uncommitted one is held for that commit (D24)', async () => {
    const text = await autopilot({ commitPolicy: 'print-blocks' });
    expect(text).toContain('its "Waits on" names the commit it waits');
    expect(text).toContain('`git -C <worktree> commit <files> -m "..."`');
    expect(text).not.toContain("builds from that row's worktree branch");
  });

  test('under agent-commits it builds from the predecessor branch instead (D24)', async () => {
    const text = (await autopilot({ commitPolicy: 'agent-commits' })).replace(/\s+/g, ' ');
    expect(text).toContain("builds from that row's worktree branch");
    expect(text).toContain(
      'Where a hook blocked that commit, the predecessor is not committed',
    );
    expect(text).toContain('No branch is pushed or merged.');
  });

  /** The six blocking findings of the Fable review, 2026-10-05, each pinned where it was fixed. */
  test('the Deep review fixes hold', async () => {
    const text = (await autopilot()).replace(/\s+/g, ' ');
    for (const phrase of [
      // 1: a cap with rows still runnable ends the run once nothing is in flight.
      'When nothing is in flight after a cap, the run ends, whatever rows are still runnable.',
      // 2: launches come before the stop rules on every wake.
      '6. **Launch.** Unless a cap is reached',
      '7. **Check the stop rules** (section 7).',
      // 3: two runnable rows that overlap each other never launch together.
      'and no other row in the same launch.',
      // 5: a builder's question for the owner holds the row unless it only implements a decision.
      'Anything else holds the row, with the question under **Held**, even when the builder finished.',
      // 6: what the rundown needs survives a compaction in the state file.
      '- **Reports**: for each row',
      'Write `RUNDOWN.md` in the run folder from `STATE.md`',
    ])
      expect(text, phrase).toContain(phrase);
    expect(text).not.toContain('it is the first `OPEN` row of its lane');
  });

  for (const policy of ['print-blocks', 'agent-commits', 'no-rule'])
    test(`${policy} leaves no token unfilled, with the stamp below the frontmatter`, async () => {
      const text = await autopilot({ commitPolicy: policy });
      expect(text.startsWith('---\nname: autopilot\n')).toBe(true);
      expect(text).toContain('---\n\n<!-- personal-config v');
      expect(leftoverTokens(text)).toEqual([]);
    });
});
