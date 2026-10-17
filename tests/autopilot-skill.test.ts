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
import {
  DEFAULT_ANSWERS,
  PROSE_LAND_STEP,
  testContext,
  testRepoPlan,
  testScan,
} from './helpers.ts';

const CODE_FULL_GIT = { workKind: 'code', configWeight: 'full', usesGit: 'yes' } as const;

async function render(overrides: Answers = {}, workProfile: WorkProfile = 'ledger') {
  const answers: Answers = {
    ...DEFAULT_ANSWERS,
    ...PROSE_LAND_STEP,
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

  // Autonomous-autopilot D2: under agent-pushes section 7 is retitled for the decider's answers.
  const seventhTitles: Array<[string, string]> = [
    ['print-blocks', '**Decisions waiting for the owner**'],
    ['agent-commits', '**Decisions waiting for the owner**'],
    ['agent-pushes', '**Decisions taken for the owner**'],
  ];
  for (const [policy, seventh] of seventhTitles)
    test(`the rundown's sections appear in D13's order under ${policy}`, async () => {
      const text = await autopilot({ commitPolicy: policy });
      const sections = [
        '**In one paragraph**',
        '**Audit**: "not run", or the report',
        '**Rows**: for each row',
        '**Defects found and not fixed.**',
        '**Collisions and merge order**',
        '**Judgment calls**, each',
        seventh,
        '**Budget**',
        '**Not verified**',
        '**Warnings**',
        policy === 'agent-pushes' ? '**Landed**' : '**Commit blocks**',
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

  /** Autonomous-autopilot Phase 1 (design 4.2): under agent-pushes a successor waits for a landing. */
  const LANDED = [
    "was signed off in this run is runnable once that row has landed (`/delegate`'s step 6): it builds from the base, which now holds the predecessor.",
    'A predecessor whose landing is held holds it.',
    "When `/audit` has written its rows, read the board again before step 6. Under this policy the record follows the landing: route a signed-off row to `/delegate`'s step 6, and write the log line and `DONE` when its fast-forward lands.",
    '11. **Landed**: for each row, its branch, the merge commit or fast-forward, and whether the push went; the rows landed and not pushed, with how far ahead the base is; and the exact files step 4 commits.',
  ];

  test('passes: under agent-pushes a row after a signed-off one builds once it has landed', async () => {
    const text = (await autopilot({ commitPolicy: 'agent-pushes' })).replace(/\s+/g, ' ');
    for (const phrase of LANDED) expect(text, phrase).toContain(phrase);
    expect(text).not.toContain('No branch is pushed or merged.');
    expect(text).not.toContain("builds from that row's worktree branch");
  });

  test('violates: under agent-commits and print-blocks nothing of the landing renders', async () => {
    for (const policy of ['agent-commits', 'print-blocks']) {
      const text = (await autopilot({ commitPolicy: policy })).replace(/\s+/g, ' ');
      for (const phrase of LANDED) expect(text, `${policy}: ${phrase}`).not.toContain(phrase);
      expect(text, policy).toContain(
        'read the board again before step 6. 4. **A question a builder reports',
      );
    }
  });

  /**
   * Deep review of row 113, finding 5: under agent-pushes the rundown's last section has one
   * title, and the fold's commit is step 4's, since no commit blocks are printed.
   */
  test('passes: under agent-pushes section 11 has one title and the fold commits in step 4', async () => {
    const text = (await autopilot({ commitPolicy: 'agent-pushes' })).replace(/\s+/g, ' ');
    expect(text).toContain("rundown's first paragraph, and its commit is step 4's.");
    expect(text).toContain('11. **Landed**: for each row');
    expect(text).not.toContain('**Commit blocks**');
    expect(text).not.toContain("its commit blocks join the rundown's.");
  });

  test('violates: under agent-commits section 11 keeps its title and the fold its blocks', async () => {
    const text = (await autopilot({ commitPolicy: 'agent-commits' })).replace(/\s+/g, ' ');
    expect(text).toContain(
      "rundown's first paragraph, and its commit blocks join the rundown's.",
    );
    expect(text).toContain('11. **Commit blocks**: for each worktree');
    expect(text).not.toContain("and its commit is step 4's.");
    expect(text).not.toContain('**Landed**');
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

  /**
   * Per-item-board Phase 6 (D4): a run is not an item, so it writes one log line and no step; a
   * builder writes neither; a "Waits on" item the fold took off the table still counts as done
   * (D16). A 1.x board, which the same installed skill still meets, keeps the run's step.
   */
  test('the run writes a log line, not a ledger step, on a 2.0.0 board', async () => {
    const text = (await autopilot()).replace(/\s+/g, ' ');
    for (const phrase of [
      'Add one line at the end of the log in `HANDOFF.md` for the run: `- <date> · autopilot run · <the run folder>/RUNDOWN.md`.',
      "On a 1.x board, with no `passoff/` folder, write the run's own ledger step instead",
      'Builders take no ledger number and write no log line.',
      "Record each sign-off as `/delegate`'s step 4 says: the item's close-out, a log line and the board.",
      'Every item its "Waits on" names is `DONE`, or has left the table at a fold.',
      "the close-out text where the item's file is untracked",
      // /delegate lets a builder write its own close-out; the files rule must not stop it there.
      'Its own item file, where `/delegate` lets it write the close-out, is the one exception.',
    ])
      expect(text, phrase).toContain(phrase);
  });

  /**
   * Item 95, from the supervised run of 2026-10-15: the standing order to use `git -C` reached the
   * builders, whose isolation refuses it on another worktree (findings 1 and 2), and `STATE.md`
   * kept `pending` worktrees, lost an auditor's report and held `~08:2x` times (finding 4).
   */
  test('item 95: agents run git from their own worktree, and each report updates STATE.md', async () => {
    const text = (await autopilot()).replace(/\s+/g, ' ');
    for (const phrase of [
      "An agent in a worktree does the opposite: it runs git as plain commands from its own worktree's directory, and never `git -C` on another worktree, which isolation refuses.",
      "for each row, one entry for each report, the builder's and every auditor's, headed with the row, the agent and the absolute time the report arrived.",
      '3. **Handle each returned row agent (a builder, a relayed pass or an auditor), one at a time, in this order.** First, read the time from `date`.',
      'so no field still reads `pending` once the report answers it.',
      "Only then route it by `/delegate`'s steps",
      'Never write a relative date word or an estimate',
      'branch, patch path, relay passes',
    ])
      expect(text, phrase).toContain(phrase);
    expect(text.indexOf('write its **Reports** entry')).toBeLessThan(
      text.indexOf("Only then route it by `/delegate`'s steps"),
    );
  });

  for (const policy of ['print-blocks', 'agent-commits', 'agent-pushes', 'no-rule'])
    test(`${policy} leaves no token unfilled, with the stamp below the frontmatter`, async () => {
      const text = await autopilot({ commitPolicy: policy });
      expect(text.startsWith('---\nname: autopilot\n')).toBe(true);
      expect(text).toContain('---\n\n<!-- personal-config v');
      expect(leftoverTokens(text)).toEqual([]);
    });
});

/** The audit-first option (audit-skill DESIGN 4.2, 4.4, 4.5, 2026-10-15). */
describe('the audit-first option', () => {
  test('the audit call comes before the first call, only where the lane file exists', async () => {
    const text = await autopilot();
    const auditCall = text.indexOf(
      '**Audit call, before the first call, only where the lane file exists.',
    );
    expect(auditCall).toBeGreaterThan(0);
    expect(auditCall).toBeLessThan(text.indexOf('**First call, always. Four questions.**'));
    expect(text.replace(/\s+/g, ' ')).toContain(
      "This answer is the run's end time, whatever question 1 says.",
    );
  });

  test('the state file has an Audit section, and rows launch only after the audit writes its rows', async () => {
    const text = (await autopilot()).replace(/\s+/g, ' ');
    expect(text).toContain('- **Audit**: "not run", or the audit folder');
    expect(text).toContain('The rows launch only after `/audit` has written its rows');
    expect(text).toContain(
      'When `/audit` has written its rows, read the board again before step 6.',
    );
  });

  test('the stop rules read the clock, check between lanes, and count the spend across a reset', async () => {
    const text = (await autopilot()).replace(/\s+/g, ' ');
    for (const phrase of [
      'Read the time from `date` for every check against the end time. Never estimate it.',
      '2. **Record a reading**: the time from `date`',
      'check the caps before each step of a lane starts',
      "A cap reached there launches no row: the audit's started steps finish, `/audit` writes its report and its rows, and the run ends when nothing is in flight.",
      'apply to audit agents as they do to builders.',
      'its next step launches in step 6, never here.',
      "Check the end time against `date` and the caps against this wake's reading here, before any launch",
      'While the audit runs, launch its next step instead, and no row.',
      'its stop is the end time: offer no other end time here.',
      "A stopped audit step is written in the report as not finished, and `/audit`'s section 5 runs before the run ends.",
      'A weekly reading lower than the one before marks the reset.',
      'minus the start reading, plus the latest reading after the reset. Never count a drop as negative spend.',
    ])
      expect(text, phrase).toContain(phrase);
  });
});

/**
 * Autonomous-autopilot Phase 2 (design D2 to D5, D9, 4.2): under agent-pushes the opening round
 * gains the Autonomy call, the wake decides a builder's question by severity, scope-first rows are
 * scoped in the run, and a wait on another board holds the run. The other policies render none of it.
 */
describe('the Autonomy call and what it governs', () => {
  const AUTONOMY = [
    'all of them, including rows written during the run',
    'read one window and the caps are joint',
    '*Caught at once*',
    '*Looks right until tested*',
    '*Compiles and passes every gate, wrong in production*',
    "owner's call",
    'The fourth question on one row holds it',
    'holds on the holding wake instead of ending',
    '**Decisions taken for the owner**',
    'Waits elsewhere',
    'scoped: <path>',
    'or its item file carries a dated note that a run scoped it and its gate was answered (section 5).',
    'a row whose prompt says to scope first is runnable for scoping',
    "is `DONE` there, or absent from both that board's table and the folder beside it",
  ];
  const DEFAULTS = [
    'More than 300 lines changed, or more than 8 files',
    '3, then the row is held',
  ];
  const TITLES = [
    '8. **Questions during the run.**',
    '9. **Scope-first rows.**',
    '10. **Audits.**',
    '11. **Other boards.**',
  ];

  test('passes: under agent-pushes the four questions follow the second call, in order', async () => {
    const text = await autopilot({ commitPolicy: 'agent-pushes' });
    const second = text.indexOf('**Second call**');
    const at = TITLES.map((title) => text.indexOf(title, second));
    expect(at.every((i) => i > second)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(text.indexOf('**Later calls.**')).toBeGreaterThan(at.at(-1) ?? 0);
  });

  test('passes: under agent-pushes the decider, the scoping run and the waits render', async () => {
    const text = (await autopilot({ commitPolicy: 'agent-pushes' })).replace(/\s+/g, ' ');
    for (const phrase of AUTONOMY) expect(text, phrase).toContain(phrase);
    for (const value of DEFAULTS) expect(text.split(value), value).toHaveLength(2);
    // The `2eff50c` rule stays, as the answer under question 8's other choice.
    expect(text).toContain(
      'Anything else holds the row, with the question under **Held**, even when the builder finished.',
    );
  });

  test('violates: under agent-commits and print-blocks none of it renders', async () => {
    for (const policy of ['agent-commits', 'print-blocks']) {
      const text = (await autopilot({ commitPolicy: policy })).replace(/\s+/g, ' ');
      for (const phrase of [...AUTONOMY, ...DEFAULTS, ...TITLES])
        expect(text, `${policy}: ${phrase}`).not.toContain(phrase);
      expect(text, policy).toContain('**Decisions waiting for the owner**, copy variants');
      expect(text, policy).toContain(
        'Which Deep rows to lift. Several may be chosen; none is the default.',
      );
    }
  });

  /** Row 113 fix round, items 1 to 4 and 6 to 8: each closes a way the run built or ran on wrongly. */
  const FIX_ROUND = [
    // 1: an unreadable board is an unmet wait, never an absent item; the example uses the tokens.
    '(`PASSOFF.md` gives `passoff/`; no file there starts with `<n>-`). Read that board by path on every wake.',
    'Where the board file cannot be read, the wait is unmet, and the row goes under **Held** with the path.',
    // 2: every decider can hold, and an added file joins the row's ownership.
    "Any decider that finds the question is the owner's returns that instead, and the row is held.",
    'Where it adds a file to the row, it also writes that file into the row\'s "Files it owns".',
    // 3
    'Where the tier ceiling forbids a Deep decider, the row is held.',
    // 4
    "writes **owner's call** before a question only the owner can answer, as `/passoff` says",
    // 6
    'runnable for scoping when every other condition in section 2 holds',
    // 7
    'at least one open wait on another board, on a row that would otherwise be runnable, holds',
    // 8
    '**Autonomy call, always, after the second call where it is asked. Four questions.**',
  ];

  test('passes: under agent-pushes the fix round renders', async () => {
    const text = (await autopilot({ commitPolicy: 'agent-pushes' })).replace(/\s+/g, ' ');
    for (const phrase of FIX_ROUND) expect(text, phrase).toContain(phrase);
    expect(text).not.toContain('absent from both that table and the items folder');
  });

  test("passes: the cross-board example names this repo's own board and folder", async () => {
    const answers: Answers = {
      ...DEFAULT_ANSWERS,
      skills: 'all',
      ...CODE_FULL_GIT,
      commitPolicy: 'agent-pushes',
    };
    const plan = testRepoPlan({ scan: testScan({ boardDoc: 'BOARD.md', itemsDoc: 'tasks' }) });
    const text = skill(await renderSkills(testContext(answers, plan)), 'autopilot');
    expect(text.replace(/\s+/g, ' ')).toContain('(`BOARD.md` gives `tasks/`;');
  });

  test('violates: under agent-commits none of the fix round renders', async () => {
    const text = (await autopilot({ commitPolicy: 'agent-commits' })).replace(/\s+/g, ' ');
    for (const phrase of FIX_ROUND) expect(text, phrase).not.toContain(phrase);
  });

  test("the owner's-call mark is on at least two lines under agent-pushes, none under agent-commits", async () => {
    const lines = async (policy: string) =>
      (await autopilot({ commitPolicy: policy }))
        .split('\n')
        .filter((line) => /owner.s call/.test(line)).length;
    expect(await lines('agent-pushes')).toBeGreaterThanOrEqual(2);
    expect(await lines('agent-commits')).toBe(0);
  });
});
