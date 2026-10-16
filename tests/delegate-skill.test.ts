/**
 * `/delegate` (delegate-autopilot Phase 1, board row 83; its `/autopilot` lines, Phase 2, row 84). It is offered only on code + full + git
 * (D1), on a board or on project folders (D22), and where it renders, `model-routing.md` names it
 * as the one exception to "a Deep subagent never builds" (D6, §4.3, BD-1). The template carries no
 * model family name (D12) and no Part number of the standard (BD-2); the tier names are filled in
 * from the person's own answers.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { readText } from '../src/lib/disk.ts';
import { repoRoot } from '../src/lib/paths.ts';
import { leftoverTokens } from '../src/lib/template.ts';
import type { Answers, PlannedFile, WorkProfile } from '../src/lib/types.ts';
import { renderAll } from '../src/render/index.ts';
import { DEFAULT_ANSWERS, testConfig, testContext, testRepoPlan } from './helpers.ts';

const CODE_FULL_GIT = { workKind: 'code', configWeight: 'full', usesGit: 'yes' } as const;

/** §4.3's final form, where both skills render (a board). */
const EXCEPTION =
  'One exception, and only one: a Deep row may be built by a Deep subagent when I named that row\nmyself, by running `/delegate` on it or by lifting its hold at the start of `/autopilot`, and\nthat build then gets an independent Deep review.';

/** Project folders get `/delegate` alone (D22), so the sentence names no `/autopilot` (BD-20). */
const EXCEPTION_FOLDERS =
  'One exception, and only one: a Deep row may be built by a Deep subagent when I named that row\nmyself, by running `/delegate` on it, and that build then gets an independent Deep review.';

async function render(
  overrides: Answers = {},
  workProfile: WorkProfile = 'ledger',
  config = testConfig(),
): Promise<PlannedFile[]> {
  const answers: Answers = {
    ...DEFAULT_ANSWERS,
    skills: 'all',
    ...CODE_FULL_GIT,
    ...overrides,
  };
  return renderAll(testContext(answers, testRepoPlan({ workProfile }), config));
}

function find(files: PlannedFile[], suffix: string): string | undefined {
  return files.find((f) => f.path.endsWith(join(...suffix.split('/'))))?.contents;
}

function skillNames(files: PlannedFile[]): string[] {
  return files
    .filter((f) => f.path.endsWith('SKILL.md'))
    .map((f) => f.path.split('/').at(-2) ?? '')
    .sort();
}

describe('who gets /delegate', () => {
  test('passes: code + full + git with every skill gets it beside the other seven', async () => {
    expect(skillNames(await render())).toEqual([
      'audit',
      'autopilot',
      'clean-up',
      'close-out',
      'delegate',
      'handoff',
      'passoff',
      'scope',
    ]);
  });

  test('passes: project folders get it too, recorded through the phase header (D22)', async () => {
    const text = find(await render({}, 'folders'), 'delegate/SKILL.md') ?? '';
    expect(text).toContain('Mark the phase header `IN FLIGHT`');
    expect(text).toContain('The phase header becomes `BUILT <date>`');
    for (const phrase of ['passoff claim', 'HANDOFF.md', 'PASSOFF.md', 'mark the row `DONE`'])
      expect(text, phrase).not.toContain(phrase);
  });

  const without: Array<[string, Answers]> = [
    ['skills: none', { skills: 'none' }],
    ['the lighter setup', { configWeight: 'light' }],
    ['non-code work on the full setup', { workKind: 'non-code' }],
    ['code + full without git, which keeps its five', { usesGit: 'no' }],
  ];
  for (const [name, overrides] of without) {
    test(`violates: ${name} gets no /delegate`, async () => {
      expect(skillNames(await render(overrides))).not.toContain('delegate');
    });
  }
});

describe('what /delegate says', () => {
  test('the description is the ratified copy, word for word (D23)', async () => {
    const text = find(await render(), 'delegate/SKILL.md') ?? '';
    expect(text).toContain(
      'description: Build one ratified board row or planned phase with a builder subagent and a separate auditor, each in its own worktree on the right model, then sign it off. Use when a row has cleared its gate and you want it built, reviewed and recorded without opening a new session.\n',
    );
  });

  test('the template names no model family and no Part of the standard', async () => {
    const source = await readText(join(repoRoot(), 'templates', 'skills', 'delegate.md'));
    expect(source.toLowerCase()).not.toMatch(/fable|opus|sonnet|haiku/);
    expect(source).not.toMatch(/Part \d/);
    expect(source).not.toContain('—');
  });

  test('each configured tier name is filled in, and the Light row only when that tier is on', async () => {
    const config = testConfig({
      models: { deep: 'Big', default: 'Middle', fast: '', light: 'Tiny' },
    });
    const off = find(await render({}, 'ledger', config), 'delegate/SKILL.md') ?? '';
    expect(off).toContain('| Deep | Big |\n| Default | Middle |\n| Mechanical | <unset> |\n');
    expect(off).not.toContain('Light');
    const on = find(
      await render({ modelLightEnabled: 'yes' }, 'ledger', config),
      'delegate/SKILL.md',
    );
    expect(on).toContain('| Light | Tiny |');
  });

  test('under print-blocks the builder never commits, and the auditor works from the diff', async () => {
    const text =
      find(await render({ commitPolicy: 'print-blocks' }), 'delegate/SKILL.md') ?? '';
    expect(text).toContain('- Do not commit.');
    expect(text).toContain('`git diff --binary HEAD > <patch>`');
    expect(text.replace(/\s+/g, ' ')).toContain(
      "Take it from the builder's patch: from your worktree's own directory, run `git apply <patch>`, then `git add -N` on each file the builder listed as added.",
    );
    expect(text).toContain('"not yet committed"');
    expect(text).not.toContain('Commit on your own worktree branch');
  });

  /**
   * Item 95, from the supervised `/autopilot` run of 2026-10-15 (RUNTIME-PASS Phase 2 entry 3).
   * Worktree isolation refused `git -C` on another worktree (finding 1), the preflight merge
   * passed only as a plain command (finding 2), and a worktree held none of the owner's untracked
   * documents (finding 3).
   */
  test('item 95: it works inside worktree isolation', async () => {
    for (const policy of ['print-blocks', 'agent-commits'])
      for (const profile of ['ledger', 'folders'] as const) {
        const text = (
          find(await render({ commitPolicy: policy }, profile), 'delegate/SKILL.md') ?? ''
        ).replace(/\s+/g, ' ');
        const where = `${policy} on ${profile}`;
        for (const phrase of [
          // 1: the auditor reproduces from a patch or a branch, never through the builder's worktree.
          'run `git add -N` on each file the change adds, then `git diff --binary HEAD > <patch>`.',
          'Pick the patch path: an absolute path outside the repo',
          "Never run `git -C` on the builder's worktree: worktree isolation refuses it.",
          'never copy files across by hand',
          // 2: the preflight merge is one plain command from the worktree's own directory.
          "from your worktree's own directory, run `git merge --ff-only <base>` as one plain command, with the branch name written out, never through a shell variable or `git -C`.",
          "run from your worktree's own directory as one plain command",
          // 3: untracked documents go into the brief by absolute path, read-only.
          'that git does not track here. Give its absolute path in this checkout, to be read and never written',
          'read it there, and never write there.',
          'the absolute paths of the documents step 2 found untracked',
          // Audit B1: the builder lists its added files, and the auditor marks them itself.
          'List in your report every file the change adds.',
          'the patch path and every file the change adds, which the auditor needs to reproduce it',
          'run `git apply <patch>`, then `git add -N` on each file the builder listed as added',
        ])
          expect(text, `${where}: ${phrase}`).toContain(phrase);
        expect(text, where).not.toContain("git -C <builder's");
        // Audit B1: `git apply -N` replaced the auditor's whole index on git 2.49.0.
        expect(text, where).not.toContain('git apply -N');
      }
  });

  /** Item 95 audit, N1: only a fast-forwarded auditor branch holds the builder's commits. */
  test("item 95: under agent-commits step 6 keeps the auditor's worktree, and says so", async () => {
    const kept = "step 6 keeps the auditor's worktree until the builder's branch is merged";
    const render95 = async (policy: string) =>
      (find(await render({ commitPolicy: policy }), 'delegate/SKILL.md') ?? '').replace(
        /\s+/g,
        ' ',
      );
    expect(await render95('agent-commits')).toContain(kept);
    expect(await render95('print-blocks')).not.toContain(kept);
  });

  test('under agent-commits the builder commits on its branch and never pushes', async () => {
    const text =
      find(await render({ commitPolicy: 'agent-commits' }), 'delegate/SKILL.md') ?? '';
    expect(text).toContain('Commit on your own worktree branch');
    expect(text).toContain('Never push and never merge.');
    expect(text).toContain("from the builder's branch");
    expect(text.replace(/\s+/g, ' ')).toContain(
      "run `git merge --ff-only <the builder's branch>` as one plain command. Where the builder reports that a hook blocked its commit, do not merge: run `git apply <patch>`, then `git add -N` on each file the builder listed as added.",
    );
    expect(text).not.toContain('- Do not commit.');
  });

  test('its last step removes only the merged, clean worktrees the run made', async () => {
    for (const profile of ['ledger', 'folders'] as const) {
      const text = find(await render({}, profile), 'delegate/SKILL.md') ?? '';
      const step = text.slice(text.indexOf('## 6. Remove the worktrees this run made'));
      expect(step, profile).toContain('git worktree remove <worktree>\ngit branch -d <branch>');
      expect(step.replace(/\s+/g, ' '), profile).toContain(
        'Never remove a worktree this run did not make',
      );
      expect(step.indexOf('## Why this session stays small'), profile).toBeGreaterThan(0);
    }
  });

  test('on a board it says what changes under /autopilot, which renders beside it', async () => {
    const text = find(await render(), 'delegate/SKILL.md') ?? '';
    for (const phrase of [
      'or, under `/autopilot`, hold the row',
      "`/autopilot`'s opening round",
      "into the run's state file under `/autopilot`",
      "that skill's own rule on this session's context governs",
    ])
      expect(text.replace(/\s+/g, ' '), phrase).toContain(phrase.replace(/\s+/g, ' '));
  });

  test('the auditor reproduces from the base branch, writes no record, and must show its gates', async () => {
    const text = (find(await render(), 'delegate/SKILL.md') ?? '').replace(/\s+/g, ' ');
    for (const phrase of [
      "Do not edit the ledger (`HANDOFF.md`) or the board (`PASSOFF.md`), and never write the builder's worktree.",
      'Bring your own worktree to the base branch with `git merge --ff-only <base>`',
      'Report each command with its output',
      'A verdict without them is not a reproduction',
      'an item that needs a Deep review is held, never reviewed on a lower tier',
    ])
      expect(text, phrase).toContain(phrase);
  });

  /**
   * Per-item-board Phase 6 and D10: the lead keeps the table, a builder writes its own close-out
   * only where the item's file is tracked and so in its worktree, and the lead's sign-off joins
   * that section there. A 1.x board, which the same installed skill still meets, keeps its step.
   */
  test('on a board the record is the close-out, a log line and a dated DONE (D10)', async () => {
    const text = (find(await render(), 'delegate/SKILL.md') ?? '').replace(/\s+/g, ' ');
    for (const phrase of [
      "find whether the item's file is tracked: it is when `git ls-files --error-unmatch passoff/<n>-<slug>.md` succeeds here",
      "Where the brief says the item's file is tracked, append its `## Close-out, <date>` section there",
      'Otherwise put that text in your report.',
      "add these to the close-out section the builder wrote, in the builder's worktree",
      'Where it is untracked, write the whole section at the end of `passoff/<n>-<slug>.md` here',
      'add `- <date> · closed item <n>` at the end of the log in `HANDOFF.md`, mark the row `DONE - <date>`',
      'On a 1.x board, with no `passoff/` folder beside it, the record is one step in `HANDOFF.md`',
      'the row becomes `DONE - HANDOFF <n>`',
      "the item's file gets a dated note",
      'names `DONE` or gone from the table at a fold',
    ])
      expect(text, phrase).toContain(phrase);
  });

  test('on project folders it says nothing of item files or log lines', async () => {
    const text = find(await render({}, 'folders'), 'delegate/SKILL.md') ?? '';
    for (const phrase of ['closed item', 'passoff/', 'ls-files', 'Close-out, <date>'])
      expect(text, phrase).not.toContain(phrase);
  });

  test('on project folders it names no /autopilot, which is not installed there (D22)', async () => {
    const text = find(await render({}, 'folders'), 'delegate/SKILL.md') ?? '';
    expect(text).not.toContain('autopilot');
  });

  for (const policy of ['print-blocks', 'agent-commits', 'no-rule'])
    for (const profile of ['ledger', 'folders'] as const)
      test(`${policy} on ${profile} leaves no token unfilled, with the stamp below the frontmatter`, async () => {
        const text =
          find(await render({ commitPolicy: policy }, profile), 'delegate/SKILL.md') ?? '';
        expect(text.startsWith('---\nname: delegate\n')).toBe(true);
        expect(text).toContain('---\n\n<!-- personal-config v');
        expect(leftoverTokens(text)).toEqual([]);
      });
});

describe("model-routing.md names /delegate's Deep exception only where /delegate renders", () => {
  test('passes: delegate-or-stop on code + full + git holds the sentence once', async () => {
    const rule = find(await render(), 'rules/model-routing.md') ?? '';
    expect(rule.split(EXCEPTION)).toHaveLength(2);
    expect(rule).toContain(`that tier is for.\n${EXCEPTION}\nNever do the work yourself`);
  });

  test('passes: on project folders the sentence names /delegate alone (BD-20)', async () => {
    const rule = find(await render({}, 'folders'), 'rules/model-routing.md') ?? '';
    expect(rule.split(EXCEPTION_FOLDERS)).toHaveLength(2);
    expect(rule).not.toContain('autopilot');
  });

  const without: Array<[string, Answers]> = [
    ['warn-only', { modelRouting: 'warn-only' }],
    ['skills: none', { skills: 'none' }],
    ['non-code work on the full setup', { workKind: 'non-code' }],
    ['code + full without git', { usesGit: 'no' }],
  ];
  for (const [name, overrides] of without) {
    test(`violates: ${name} has no exception`, async () => {
      const rule = find(await render(overrides), 'rules/model-routing.md') ?? '';
      expect(rule).not.toBe('');
      expect(rule).not.toContain('One exception');
      if (overrides.modelRouting !== 'warn-only')
        expect(rule).toContain('that tier is for.\nNever do the work yourself');
    });
  }

  test('violates: skip writes no rule at all', async () => {
    expect(
      find(await render({ modelRouting: 'skip' }), 'rules/model-routing.md'),
    ).toBeUndefined();
  });
});
