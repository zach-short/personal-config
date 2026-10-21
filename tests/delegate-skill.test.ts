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
import {
  DEFAULT_ANSWERS,
  PROSE_LAND_STEP,
  testConfig,
  testContext,
  testRepoPlan,
  WK_LAND_STEP,
} from './helpers.ts';

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
    ...PROSE_LAND_STEP,
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

  /**
   * Autonomous-autopilot Phase 1 (D1, design 4.1): under `agent-pushes` a signed-off row lands in
   * step 6, the builder merging and gating in its own worktree and the lead fast-forwarding and
   * pushing from the primary checkout. Each sentence is absent under the other two policies.
   */
  const LANDS = [
    "The merge into the base and the push are the land step's (step 6), which this session sends you after the audit.",
    '## 6. Land it',
    "After step 4 signs an item off, land it: the base takes the builder's branch, gated on the tree that lands, and the push follows.",
    "1. Where the item's file is tracked, append these sign-off lines to its close-out section",
    "2. From your worktree's own directory, run `git rev-parse HEAD` and keep the hash. Then run `git merge --no-edit <base>` as one plain command",
    '3. On a conflict in a file your item\'s "Files it owns" lists, resolve it',
    "run the fresh-checkout recipe's install line again, then every gate below",
    '5. Report: the merge result with `git rev-parse HEAD`',
    "from the primary checkout, `git worktree add <a fresh path> <the builder's branch>`",
    'Never `--force`, and never a rebase: the auditor reproduced the commits that land.',
    'A refused push lands the row, stops every later push in this session',
    'Under this policy a row is `DONE` when its commits are on the base.',
    '## 7. Remove the worktrees this run made',
    'The merge happened in the land step; this step only removes.',
    "so step 7 keeps the auditor's worktree until the builder's branch is merged",
    'commit state (landed on <base> at <hash>, or held at the land step)',
    'is tracked, these lines go into the land message (step 6), and the builder commits them.',
    "The log line, `DONE - <date>` and the hand-back blocks wait for step 6's fast-forward",
  ];

  /** Design 4.1: the lead's two commands are a fenced block, not the design's indented lines. */
  const FENCE = "```bash\ngit merge --ff-only <the builder's branch>\ngit push\n```";

  const delegateUnder = async (policy: string, profile: WorkProfile = 'ledger') =>
    find(await render({ commitPolicy: policy }, profile), 'delegate/SKILL.md') ?? '';

  test('passes: under agent-pushes on a board, step 6 lands the row and step 7 removes', async () => {
    const raw = await delegateUnder('agent-pushes');
    const text = raw.replace(/\s+/g, ' ');
    for (const phrase of LANDS) expect(text, phrase).toContain(phrase);
    expect(raw).toContain(FENCE);
    expect(text).not.toContain('Never push and never merge.');
    expect(text).not.toContain('This step merges nothing');
    expect(raw.indexOf('## 6. Land it')).toBeLessThan(
      raw.indexOf('## 7. Remove the worktrees'),
    );
    expect(raw).toContain("item's loop is independent.\n\n## 6. Land it\n");
    expect(raw).toContain('base now holds.\n\n## 7. Remove the worktrees this run made\n');
  });

  test('violates: under agent-commits and print-blocks none of the land step renders', async () => {
    for (const policy of ['agent-commits', 'print-blocks']) {
      const raw = await delegateUnder(policy);
      const text = raw.replace(/\s+/g, ' ');
      for (const phrase of LANDS) expect(text, `${policy}: ${phrase}`).not.toContain(phrase);
      expect(raw, policy).not.toContain(FENCE);
      expect(raw, policy).toContain(
        "item's loop is independent.\n\n## 6. Remove the worktrees",
      );
    }
  });

  /**
   * Deep review of row 113, findings 1 to 3: the claim is committed before the build so the
   * fast-forward is not refused, a resend does not append the sign-off lines twice, and the
   * budget fallback still commits them.
   */
  const LAND_FIXES = [
    'Where it is tracked, commit the claim before step 2, naming the file:',
    'git refuses a fast-forward that would overwrite an uncommitted edit to that file.',
    'send the message once more first, and the second send skips step 1, whose lines are committed already.',
    'run steps 1 to 5 there with `git -C <that path>`, step 1 only where the pass-off does not say the lines were committed',
  ];

  test('passes: under agent-pushes the claim is committed and the land step sends step 1 once', async () => {
    const text = (await delegateUnder('agent-pushes')).replace(/\s+/g, ' ');
    for (const phrase of LAND_FIXES) expect(text, phrase).toContain(phrase);
    // The items folder is the rendered name, as the claim's `git ls-files` line uses it.
    const items = text.match(/git ls-files --error-unmatch (\S+)\/<n>-<slug>\.md/)?.[1] ?? '';
    expect(items).not.toBe('');
    expect(text).toContain(`\`git commit ${items}/<n>-<slug>.md -m "claim item <n>"\``);
    expect(text).not.toContain('run steps 2 to 5 there');
  });

  test('violates: under agent-commits none of the land fixes renders', async () => {
    const text = (await delegateUnder('agent-commits')).replace(/\s+/g, ' ');
    for (const phrase of LAND_FIXES) expect(text, phrase).not.toContain(phrase);
    expect(text).not.toContain('claim item <n>');
  });

  /**
   * D1 As built, 2026-10-16: the land step runs the gates again only where the merge changed
   * HEAD. The skip needs both witnesses (the hash and git's "already up to date"), names the one
   * ungated commit it lands (step 1's), and sends a builder that committed after its last gate
   * run back to the gates. Its sentences are absent under every other policy and on folders.
   */
  const UNMOVED = [
    "4. Run `git rev-parse HEAD` again. When it prints step 2's hash and the merge reported the branch already up to date, the base has not moved",
    "with step 1's commit on top where it was made: skip the install line and the gates, and report `base unmoved, gates not re-run` with the hash your gates passed on.",
    "Otherwise, or where any commit but step 1's came after your last gate run, run the fresh-checkout recipe's install line again",
    'each gate with its output or the `base unmoved` line',
    'A report of `base unmoved, gates not re-run` lands on the gates the builder already reported; the fast-forward is what checks that the base still has not moved, and it is refused where it has.',
    'and step 6 runs its gates again where the base moved.',
  ];

  test('passes: under agent-pushes on a board, step 4 skips the gates only on an unmoved base', async () => {
    const raw = await delegateUnder('agent-pushes');
    const text = raw.replace(/\s+/g, ' ');
    for (const phrase of UNMOVED) expect(text, phrase).toContain(phrase);
    // The hash is kept before the merge, compared after step 3, and the gates follow the decision.
    const keep = text.indexOf(
      'run `git rev-parse HEAD` and keep the hash. Then run `git merge',
    );
    const resolve = text.indexOf('run `git commit --no-edit`, and say which file and how.');
    const again = text.indexOf('4. Run `git rev-parse HEAD` again.');
    const gates = text.indexOf(
      "Otherwise, or where any commit but step 1's came after your last gate run",
    );
    expect(keep).toBeGreaterThan(0);
    expect(resolve).toBeGreaterThan(keep);
    expect(again).toBeGreaterThan(resolve);
    expect(gates).toBeGreaterThan(again);
    expect(text).not.toContain('step 6 runs its gates again on the tree that lands');
  });

  test('violates: under agent-commits, print-blocks and on folders no gate skip renders', async () => {
    const renders: Array<[string, WorkProfile]> = [
      ['agent-commits', 'ledger'],
      ['print-blocks', 'ledger'],
      ['no-rule', 'ledger'],
      ['agent-pushes', 'folders'],
    ];
    for (const [policy, profile] of renders) {
      const text = (await delegateUnder(policy, profile)).replace(/\s+/g, ' ');
      for (const phrase of UNMOVED) expect(text, `${policy} ${profile}`).not.toContain(phrase);
      expect(text, `${policy} ${profile}`).not.toContain('base unmoved');
    }
  });

  /** Autonomous-autopilot Phase 2 (design D4, 4.1 step 3): the audit dial, on a board only. */
  const DIAL = [
    'where its opening round chose audits by tier, a Mechanical or Light item lands on its gates with no auditor unless a trigger fires',
    "a diffstat above `/autopilot`'s audit trigger, or a decider's load-bearing mark.",
    '"not audited: <tier>, no trigger"',
    // Row 113 fix round, item 5: a report the triggers cannot be read from is audited.
    'A report that lacks the diffstat or the file list is itself a trigger.',
  ];

  test('passes: under agent-pushes on a board, step 3 carries the audit dial', async () => {
    const raw = await delegateUnder('agent-pushes');
    const text = raw.replace(/\s+/g, ' ');
    for (const phrase of DIAL) expect(text, phrase).toContain(phrase);
    expect(raw).toContain('never reviewed on a lower tier.\n\nUnder `/autopilot`, where');
    // The numbers live in `/autopilot`'s defaults table alone.
    expect(raw).not.toContain('300');
  });

  test('violates: under agent-commits, print-blocks and on folders no audit dial renders', async () => {
    const renders: Array<[string, WorkProfile]> = [
      ['agent-commits', 'ledger'],
      ['print-blocks', 'ledger'],
      ['agent-pushes', 'folders'],
    ];
    for (const [policy, profile] of renders) {
      const raw = await delegateUnder(policy, profile);
      for (const phrase of DIAL)
        expect(raw.replace(/\s+/g, ' '), `${policy} ${profile}`).not.toContain(phrase);
      expect(raw).toContain('never reviewed on a lower tier.\n\nIts brief:');
    }
  });

  /**
   * Design D6 As built, 2026-10-16: the land step's record is a log line and a `DONE` row, which
   * folders lack, so folders get no step 6; the builder rule and step 6's removal say who lands.
   */
  test('passes: on project folders agent-pushes gets no land step, and step 6 removes', async () => {
    const raw = await delegateUnder('agent-pushes', 'folders');
    expect(raw).not.toContain('## 6. Land it');
    expect(raw).toContain('## 6. Remove the worktrees this run made');
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
      'add `- <date> · closed item <n>` at the end of the log in `HANDOFF.md`, mark the row `DONE, <date>` (never wait for the hash',
      'On a 1.x board, with no `passoff/` folder beside it, the record is one step in `HANDOFF.md`',
      'the row becomes `DONE, HANDOFF <n>`',
      "the item's file gets a dated note",
      'names `COMMITTED` or gone from the table at a fold (a `DONE` item is built but not yet committed',
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

  for (const policy of ['print-blocks', 'agent-commits', 'agent-pushes', 'no-rule'])
    for (const profile of ['ledger', 'folders'] as const)
      test(`${policy} on ${profile} leaves no token unfilled, with the stamp below the frontmatter`, async () => {
        const text =
          find(await render({ commitPolicy: policy }, profile), 'delegate/SKILL.md') ?? '';
        expect(text.startsWith('---\nname: delegate\n')).toBe(true);
        expect(text).toContain('---\n\n<!-- personal-config v');
        expect(leftoverTokens(text)).toEqual([]);
      });
});

/**
 * Owner, 2026-10-21: worktree isolation names every subagent branch `worktree-agent-<random id>`,
 * so each subagent renames its own branch before anything else, and the lead uses the name the
 * report gives from then on. Under wk's queue the branch is already `wk/<n>` and the auditor's
 * worktree is detached, so nothing renames there.
 */
describe('/delegate names its branches after the item', () => {
  const RENAME_FIRST =
    "rules:\n\n- Before anything else, from your worktree's own directory, run\n";
  const renders: Array<[string, WorkProfile, string]> = [];
  for (const policy of ['print-blocks', 'agent-commits', 'agent-pushes', 'no-rule']) {
    renders.push([policy, 'ledger', 'row-<N>']);
    renders.push([policy, 'folders', '<phase-slug>']);
  }

  for (const [policy, profile, stem] of renders)
    test(`passes: under ${policy} on ${profile}, builder, relay and auditor rename to ${stem}`, async () => {
      const raw =
        find(await render({ commitPolicy: policy }, profile), 'delegate/SKILL.md') ?? '';
      const text = raw.replace(/\s+/g, ' ');
      for (const phrase of [
        `Pick the branch name, \`${stem}-build\`, and write it where the rules below say \`<name>\`.`,
        "From here on, a subagent's branch is the name its report gives, never the one the Agent tool returned.",
        '`git branch -m <name>` as one plain command. If git refuses because the name exists, add `-2`, then `-3`, until it takes. Report the name that took; it is your branch everywhere below.',
        `plus the builder rule that renames the branch, with \`<name>\` as \`${stem}-build-pass<k>\`. Count the passes`,
        `\`git branch -m ${stem}-audit\` as one plain command.`,
        'The branch is the name its report gave, never the one the Agent tool returned.',
      ])
        expect(text, `${policy} ${profile}: ${phrase}`).toContain(phrase);
      // The rename is the first rule in both briefs, so it runs before any commit on the old name.
      const builder = raw.indexOf('then these rules:\n\n- Before anything else');
      const auditor = raw.indexOf(
        'found untracked, and these rules:\n\n- Before anything else',
      );
      expect(builder, `${policy} ${profile}: builder`).toBeGreaterThan(0);
      expect(auditor, `${policy} ${profile}: auditor`).toBeGreaterThan(builder);
      expect(raw.split(RENAME_FIRST), `${policy} ${profile}`).toHaveLength(3);
      // The branch the lead picks is the shape's own: no row on folders, no phase on a board.
      expect(text).not.toContain(profile === 'ledger' ? '<phase-slug>' : 'row-<N>');
    });

  test("violates nothing: under wk's queue no subagent renames, and the relay sentence is unchanged", async () => {
    const raw =
      find(
        await render({ ...WK_LAND_STEP, commitPolicy: 'agent-pushes' }),
        'delegate/SKILL.md',
      ) ?? '';
    expect(raw).not.toContain('git branch -m');
    expect(raw).not.toContain('-build');
    expect(raw).toContain(
      'with that prompt as its whole brief. Count the passes: the\nsign-off names them.\n',
    );
    expect(raw).toContain('then these rules:\n\n- Do not edit');
    expect(raw).toContain('found untracked, and these rules:\n\n- Do not edit');
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

/**
 * Board row 127: a run outside `/autopilot` times the owner's messages and ends its record with an
 * **Owner** line; under `/autopilot` the times go into the run's state file instead, a clause that
 * renders only on a board, where that skill does (D22). A sentence that renders everywhere has as
 * its violating case the skill with that sentence moved out of step 0, which the check must name.
 */
describe("/delegate times the owner's attention", () => {
  const STEP_0 = { from: '## 0. Preconditions', to: '## 1. Read and claim' };
  const EVERYWHERE = [
    {
      name: 'the timing rule',
      text: "- **Time the owner's attention**, from the message that typed `/delegate` to the sign-off.",
    },
    {
      name: 'when the clock is read',
      text: 'Read the time from `date` when each owner message arrives, and before you post each question to the owner, and write each as an absolute time with its zone.',
    },
    {
      name: 'the Owner line',
      text: "Step 4's record, or a hold's dated note, then ends with one **Owner** line: the owner's messages counted, each with its time, and for each answered question the time it was posted, the time of the answer and the whole minutes between them, summed.",
    },
    {
      // Audit finding 5: the holds at steps 0, 3 and 6 write no dated note.
      name: 'a hold with no note',
      text: 'A hold that writes no note posts the line in chat.',
    },
    {
      // Audit finding 6: several items in one session would each count the same messages.
      name: 'several items at once',
      text: "Where step 5 runs several items, each message goes on the line of the item it concerns, and a message about several goes on the first one's.",
    },
  ];
  const UNDER_AUTOPILOT = {
    name: 'the /autopilot clause',
    text: "Under `/autopilot`, each time goes under **Owner** in the run's state file when it arrives, and the row's record has no **Owner** line: the run's rundown counts them.",
  };

  /** The sentences not found in step 0. */
  const misplaced = (text: string, sentences: Array<{ name: string; text: string }>) =>
    sentences
      .filter(({ text: sentence }) => {
        const start = text.indexOf(STEP_0.from);
        const at = text.indexOf(sentence, start);
        return start < 0 || at < 0 || at > text.indexOf(STEP_0.to, start);
      })
      .map(({ name }) => name);

  const flat = async (policy: string, profile: WorkProfile) =>
    (find(await render({ commitPolicy: policy }, profile), 'delegate/SKILL.md') ?? '').replace(
      /\s+/g,
      ' ',
    );

  for (const policy of ['print-blocks', 'agent-commits', 'agent-pushes', 'no-rule']) {
    test(`passes: under ${policy} on a board, every sentence is in step 0`, async () => {
      expect(misplaced(await flat(policy, 'ledger'), [...EVERYWHERE, UNDER_AUTOPILOT])).toEqual(
        [],
      );
    });

    test(`passes: under ${policy} on project folders, the rule is in step 0`, async () => {
      expect(misplaced(await flat(policy, 'folders'), EVERYWHERE)).toEqual([]);
    });

    test(`violates: under ${policy} on project folders, the /autopilot clause is absent`, async () => {
      const text = await flat(policy, 'folders');
      expect(misplaced(text, [UNDER_AUTOPILOT])).toEqual([UNDER_AUTOPILOT.name]);
      expect(text).not.toContain('autopilot');
    });
  }

  for (const sentence of [...EVERYWHERE, UNDER_AUTOPILOT])
    test(`violates: ${sentence.name}, moved out of step 0, is caught`, async () => {
      const text = await flat('agent-pushes', 'ledger');
      const moved = `${text.replace(sentence.text, '')} ${sentence.text}`;
      expect(misplaced(moved, [...EVERYWHERE, UNDER_AUTOPILOT])).toEqual([sentence.name]);
    });
});
