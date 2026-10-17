import { join } from 'node:path';
import { exists, readText } from '../lib/disk.ts';
import { claudeSkillsDir, repoRoot } from '../lib/paths.ts';
import { docStem, itemsDirFor } from '../lib/repo-config.ts';
import { readStamp, stampAfterFrontmatter, stampLine } from '../lib/stamp.ts';
import { fill } from '../lib/template.ts';
import type { GlobalFile, PlannedFile } from '../lib/types.ts';
import {
  answer,
  boardFile,
  hasBoard,
  isShortTrack,
  ledgerFile,
  planned,
  type RenderContext,
  trackOf,
  workRecordShape,
} from './context.ts';

const SKILLS = ['close-out', 'scope', 'passoff', 'handoff', 'clean-up'] as const;

/**
 * DIAL-6: the two that work without gates, commits or a board. `/scope` opens a project folder
 * and `/passoff` writes a board row, and a light setup writes neither (D6, D9) — a skill for a
 * file that is not there misleads the first time it fires.
 */
const LIGHT_SKILLS = ['close-out', 'handoff'] as const;

/**
 * `/audit` is written exactly where `/autopilot` is, because `/autopilot` loads it with the Skill
 * tool for its "audit first" option, and it writes board rows, which project folders keep none of
 * (audit-skill DESIGN 4.1). It carries no `disable-model-invocation`: the harness blocks a model's
 * Skill call to a skill that sets it, so `/autopilot` could not load it (owner, 2026-10-15).
 */
const AUTOPILOT_SKILLS = ['autopilot', 'audit'] as const;

/**
 * shared-skills-track D1 and D2: the two skills whose body follows the folder's own track and work
 * record. One copy in `~/.claude/skills/` carried the last run's track, or the first target's
 * names (F3, F4, F7), so each target gets its own under `<target>/.claude/skills/`. The global
 * copies leave through `leftovers`, because `skillFiles()` still names them: a personal skill wins
 * a name clash with a project one (F14), so a kept global copy would hide every target's.
 */
const TRACK_SKILLS: readonly string[] = ['close-out', 'handoff'];

/**
 * Every skill any track can install, which is the set a later run may find on disk and no longer
 * render (setup-global-leftovers BD-2). Built from the lists above so a new skill joins it where
 * it is offered.
 */
export function skillFiles(): GlobalFile[] {
  const names = new Set<string>([...SKILLS, ...LIGHT_SKILLS, 'delegate', ...AUTOPILOT_SKILLS]);
  return [...names].map((name) => ({ path: skillPath(name), label: skillLabel(name) }));
}

function skillPath(name: string): string {
  return join(claudeSkillsDir(), name, 'SKILL.md');
}

function skillLabel(name: string): string {
  return `skill — /${name}`;
}

/**
 * One directory per skill under `~/.claude/skills/<name>/SKILL.md`, matching the layout the
 * harness already loads. The frontmatter is what decides when a skill triggers, so it names
 * the phrasings a user actually types rather than describing the skill to itself.
 */
export async function renderSkills(ctx: RenderContext): Promise<PlannedFile[]> {
  const names = wantedSkills(ctx).filter((name) => !TRACK_SKILLS.includes(name));
  return Promise.all(names.map((name) => renderSkill(ctx, name, skillPath(name))));
}

/**
 * `/close-out` and `/handoff`, into the target this context renders (D1). A context with no target
 * renders neither (D4): `join('', ...)` is a relative path, which would land them in whatever
 * folder `setup` was started from.
 */
export async function renderTargetSkills(ctx: RenderContext): Promise<PlannedFile[]> {
  const root = ctx.repo?.scan.path;
  if (!root) return [];
  return Promise.all(
    targetSkills(ctx).map((name) => renderSkill(ctx, name, targetSkillPath(root, name))),
  );
}

function targetSkills(ctx: RenderContext): string[] {
  return wantedSkills(ctx).filter((name) => TRACK_SKILLS.includes(name));
}

function targetSkillPath(root: string, name: string): string {
  return join(root, '.claude', 'skills', name, 'SKILL.md');
}

/**
 * The ignore lines for the skills `renderTargetSkills` writes (D3), relative to the target root.
 * The folder, not `.claude/skills/` as a whole: a repo may ship skills of its own.
 */
export function targetSkillIgnores(ctx: RenderContext): string[] {
  return targetSkills(ctx).map((name) => `.claude/skills/${name}/`);
}

/**
 * PLAN BD-3: a global copy `leftovers` will not remove, because it has no stamp or is marked
 * `adapted`, still wins over each target's copy (F14). Only a skill some target is getting is
 * checked; elsewhere the global copy hides nothing.
 */
export async function shadowingCopies(planned: string[]): Promise<string[]> {
  const found = await Promise.all(
    TRACK_SKILLS.filter((name) => planned.some((path) => isTargetCopy(path, name))).map(
      async (name) => ((await isKeptCopy(skillPath(name))) ? skillPath(name) : null),
    ),
  );
  return found.filter((path): path is string => path !== null);
}

function isTargetCopy(path: string, name: string): boolean {
  return path !== skillPath(name) && path.endsWith(join('.claude', 'skills', name, 'SKILL.md'));
}

async function isKeptCopy(path: string): Promise<boolean> {
  if (!(await exists(path))) return false;
  const stamp = readStamp(await readText(path));
  return stamp === null || stamp.adapted;
}

/**
 * The question offers `all` and `none` and nothing else. An array from a hand-edited profile reads
 * as `none` through `answer()` and renders no skill. A per-skill path for it was here and never
 * reachable; it was removed rather than wired up because a selection that no question, catalog
 * option or long form describes is a hidden third answer (delegate-autopilot G54, 2026-10-05).
 */
function wantedSkills(ctx: RenderContext): string[] {
  return answer(ctx, 'skills', 'none') === 'all' ? [...offeredSkills(ctx)] : [];
}

/**
 * delegate-autopilot BD-1: `model-routing.md` names `/delegate` as the one exception to "a Deep
 * subagent never builds", so the rules renderer asks this rather than repeating the offer's
 * conditions, and the sentence and the skill cannot disagree.
 */
export function rendersDelegate(ctx: RenderContext): boolean {
  return wantedSkills(ctx).includes('delegate');
}

/** The sentence's `/autopilot` clause renders only where that skill does (BD-1, BD-20). */
export function rendersAutopilot(ctx: RenderContext): boolean {
  return wantedSkills(ctx).includes('autopilot');
}

/**
 * `/clean-up` drives `fold` and `archive`, and both refuse without an archive home — which only
 * the code + full track is asked for (setup-tracks `DESIGN.md` D26). Anywhere else its first
 * command would fail, and a skill whose first step fails is worse than no skill.
 *
 * `/delegate` needs a worktree per subagent, so git, and the full standard's gates for its
 * auditor to re-run, which the short track has none of (delegate-autopilot D1). It renders on both
 * work-record shapes (D22). `/autopilot` reads the board at every step, and project folders write
 * none, so it renders only where a board is written (D22).
 */
function offeredSkills(ctx: RenderContext): readonly string[] {
  if (trackOf(ctx).weight === 'light') return LIGHT_SKILLS;
  if (isShortTrack(ctx)) return SKILLS.filter((name) => name !== 'clean-up');
  if (!trackOf(ctx).usesGit) return SKILLS;
  return workRecordShape(ctx) === 'folders'
    ? [...SKILLS, 'delegate']
    : [...SKILLS, 'delegate', ...AUTOPILOT_SKILLS];
}

async function renderSkill(
  ctx: RenderContext,
  name: string,
  path: string,
): Promise<PlannedFile> {
  const source = await readText(join(repoRoot(), 'templates', 'skills', `${name}.md`));
  const filled = fill(source, variables(ctx, name, shapeOf(ctx)));
  const body = stampAfterFrontmatter(filled, stampLine(ctx.stamp));
  return planned(ctx, path, skillLabel(name), body, { stamp: false });
}

/**
 * What a rendered skill is allowed to assume about its reader (setup-tracks `DESIGN.md` §3.1).
 * D9 ratified `/handoff` and `/close-out` as "the two that survive without gates or commits" and
 * that half of it was wrong: both were written for a reader with a board, a code map, gate
 * commands and a commit to land the record in. Each field below is a thing one of them asserted
 * unconditionally.
 *
 * `folders` is the `work-profile` answer rather than a track axis, and it belongs here for the
 * same reason: on the short track it is forced to `ledger`, so the project-folder prose is
 * unreachable there, and on a full ledger target it was already false.
 */
type SkillShape = {
  short: boolean;
  board: boolean;
  code: boolean;
  git: boolean;
  folders: boolean;
  /**
   * Standard 2.0.0's record: an item file's close-out and a log line, where a board is written
   * beside a ledger (per-item-board D1 to D4). The light track writes no board and keeps its step
   * log (D3 As built), and project folders keep no ledger, so neither has an item to close.
   */
  items: boolean;
};

function shapeOf(ctx: RenderContext): SkillShape {
  const track = trackOf(ctx);
  const folders = workRecordShape(ctx) === 'folders';
  return {
    short: isShortTrack(ctx),
    board: hasBoard(ctx),
    code: track.workKind === 'code',
    git: track.usesGit,
    folders,
    items: hasBoard(ctx) && !folders,
  };
}

/** The file and folder names a skill cites, honouring an adopted name and an `itemsDir` (D7). */
type RecordNames = { ledger: string; ledgerStem: string; items: string };

function namesOf(ctx: RenderContext): RecordNames {
  const ledger = ledgerFile(ctx);
  return {
    ledger,
    ledgerStem: docStem(ledger),
    // `repo.ts` derives the folder the same way, so the router and every skill name one folder.
    items: ctx.repo?.scan.itemsDoc ?? itemsDirFor(boardFile(ctx)),
  };
}

/**
 * D12, applied to skill text. A skill is installed once per machine and read in every repo, and a
 * repo reads as 2.0.0 only once its items folder exists (Phase 2, G53). Until each repo migrates,
 * the same text has to tell a 1.x board's session where its record goes.
 */
function legacyBoard(names: RecordNames): string {
  return `On a 1.x board, with no \`${names.items}/\` folder beside it`;
}

function variables(
  ctx: RenderContext,
  name: string,
  shape: SkillShape,
): Record<string, string | null> {
  const landing = landingOf(ctx, shape);
  if (name === 'close-out') {
    return closeOutVars(shape, namesOf(ctx), wantedSkills(ctx).includes('clean-up'), landing);
  }
  if (name === 'handoff') return handoffVars(shape, namesOf(ctx));
  if (name === 'passoff') return passoffVars(shape, namesOf(ctx), ownersCall(ctx));
  if (name === 'clean-up') return cleanUpVars(shape, namesOf(ctx), agentPushes(ctx));
  if (name === 'delegate') return delegateVars(ctx, shape, landing);
  if (name === 'autopilot') return autopilotVars(ctx);
  if (name === 'audit') return auditVars(ctx);
  return {};
}

/**
 * `/audit`. Rendered only where `/autopilot` is, which is always a board beside a ledger, so its
 * rows' prompts are item files named by D7, numbered by `passoff next` (D16), with the 1.x
 * sentence for a repo that has not migrated (D12 As built, G68).
 */
function auditVars(ctx: RenderContext): Record<string, string> {
  return {
    BOARD_FILE: boardFile(ctx),
    ITEMS_DIR: namesOf(ctx).items,
    TIER_TABLE: tierTable(ctx, ''),
  };
}

/**
 * Whether the agent may commit. True under `agent-pushes` too, because the builder commits on its
 * branch under both policies; what `agent-pushes` adds is read from `agentPushes()`.
 */
function agentCommits(ctx: RenderContext): boolean {
  const policy = answer(ctx, 'commitPolicy', 'print-blocks');
  return policy === 'agent-commits' || policy === 'agent-pushes';
}

/**
 * Whether the run lands its own work: merges a signed-off branch into the base and pushes
 * (autonomous-autopilot D1, D6). Separate from `agentCommits()` so `agent-commits` keeps every
 * byte it renders, with no merge and no push, while `agent-pushes` gets the land step.
 */
function agentPushes(ctx: RenderContext): boolean {
  return answer(ctx, 'commitPolicy', 'print-blocks') === 'agent-pushes';
}

/**
 * Who lands a signed-off branch. `none`: the run merges nothing (every policy but `agent-pushes`).
 * `step`: a board's land step (D1). `direct`: project folders under `agent-pushes`, where the land
 * step's record (a log line, a `DONE` row, a tracked item file the builder commits its sign-off
 * into) does not exist, so the builder rule and the worktree step say the session fast-forwards
 * and pushes, and nothing in the text reserves git for the owner (D6 As built, 2026-10-16).
 */
type Landing = 'none' | 'step' | 'direct';

function landingOf(ctx: RenderContext, shape: SkillShape): Landing {
  if (!agentPushes(ctx)) return 'none';
  return shape.folders ? 'direct' : 'step';
}

/**
 * `/delegate`. Rendered only for code + full + git (`offeredSkills`), so the two axes left are the
 * work-record shape (D22: a board, or project folders recorded through the phase header) and the
 * commit policy (D10). The tier names are the person's own, filled here so the template carries no
 * model family name (D12). Its `/autopilot` clauses render only on a board, where that skill does
 * (D22); on project folders they would name a skill that is not installed.
 */
function delegateVars(
  ctx: RenderContext,
  shape: SkillShape,
  landing: Landing,
): Record<string, string | null> {
  const lands = landing === 'step';
  const commits = agentCommits(ctx);
  const vars = shape.folders
    ? delegateFolderVars()
    : delegateBoardVars(ctx, namesOf(ctx), commits, lands);
  // The land step takes section 6, so the worktree step moves to 7 under it.
  const removal = lands ? 7 : 6;
  return {
    ...vars,
    TIER_TABLE: tierTable(ctx, ''),
    // `null` drops the token's line, so section 5 and the worktree step stay one blank line apart.
    LAND_STEP: lands ? landStep() : null,
    WORKTREE_STEP: worktreeStep(
      removal,
      'run',
      [
        'Remove each worktree that is finished: every builder, auditor and relayed pass that came',
        'back with a worktree path and a branch. A',
      ],
      landing,
    ),
    COMMIT_RULE: builderRule(commits, landing),
    AUDIT_DIAL: lands ? auditDial() : '',
    // Item 95 audit, N1: the auditor's branch now holds the builder's commits, so the worktree
    // step keeps it.
    AUDIT_KEPT: commits
      ? [
          '',
          `The auditor's branch now holds the builder's commits, so step ${removal} keeps the auditor's`,
          "worktree until the builder's branch is merged. Expect that.",
        ].join('\n')
      : '',
    AUDIT_SOURCE: commits
      ? [
          "Take it from the builder's branch: from your worktree's own directory, run",
          "  `git merge --ff-only <the builder's branch>` as one plain command. Where the builder",
          '  reports that a hook blocked its commit, do not merge:',
          `  ${APPLY_PATCH}.`,
        ].join('\n')
      : [
          "Take it from the builder's patch: from your worktree's own directory,",
          `  ${APPLY_PATCH}. The`,
          "  `git add -N` puts the new files in your diffstat, so it can match the builder's.",
        ].join('\n'),
  };
}

/** G40: under `agent-pushes` the merge and the push are not banned, they wait for step 6 (4.1). */
function builderRule(commits: boolean, landing: Landing): string {
  // Folders have no step 6, so the rule names who lands as a fact; the rest is `agent-commits`'.
  if (landing === 'direct')
    return [
      'Commit on your own worktree branch, naming the exact files in both the `git add` and',
      '  the commit. This session lands your branch once the item is signed off: it runs',
      '  `git merge --ff-only` and `git push` on the base. If a hook blocks the commit, print the',
      '  two commit blocks, do not work around it, and make the patch the auditor works from:',
      `  ${MAKE_PATCH} List in your report every file the change adds.`,
    ].join('\n');
  if (landing === 'step')
    return [
      'Commit on your own worktree branch, naming the exact files in both the `git add` and',
      "  the commit. The merge into the base and the push are the land step's (step 6), which this",
      '  session sends you after the audit. If a hook blocks the commit, print the two commit',
      '  blocks, do not work around it, and make the patch the auditor works from:',
      `  ${MAKE_PATCH} List in your report every file the change adds.`,
    ].join('\n');
  if (commits)
    return [
      'Commit on your own worktree branch, naming the exact files in both the `git add` and',
      '  the commit. Never push and never merge. If a hook blocks the commit, print the two',
      '  commit blocks, do not work around it, and make the patch the auditor works from:',
      `  ${MAKE_PATCH} List in your report every file the change adds.`,
    ].join('\n');
  return [
    'Do not commit. Leave the change in the worktree. When it is done, make the patch the',
    `  auditor works from: ${MAKE_PATCH} List in your report every file the change adds.`,
  ].join('\n');
}

/**
 * Design D4, step 3: an unaudited row still has its gates run twice, by the builder and again by
 * the land step on the tree that lands. The diffstat numbers stay in `/autopilot`'s defaults
 * table, whose test pins each value written once.
 */
function auditDial(): string {
  return [
    '',
    '',
    'Under `/autopilot`, where its opening round chose audits by tier, a Mechanical or Light item',
    'lands on its gates with no auditor unless a trigger fires: a file changed outside its "Files it',
    'owns", a fix round or a relay pass, a number claimed, a diffstat above `/autopilot`\'s audit',
    "trigger, or a decider's load-bearing mark. Read the triggers from the builder's report, which",
    'carries the diffstat, the files changed, the relay passes and the numbers claimed. A report',
    // Without those two the triggers cannot be read, and an unread trigger must not land unaudited.
    'that lacks the diffstat or the file list is itself a trigger. With no trigger, step 4 signs it',
    "off on the builder's report, with the verdict",
    '"not audited: <tier>, no trigger", and step 6 runs its gates again on the tree that lands.',
  ].join('\n');
}

/**
 * D1: the builder merges the base and gates in its own worktree, where its dependencies are and
 * where this session never runs git; the lead only fast-forwards and pushes from the primary
 * checkout, so the base never takes a tree no gate ran on. Words as design 4.1 gives them.
 */
function landStep(): string {
  return [
    '## 6. Land it',
    '',
    "After step 4 signs an item off, land it: the base takes the builder's branch, gated on the tree",
    'that lands, and the push follows. The builder does the merge and the gates in its own worktree,',
    'because its dependencies are there and that worktree is the one place this session never runs',
    'git. Send it, with `SendMessage`, this step as it stands here, with `<base>`, the sign-off lines',
    'and the gate list written in:',
    '',
    "1. Where the item's file is tracked, append these sign-off lines to its close-out section:",
    '   <the lines step 4 wrote>. Commit that file alone, naming it.',
    "2. From your worktree's own directory, run `git merge --no-edit <base>` as one plain command,",
    '   with the branch name written out. A fast-forward and a merge commit are both right.',
    '3. On a conflict in a file your item\'s "Files it owns" lists, resolve it, `git add` that file,',
    '   run `git commit --no-edit`, and say which file and how. On a conflict in any other file, run',
    '   `git merge --abort` and report the file list: that is an undeclared overlap, and the row is',
    '   held.',
    "4. Run the fresh-checkout recipe's install line again, then every gate below: <the item's",
    "   done-when gates, and the repo's gate command where it has one>. A gate that cannot run here",
    '   is reported as skipped, with the reason.',
    '5. Report: the merge result with `git rev-parse HEAD`, each gate with its output, and',
    '   `git status --porcelain`, which must print nothing.',
    '',
    'A builder that returns a pass-off instead of this report is at its budget. Land the row from a',
    "worktree of your own: from the primary checkout, `git worktree add <a fresh path> <the builder's",
    // Deep review of row 113, finding 3: step 1 commits the sign-off lines, so skipping it left
    // them uncommitted wherever the item file is tracked.
    'branch>`, run steps 1 to 5 there with `git -C <that path>`, step 1 only where the pass-off does',
    'not say the lines were committed, and remove that worktree in step 7.',
    '',
    'Then, from the primary checkout, with `git -C` and the branch name written out:',
    '',
    '```bash',
    "git merge --ff-only <the builder's branch>",
    'git push',
    '```',
    '',
    'Never `--force`, and never a rebase: the auditor reproduced the commits that land. A refused',
    "fast-forward holds the row with git's output as its reason; where the base moved while the",
    // Deep review of row 113, finding 2: a second step 1 would append the sign-off lines twice.
    'builder was gating, send the message once more first, and the second send skips step 1, whose',
    'lines are committed already. A refused push lands the row, stops every later push in this',
    'session, and the rundown says how far ahead the base is. A red gate goes back to the builder as',
    "a blocking finding, through step 4's fix round. A gate that could not run here is listed under",
    '**Not verified**.',
    '',
    'Only now write the record: the log line and `DONE - <date>` on the board, as step 4 says. Under',
    "this policy a row is `DONE` when its commits are on the base. Then step 7 removes the row's",
    'worktrees, whose branches the base now holds.',
    '',
  ].join('\n');
}

/**
 * Item 95, finding 1: worktree isolation refuses `git -C` on another worktree, so the auditor
 * reproduces the build from a patch the builder writes outside the repo. `git add -N` puts the
 * new files into `git diff HEAD`, and `--binary` keeps a binary file appliable. Seen working six
 * times in six on the 2026-10-15 `/delegate` run, without `--binary`.
 */
const MAKE_PATCH =
  'run `git add -N` on each file the change adds, then\n  `git diff --binary HEAD > <patch>`.';

/**
 * The auditor applies the patch plainly, then marks the builder's listed new files intent-to-add
 * so its diffstat counts them. Never `git apply -N`: on git 2.49.0 it replaced the auditor's whole
 * index with the patch's new files (307 entries to 2), so every diffstat failed to match (item 95
 * audit, finding B1, reproduced twice).
 */
const APPLY_PATCH =
  'run `git apply <patch>`, then `git add -N` on each file the builder listed as added';

/**
 * The tier table as `tierTable` in `rules.ts` renders it (`<unset>` for an empty name, the Light
 * row only where that tier is on), less its "Use for" column, which carries prose the template's
 * own style rule forbids and which the skill does not need: the item names its tier.
 */
function tierTable(ctx: RenderContext, indent: string): string {
  const tiers = ctx.config.models;
  const rows = [
    `| Deep | ${tiers.deep || '<unset>'} |`,
    `| Default | ${tiers.default || '<unset>'} |`,
    `| Mechanical | ${tiers.fast || '<unset>'} |`,
  ];
  if (answer(ctx, 'modelLightEnabled') === 'yes')
    rows.push(`| Light | ${tiers.light || '<unset>'} |`);
  return ['| Tier | Model |', '|---|---|', ...rows]
    .map((row) => indent + row)
    .join('\n')
    .trimStart();
}

/**
 * `/autopilot`. Rendered only on code + full + git with a board (`offeredSkills`), so the axis left
 * is the commit policy: under `print-blocks` a row after one this run signed off but did not commit
 * is held for that commit, and under `agent-commits` it builds from that row's branch (D24). The
 * rundown's last section follows the same policy (D10).
 */
function autopilotVars(ctx: RenderContext): Record<string, string | null> {
  const commits = agentCommits(ctx);
  const autonomy = agentPushes(ctx) ? autopilotAutonomy(ctx) : autopilotSupervised();
  // `/autopilot` renders only on a board, so `agentPushes()` alone decides its land step.
  if (agentPushes(ctx))
    return {
      ...autopilotNames(ctx),
      ...autopilotLanding(),
      ...autonomy,
      END_COMMIT: endCommit(),
    };
  return {
    ...autopilotNames(ctx),
    ...autonomy,
    LAND_ROUTE: '',
    AFTER_UNCOMMITTED: commits
      ? [
          '- A row whose predecessor in its lane, or an item its "Waits on" names, was signed off in',
          "  this run builds from that row's worktree branch, and the rundown's merge order lists the",
          '  predecessor first. Where a hook blocked that commit, the predecessor is not committed:',
          '  the row is held, and its "Waits on" names the commit it waits for.',
        ].join('\n')
      : [
          '- No row before it in its lane, and no item its "Waits on" names, was signed off in this',
          '  run without a commit. Such a row is held, and its "Waits on" names the commit it waits',
          '  for. Nothing is built on work the owner has not seen.',
        ].join('\n'),
    FOLD_COMMIT: "and its commit blocks join the rundown's.",
    // The title is in the token, so `agent-pushes` can render its own in place of this one.
    COMMIT_BLOCKS: commits
      ? [
          '**Commit blocks**: for each worktree, its branch, in the merge order above, and the two',
          '      blocks for a worktree whose commit a hook blocked. No branch is pushed or merged.',
        ].join('\n')
      : [
          '**Commit blocks**: for each worktree, the two blocks the owner runs, `git -C <worktree>',
          '      add <files>` and `git -C <worktree> commit <files> -m "..."`, naming the same files.',
        ].join('\n'),
    // `null` drops the token's line, so step 4 keeps its bytes under every other policy.
    END_COMMIT: null,
  };
}

function autopilotNames(ctx: RenderContext): Record<string, string> {
  return {
    LEDGER_FILE: ledgerFile(ctx),
    BOARD_FILE: boardFile(ctx),
    ITEMS_DIR: namesOf(ctx).items,
    TIER_TABLE: tierTable(ctx, '   '),
  };
}

/**
 * Design 4.2 under `agent-pushes`: a successor builds from the base once its predecessor has
 * landed, the record waits for the fast-forward, and the rundown reports what landed and pushed.
 */
function autopilotLanding(): Record<string, string> {
  return {
    AFTER_UNCOMMITTED: [
      '- A row whose predecessor in its lane, or an item its "Waits on" names, was signed off in',
      "  this run is runnable once that row has landed (`/delegate`'s step 6): it builds from the",
      '  base, which now holds the predecessor. A predecessor whose landing is held holds it.',
    ].join('\n'),
    LAND_ROUTE: [
      '',
      '   Under this policy the record follows the landing: route a signed-off row to',
      "   `/delegate`'s step 6, and write the log line and `DONE` when its fast-forward lands.",
    ].join('\n'),
    // Deep review of row 113, finding 5: the fold prints no blocks here, step 4 commits its files.
    FOLD_COMMIT: "and its commit is step 4's.",
    COMMIT_BLOCKS: [
      '**Landed**: for each row, its branch, the merge commit or fast-forward, and',
      '      whether the push went; the rows landed and not pushed, with how far ahead the base is;',
      '      and the exact files step 4 commits.',
    ].join('\n'),
  };
}

/**
 * Design 4.2's Phase 2 tokens under the other three policies: the bytes the template held before
 * them, and `null` where a token sits alone on its line, so nothing those policies render moves.
 */
function autopilotSupervised(): Record<string, string | null> {
  return {
    EXTRA_DEFAULTS: null,
    CROSS_BOARD: null,
    SCOPE_FIRST: '- Its prompt does not say to scope first.',
    SHARED_WINDOW: '',
    DEEP_ROWS_OPTIONS: '. Several may be chosen; none is the default.',
    AUTONOMY_CALL: null,
    STATE_EXTRAS: null,
    SCOPE_RUN: null,
    QUESTION_RULE: [
      '4. **A question a builder reports for the owner** is answered here, never by asking. Where it only',
      ...heldQuestion(),
    ].join('\n'),
    CROSS_BOARD_HOLD: null,
    DECISIONS_SECTION: '**Decisions waiting for the owner**, copy variants among them.',
  };
}

/** The `2eff50c` rule for a builder's question, which both policies keep for one answer. */
function heldQuestion(): string[] {
  return [
    '   implements a decision the row or the design already made, take it, and log it under',
    '   **Judgment calls** with a one-line reversal. Anything else holds the row, with the question',
    '   under **Held**, even when the builder finished.',
  ];
}

/**
 * Design D2 to D5 and 4.2 under `agent-pushes`: the run decides, scopes, audits and waits by the
 * Autonomy call's answers. Each token names the answer it depends on, because the person may
 * have chosen the other one, and the skill must still say what happens then.
 */
function autopilotAutonomy(ctx: RenderContext): Record<string, string | null> {
  return {
    // Written once here; `/delegate`'s audit dial names the trigger row instead of its numbers.
    EXTRA_DEFAULTS: [
      '| Audit trigger: diffstat | More than 300 lines changed, or more than 8 files |',
      '| Decider questions per row | 3, then the row is held |',
    ].join('\n'),
    CROSS_BOARD: crossBoard(ctx),
    SCOPE_FIRST: [
      '- Its prompt does not say to scope first, or its item file carries a dated note that a run',
      '  scoped it and its gate was answered (section 5).',
    ].join('\n'),
    SHARED_WINDOW: [
      '',
      '   Where several runs are open at once, say that they read one window and the caps are joint, and',
      '   offer a larger weekly share.',
    ].join('\n'),
    DEEP_ROWS_OPTIONS: [
      ':',
      '   all of them, including rows written during the run; the rows named; or none, the default.',
    ].join('\n'),
    AUTONOMY_CALL: autonomyCall(),
    STATE_EXTRAS: [
      '  A row a run scoped (section 5) adds "scoped: <path>" to its line.',
      '- **Waits elsewhere**: one line for each row whose "Waits on" names another board: the row,',
      "  the board's path, the item, and whether the wait was met on the last wake.",
    ].join('\n'),
    SCOPE_RUN: scopeRun(),
    QUESTION_RULE: decider(),
    CROSS_BOARD_HOLD: [
      // A wait on a row that cannot run anyway (held, or behind its lane) would keep the run alive
      // for nothing, so only a wait that alone blocks a launch counts.
      "- Where the Autonomy call's question 11 took the default, a run with nothing in flight and at",
      '  least one open wait on another board, on a row that would otherwise be runnable, holds on the',
      '  holding wake instead of ending, until the end time.',
    ].join('\n'),
    DECISIONS_SECTION: [
      '**Decisions taken for the owner**, each with its reversal and its decider, followed by the',
      '      decisions still waiting, under **Decisions waiting for the owner**, copy variants among',
      '      them.',
    ].join('\n'),
  };
}

/**
 * Design 4.2 question 11: a board that cannot be read proves nothing about its item, so its wait
 * is unmet and held, never counted as absent (row 113 fix round, item 1). The example names this
 * repo's own board and folder, because the rule that pairs them is the same on the other board.
 */
function crossBoard(ctx: RenderContext): string {
  const board = boardFile(ctx);
  const items = namesOf(ctx).items;
  return [
    '- An item its "Waits on" names on another board, as `<absolute path to the other board> item',
    "  <n>`, is `DONE` there, or absent from both that board's table and the folder beside it named",
    `  after the board file, lowercased (\`${board}\` gives \`${items}/\`; no file there starts with`,
    '  `<n>-`). Read that board by path on every wake. Where the board file cannot be read, the wait',
    "  is unmet, and the row goes under **Held** with the path. Where the Autonomy call's question 11",
    '  took the other answer, such a wait is unmet.',
  ].join('\n');
}

/**
 * Design 4.2's four questions, as written, except question 9's "calls the owner's", which reads
 * "marks as the owner's call" so it names the mark the decider looks for (D2).
 */
function autonomyCall(): string {
  return [
    '',
    // "Always": the second call is skipped when it has nothing to ask, and these four still are.
    '**Autonomy call, always, after the second call where it is asked. Four questions.** Each default',
    'is first and marked recommended.',
    '',
    "8. **Questions during the run.** Decide a builder's question here, by how loud a wrong answer",
    "   would be, with the item file's own words binding and every decision logged with its reversal;",
    "   or hold every row that asks, as the wake procedure's step 4 says without this answer.",
    '9. **Scope-first rows.** Scope them in the run and answer the gate by each recommendation,',
    "   holding only a question the item file or the document marks as the owner's call; or leave",
    '   them out.',
    '10. **Audits.** By tier: Deep and Default rows audited, Mechanical and Light rows landed on their',
    '    gates unless a trigger fires; or every row.',
    '11. **Other boards.** Read every "Waits on" that names another board by path on each wake, and',
    '    hold instead of ending while such a wait is open; or treat such a wait as unmet.',
  ].join('\n');
}

/**
 * Design D3: the scoping lands before the build, so the builder reads the document from the base
 * and `doctor` scans it at the land step's gate; the Deep gate stands in for the audit.
 */
function scopeRun(): string {
  return [
    '',
    "Where the Autonomy call's question 9 took the default, a row whose prompt says to scope first is",
    'runnable for scoping when every other condition in section 2 holds, and its launch is a scoping',
    "run. Spawn a Default subagent in its own worktree with `/scope`'s text (its absolute path,",
    "read-only) and the row's prompt; it writes `docs/incomplete/<slug>/SCOPE.md` with every option",
    "carrying a recommendation, writes **owner's call** before a question only the owner can answer,",
    "as `/passoff` says, commits it naming the file, and asks no gate. Send the document's open",
    "questions and its path to a Deep decider under the wake procedure's step 4; it answers each by",
    'its recommendation unless the document or the code gives a reason not to, and holds on a',
    "question the item file or the document marks as the owner's. The scoper writes the answers",
    'under a dated **Answers** section, each as "decided by <model> in `<run folder>`, <date>,',
    'reversal: ...", commits, and you land the branch by `/delegate`\'s step 6 with no audit: the Deep',
    "gate is its review. Add a dated note to the row's item file naming the document and the gate's",
    'outcome; the row then counts as scoped, and a later wake may launch its build with the document',
    "as its design input. A held gate holds the row with the document landed, so the owner's",
    'morning starts at the gate.',
  ].join('\n');
}

/**
 * Design D2: the marks are listed because a rule a decider has to interpret is one it interprets
 * in its own favour, and the class goes up when unsure because a quiet wrong answer costs more.
 */
function decider(): string {
  return [
    '4. **A question a builder reports for the owner** is answered here, never by asking. Where the',
    "   Autonomy call's question 8 took the default, decide it. The item file's words come first: a",
    '   question it marks as the owner\'s holds the row, and so does an answer that would widen "Files',
    '   it owns" into a file another open row lists. The marks are the phrase "owner\'s call", a name',
    '   followed by "\'s call", "do not pick before", and an "Ask before building" entry the opening',
    '   round did not reach. Then decide by what a wrong answer does, going up a class when unsure:',
    // The added file goes into "Files it owns" so the overlap check sees it on the next launch.
    '   - *Caught at once* (a gate or the eye shows it: a copy variant, a casing, a default value, a',
    '     file to add that no other open row lists): this session decides. Where it adds a file to the',
    '     row, it also writes that file into the row\'s "Files it owns".',
    '   - *Looks right until tested* (a choice between designs, a flow, a shared primitive): a',
    '     Default subagent decides.',
    // Row 113 fix round, items 2 and 3: a Default decider had no way to hold, and a Deep one the
    // ceiling forbids had no rule, so either could answer a question that was the owner's.
    '   - *Compiles and passes every gate, wrong in production* (money, sync or merge rules, a',
    '     notification, data removed, a migration, a public contract, a file two rows touch): a Deep',
    '     subagent decides. Where the tier ceiling forbids a Deep decider, the row is held.',
    '',
    '   A decider runs in its own worktree, reads the item file, the question and the code it names,',
    '   and returns the decision, a one-line reversal, and whether the row is now load-bearing, which',
    "   is an audit trigger. Any decider that finds the question is the owner's returns that instead,",
    '   and the row is held. Send the answer to the builder with `SendMessage`, and log it under',
    "   **Judgment calls** with the reversal and the decider's model. The fourth question on one row",
    "   holds it. Under question 8's other answer, this session decides nothing: where it only",
    ...heldQuestion(),
  ].join('\n');
}

function delegateBoardVars(
  ctx: RenderContext,
  names: RecordNames,
  commits: boolean,
  lands: boolean,
): Record<string, string> {
  const { ledger, items } = names;
  const board = boardFile(ctx);
  return {
    GATE_CLEARED: [
      `On the board (\`${board}\`): an \`OPEN\` row with a model and a written prompt, every item`,
      '  its "Waits on" names `DONE` or gone from the table at a fold, and no "scope first".',
      '  Otherwise stop and run `/scope`.',
    ].join('\n'),
    TIER_HOLD: ', or, under `/autopilot`, hold the row',
    QUESTIONS_HELD: [
      ' Under',
      '  `/autopilot` its opening round asked them, and a row whose questions it did not reach is',
      '  held.',
    ].join('\n'),
    DEEP_LIFT: ", or lifted it in\n  `/autopilot`'s opening round",
    CONTEXT_RULE:
      " Under\n`/autopilot`, that skill's own rule on this session's context governs.",
    OWNS: 'its "Files it owns"',
    OWNS_PLURAL: '"Files it owns"',
    RECORD_FILES: 'the ledger and the board are',
    RECORD_FILES_OBJECT: `the ledger (\`${ledger}\`) or the board (\`${board}\`)`,
    CLAIM: [
      'Claim it with `personal-config passoff claim <n>` before spawning anything, so a parallel',
      "session sees the claim. Then find whether the item's file is tracked: it is when",
      `\`git ls-files --error-unmatch ${items}/<n>-<slug>.md\` succeeds here. Only a tracked file is`,
      "in a builder's worktree. Say which it is in the builder's brief.",
      ...(lands ? claimCommit(items) : []),
    ].join('\n'),
    ITEM_FILE_RULE: [
      '',
      "- Where the brief says the item's file is tracked, append its `## Close-out, <date>` section",
      '  there: what changed and why, what is now fixed, which questions it answered, and what is',
      '  left owed. Otherwise put that text in your report. It is the one record you write.',
    ].join('\n'),
    RECORD: lands ? landedRecord(names) : delegateRecord(names, commits),
    HELD: [
      'After that the row is `HELD`: its "Waits on" names the file the open findings are written in,',
      `  and the item's file gets a dated note of what is done and what is left.`,
    ].join('\n'),
  };
}

/**
 * Deep review of row 113, finding 1: `passoff claim` writes the claim line into the item file
 * here, uncommitted, and the builder's branch commits the same file, so the land step's
 * `--ff-only` is refused until the claim is committed. A tracked file is never new, so a plain
 * `git commit <path>` takes it with no `git add`.
 */
function claimCommit(items: string): string[] {
  return [
    'Where it is tracked, commit the claim before step 2, naming the file:',
    `\`git commit ${items}/<n>-<slug>.md -m "claim item <n>"\`. The land step fast-forwards the`,
    'primary checkout, and git refuses a fast-forward that would overwrite an uncommitted edit to',
    'that file.',
  ];
}

/**
 * D10: the lead keeps every write to the table, and a builder writes its own close-out only where
 * the file is in its worktree. The lead's sign-off lines go into that same section in the
 * builder's worktree, so the whole record lands in the builder's commit and the primary checkout
 * holds no edit to a file the builder's branch also changes.
 */
function delegateRecord(names: RecordNames, commits: boolean): string {
  const { ledger, ledgerStem, items } = names;
  // Finding 4 of the Deep review: a hook can still block an agent's commit, and the record must
  // say so, because `/autopilot` builds the next row from this branch only if it holds a commit.
  const state = commits
    ? 'committed on its branch and not merged, or "not committed" where a hook blocked it'
    : '"not yet committed"';
  return [
    "Write the record: the builder's and the auditor's models, the worktree, the branch, the",
    `  commit state (${state}), the relay passes, the verdict, each finding as \`open\`, and a`,
    "  Deep lift as the person's call. Where the item's file is tracked, add these to the close-out",
    "  section the builder wrote, in the builder's worktree. Where it is untracked, write the whole",
    `  section at the end of \`${items}/<n>-<slug>.md\` here, from the builder's report. Then add`,
    `  \`- <date> · closed item <n>\` at the end of the log in \`${ledger}\`, mark the row`,
    "  `DONE - <date>`, and post the `/close-out` hand-back blocks: in chat, or into the run's state",
    `  file under \`/autopilot\`. ${legacyBoard(names)}, the record is one step in \`${ledger}\``,
    '  at the next free number, read from the file now, with the same lines, and the row becomes',
    `  \`DONE - ${ledgerStem} <n>\`.`,
  ].join('\n');
}

/**
 * D1 under `agent-pushes`: the builder commits the sign-off lines itself in the land message, so
 * the lead never writes in a worktree it did not make, and the log line and `DONE` follow the
 * fast-forward, so a `DONE` row's commits are always on the base.
 */
function landedRecord(names: RecordNames): string {
  const { ledger, ledgerStem, items } = names;
  return [
    "Write the record: the builder's and the auditor's models, the worktree, the branch, the",
    '  commit state (landed on <base> at <hash>, or held at the land step), the relay passes, the',
    "  verdict, each finding as `open`, and a Deep lift as the person's call. Where the item's file",
    '  is tracked, these lines go into the land message (step 6), and the builder commits them.',
    `  Where it is untracked, write the whole section at the end of \`${items}/<n>-<slug>.md\` here,`,
    "  from the builder's report. The log line, `DONE - <date>` and the hand-back blocks wait for",
    "  step 6's fast-forward: then add `- <date> · closed item <n>` at the end of the log in",
    `  \`${ledger}\`, mark the row \`DONE - <date>\`, and post the \`/close-out\` hand-back blocks: in`,
    `  chat, or into the run's state file under \`/autopilot\`. ${legacyBoard(names)}, the record`,
    `  is one step in \`${ledger}\` at the next free number, read from the file now, with the same`,
    `  lines, and the row becomes \`DONE - ${ledgerStem} <n>\`.`,
  ].join('\n');
}

function delegateFolderVars(): Record<string, string> {
  return {
    GATE_CLEARED: [
      'A `PLANNED` phase in its project folder, with its subagents and its done-when stated.',
      '  Otherwise stop and run `/scope`.',
    ].join('\n'),
    TIER_HOLD: '',
    QUESTIONS_HELD: '',
    DEEP_LIFT: '',
    CONTEXT_RULE: '',
    OWNS: 'the files its phase names, where it names them,',
    OWNS_PLURAL: 'phases name files that',
    RECORD_FILES: 'the project folders are',
    RECORD_FILES_OBJECT: "the project folder's phase header, design or runtime-pass file",
    CLAIM: [
      'Mark the phase header `IN FLIGHT` before spawning anything, so a parallel session sees the',
      'claim.',
    ].join('\n'),
    ITEM_FILE_RULE: '',
    RECORD: [
      "The phase header becomes `BUILT <date>`, with the builder's and the auditor's models, the",
      '  worktree, the branch, the commit state, the relay passes, the verdict, each finding as',
      "  `open`, and a Deep lift as the person's call. The design gets `As built:` notes where the",
      "  build departed from a decision, and the runtime-pass file gets this phase's entries. Then",
      '  post the `/close-out` hand-back blocks in chat.',
    ].join('\n'),
    HELD: [
      'After that the phase is `HELD`, with a dated note in its header of what is done, what is left',
      '  and where the open findings are written.',
    ].join('\n'),
  };
}

/**
 * `/clean-up`. Only ever rendered for code + full (`offeredSkills`), so the board is always there
 * and the two axes left are the work-record shape and git. Profile P has no ledger or board to
 * fold, only folders; and without git `archive` refuses outright, because both of its checks —
 * who cites the folder, whether its final state is recorded — are questions for git.
 */
function cleanUpVars(
  shape: SkillShape,
  names: RecordNames,
  pushes: boolean,
): Record<string, string> {
  return {
    WHAT_MOVES: shape.folders
      ? 'closed project folders'
      : 'closed item files and their rows, old log lines, finished design folders',
    FINISHED: shape.folders ? finishedFolders() : finishedItems(names),
    MOVE_STEPS: [shape.folders ? '' : foldMove(shape, names, pushes), folderMove(shape, pushes)]
      .filter((step) => step !== '')
      .join('\n'),
    GREP_WHERE: shape.folders
      ? 'across every document in the tree'
      : 'across the ledger, the board, the open item files and every document in the tree',
    LIVE_TEXT: shape.folders
      ? 'an open project folder'
      : 'an open board row, an open item file, a ledger standing section',
    HISTORICAL_TEXT: shape.folders
      ? "a closed phase's `As built:` paragraph"
      : 'a close-out section, a log line, a `DONE` row, a ledger step',
    COMMIT_CLAUSE: shape.git ? commitClause(pushes) : '',
  };
}

/** Design 4.3: under `agent-pushes` the sweep commits and pushes its own changes. */
function commitClause(pushes: boolean): string {
  if (pushes)
    return [
      ' Then commit',
      'everything the sweep changed, naming the exact files, and push. **The archive may be its own',
      'repository**: its commit is rooted there and names its own files, exactly as the command',
      'printed it.',
    ].join('\n');
  return [
    ' Then the',
    'commit blocks for everything the sweep changed. **The archive may be its own repository**:',
    'its commit is rooted there and names its own files, exactly as the command printed it.',
  ].join('\n');
}

function finishedItems(names: RecordNames): string {
  return [
    '- **A board row** is finished when it says `DONE - <date>` and its item file holds a close-out',
    '  section. `SUPERSEDED` and `SETTLED AS NO` are finished too, but their files stay: each',
    '  carries a fact written nowhere else.',
    '- **A log line** is finished once it is older than 90 days.',
    '- **A design folder** is finished when every board row that names it is. One open row citing',
    '  it keeps it in the tree; a row the fold has taken off the table is finished.',
    `- **${legacyBoard(names)}**, a row is finished when it says \`DONE - <step>\` and that step`,
    '  is in the ledger, and a ledger step gives up its body once it is older than the newest',
    '  twenty. Its number, title and date stay, because every citation of it depends on that line.',
  ].join('\n');
}

function finishedFolders(): string {
  return [
    'A project folder is finished when every phase in it is checked off and its status says so.',
    'A folder with a phase left, or one marked `HELD`, stays in the tree.',
  ].join('\n');
}

/**
 * D6 and D16: the fold writes each `DONE` item's file to the archive, reads it back, and only then
 * removes the file and its row. In git it waits for the owner's commit, because a file folded
 * before that commit takes its close-out out of the history the commit was meant to hold.
 */
function foldMove(shape: SkillShape, names: RecordNames, pushes: boolean): string {
  return [...foldMoveBody(names), ...foldMoveTiming(shape, pushes)].join('\n');
}

/** Design 4.3: under `agent-pushes` the land step, not the owner, committed each close-out. */
function foldMoveTiming(shape: SkillShape, pushes: boolean): string[] {
  if (!shape.git) return [];
  if (pushes)
    return [
      "   Run it only once every `DONE` item's tracked close-out is on the base, which the land step",
      '   did.',
    ];
  return [
    "   Run it only once every `DONE` item's close-out is committed: a fold takes the file out",
    '   of the tree.',
  ];
}

function foldMoveBody(names: RecordNames): string[] {
  return [
    '1. **The board and the ledger**: `personal-config fold --dry-run`, then `personal-config fold`.',
    "   Each `DONE` item's file is written to the archive, read back, given an index line that keeps",
    '   what its row said, and only then removed with its row. An archive copy with other bytes',
    '   stops that item. Log lines older than 90 days go to the archive log. `personal-config undo`',
    `   puts back what it removed. ${legacyBoard(names)}, every row and every step number stays;`,
    '   prompts and old bodies go.',
  ];
}

function folderMove(shape: SkillShape, pushes: boolean): string {
  const n = shape.folders ? '1' : '2';
  if (!shape.git)
    return [
      `${n}. **Each finished folder**: \`personal-config archive\` needs git and refuses without it, so`,
      '   do its steps yourself: grep for what cites the folder, copy it to the archive, **verify',
      '   every file arrived before deleting the original**, and give it one line in the',
      "   archive's `INDEX.md`.",
    ].join('\n');
  return [
    `${n}. **Each finished folder**: \`personal-config archive <slug>\`. It lists what cites the`,
    '   folder and whether the repo has recorded its final state. A path read at runtime blocks',
    ...archiveCommit(pushes),
  ].join('\n');
}

/** Design 4.3: under `agent-pushes` the sweep commits the folder's final state itself. */
function archiveCommit(pushes: boolean): string[] {
  if (pushes)
    return [
      "   the move: repoint it first. Uncommitted changes block it too: commit the folder's final",
      '   state yourself, naming its files, then `personal-config archive <slug> --move --dry-run`,',
      '   then again without `--dry-run`.',
    ];
  return [
    '   the move: repoint it first. Uncommitted changes block it too, and **the commit is the',
    "   owner's**: post the blocks it prints and stop there for that folder. Once it is committed,",
    '   `personal-config archive <slug> --move --dry-run`, then again without `--dry-run`.',
  ];
}

/**
 * `/close-out`. Three things it asserted of every reader: that the record lands in a commit
 * beside code, that there is a board item or a phase to close, and that "gates green" is a claim
 * the reader can make. None holds on the short track, and the runtime-pass block never held for a
 * ledger target on any track.
 */
function closeOutVars(
  shape: SkillShape,
  names: RecordNames,
  cleanUp: boolean,
  landing: Landing,
): Record<string, string> {
  const blocks = handBackBlocks(shape);
  return {
    CLOSE_OUT_TRIGGER: trigger(shape),
    WORK_UNIT: workUnit(shape),
    RECORD_WHERE: recordWhere(shape),
    RECORD_STEPS: [
      recordStep(shape, names),
      foldStep(shape, landing === 'step'),
      landedEarly(shape),
    ]
      .filter((step) => step !== '')
      .join('\n'),
    BLOCK_COUNT: blocks.length === 3 ? 'three' : 'two',
    HAND_BACK_BLOCKS: blocks.join('\n'),
    PROOF_SENTENCE: proofSentence(shape),
    WORKTREE_STEP: shape.git ? `\n\n${closeOutWorktreeStep(landing)}` : '',
    CLEAN_UP_STEP: cleanUp ? `\n\n${cleanUpStep(shape, names)}` : '',
  };
}

/**
 * Workflow-refinement D4 (ezhomesteading, 2026-10-16): every close-out ends by sweeping what
 * earlier work left finished, because nothing else runs `/clean-up` and closed folders pile up.
 * Rendered only where `/clean-up` is, so the step never names a skill that is not installed. It
 * comes after the worktree step, and like it lands above the blocks, so the model line stays last.
 */
function cleanUpStep(shape: SkillShape, names: RecordNames): string {
  const n = shape.git ? 5 : 4;
  const what = shape.folders ? cleanUpFolders() : cleanUpBoard(names);
  return [
    `## ${n}. Run \`/clean-up\`, last`,
    '',
    'Load `/clean-up` with the Skill tool and run it for what earlier work left finished.',
    ...what,
    'It waits for a yes in chat before it moves anything. Put its report and its blocks above the',
    'blocks of step 2, so the model line stays last in the message.',
  ].join('\n');
}

function cleanUpFolders(): string[] {
  return ['Each project folder whose phases are all checked off moves to the archive.'];
}

function cleanUpBoard(names: RecordNames): string[] {
  return [
    `On a board with a \`${names.items}/\` folder, its fold moves each \`DONE\` item's file and its`,
    'row to the archive, and a `DONE` row with no file gets an archive file that holds the row.',
    `${legacyBoard(names)}, the fold moves \`DONE\` prompts and old`,
    'step bodies, and every row stays. Finished design folders move to the archive on both.',
  ];
}

function trigger(shape: SkillShape): string {
  if (shape.folders) return 'a board item or a phase is finished';
  return shape.board ? 'a board item is finished' : 'a piece of work is finished';
}

function workUnit(shape: SkillShape): string {
  if (shape.folders) return 'Every phase and every board item';
  return shape.board ? 'Every board item' : 'Every piece of work';
}

/** Where the record lands. No git, no commit to land it in — the record is the whole ritual. */
function recordWhere(shape: SkillShape): string {
  if (!shape.git) return '';
  return shape.code ? ', in the same commit as the code' : ', in the same commit as the work';
}

function recordStep(shape: SkillShape, names: RecordNames): string {
  if (shape.folders) return phaseHeader();
  if (shape.items) return itemRecord(shape, names);
  const tail = shape.short
    ? [
        '  answered. **Do not edit a step you did not write**; append a correction as a new step.',
      ]
    : [
        '  answered. Add any new file to the code map. **Do not edit a step you did not write**;',
        '  append a correction as a new step.',
      ];
  return [
    '- **One new step at the next free number**: **read the file to find it**, do not trust a',
    '  number written elsewhere. Name what changed, why, what is now fixed, and which questions it',
    ...tail,
  ].join('\n');
}

/**
 * Standard 2.0.0 (D2, D3, D4, D13): the close-out section is what the step body was, the log line
 * cites the number because the file moves at the fold, and `DONE` carries the date.
 */
function itemRecord(shape: SkillShape, names: RecordNames): string {
  const when = shape.git
    ? 'when, which model, on which branch and at which commit'
    : 'when and which model';
  const map = shape.short ? '' : ' Add any new file to the code map.';
  return [
    `- **A \`## Close-out, <date>\` section at the end of the item's own file**, \`${names.items}/<n>-<slug>.md\`:`,
    `  ${when}; ${closeOutContents(shape)}; and **Left owed:** what it did not do.${map}`,
    "  **Do not edit another item's file.**",
    `- **One line at the end of the log in \`${names.ledger}\`**: \`- <date> · closed item <n>\`. The`,
    '  number, never the path: the file moves to the archive at the next fold.',
    '- **The row becomes `DONE - <date>`**, the day the item closed.',
    `- **${legacyBoard(names)}**, write one new step in \`${names.ledger}\` instead, at the next free`,
    `  number, read from the file, and the row becomes \`DONE - ${names.ledgerStem} <n>\`.`,
  ].join('\n');
}

/** What a close-out names; the short track has a proof line where the full one has gates. */
function closeOutContents(shape: SkillShape): string {
  return shape.short
    ? 'what changed, why, what is now settled, how the proof line was applied (what was checked and what was seen)'
    : 'what changed, why, what is now fixed, which questions it answered';
}

/** The project-folder profile's record: no ledger at all, so no step to append (`repo.ts:184`). */
function phaseHeader(): string {
  return [
    '- **The phase header** becomes `**BUILT <date>, commit <hash>**`, plus any deviation,',
    '  discovery or re-ordering this phase forced on later phases. The design gets its',
    "  `As built:` paragraphs. The runtime-pass file gets this phase's entries.",
  ].join('\n');
}

/**
 * The fold, as a close-out step (standard 1.2.0, Part 7).
 *
 * Absent for the project-folder profile, which has no ledger and no board to fold: its closed
 * work is archived whole by Part 7's other half, and a step telling it to trim a log it does
 * not keep is a step that reads as a mistake in the document.
 */
function foldStep(shape: SkillShape, lands: boolean): string {
  if (shape.folders) return '';
  if (shape.items) return itemFoldStep(shape, lands);
  const dead = shape.board
    ? "this item's prompt, now its row says `DONE`, and any step body older than the newest twenty"
    : 'any step body older than the newest twenty';
  return [
    `- **Fold what is now dead**: ${dead}.`,
    '  `personal-config fold` does it: the row keeps its pointer and a step keeps its number,',
    '  title and date as one line, because every citation depends on that line still being there.',
    '  It appends to the archive and reads it back before it cuts, which is the only safe order',
    '  for a document git is not holding a copy of.',
  ].join('\n');
}

/**
 * D6 and D16. The item just closed is folded by a later close-out in git, never by this one: a
 * fold takes the file out of the tree, so folding it before the owner's commit leaves its
 * close-out out of the history that commit was meant to hold.
 */
function itemFoldStep(shape: SkillShape, lands: boolean): string {
  return [...itemFoldBody(), ...foldTiming(shape, lands)].join('\n');
}

/** Design 4.3: under `agent-pushes` the land step, not the owner, put the close-out on the base. */
function foldTiming(shape: SkillShape, lands: boolean): string[] {
  if (!shape.git) return [];
  if (lands)
    return [
      "  Fold an item only once its close-out is on the base, so this item's file waits for the next",
      '  close-out or for `/clean-up`.',
    ];
  return [
    "  Fold an item only once the owner has committed its close-out, so this item's file waits",
    '  for the next close-out or for `/clean-up`.',
  ];
}

function itemFoldBody(): string[] {
  return [
    "- **Fold what is dead.** `personal-config fold` moves each `DONE` item's file to the archive,",
    '  and its row leaves the table with it; the archive index line keeps what the row said. Log',
    '  lines older than 90 days go to the archive log. It writes the archive and reads it back',
    '  before it removes anything, which is the only safe order for a document git is not holding',
    '  a copy of.',
  ];
}

function landedEarly(shape: SkillShape): string {
  if (shape.board)
    return [
      '- **Landed early, or interrupted?** Same ritual, different header: leave the item unmarked, add',
      `  a dated status note${shape.items ? ' to its file' : ''} (what is done, what is left, what it changes about the plan),`,
      '  and write the pass-off. It then targets *the remainder of this item*, not the next one.',
    ].join('\n');
  return [
    '- **Landed early, or interrupted?** Same ritual, different header: record what is done, what',
    "  is left, and what it changes about the plan. The next session's prompt then targets *the",
    '  remainder of this work*, not the next piece.',
  ].join('\n');
}

/**
 * Block B is the runtime-pass file, which only the project-folder profile has. A ledger target
 * was being told to post entries for a file its own setup never wrote, on every track.
 */
function handBackBlocks(shape: SkillShape): string[] {
  const blocks = [
    shape.board
      ? [
          '- **Block A: the pass-off prompt**, in full, as a fenced block. It must stand alone: the next',
          '  agent will not see this conversation.',
        ].join('\n')
      : [
          "- **Block A: the next session's prompt**, in full, as a fenced block. It must stand",
          '  alone: the next agent will not see this conversation.',
        ].join('\n'),
  ];
  if (shape.folders)
    blocks.push(
      [
        '- **Block B: the runtime entries this piece added.** Three lines each: the goal it checks in',
        '  product terms, exactly where and how to reach it, and what the right answer is, including',
        '  the query that finds the fixture, not an id that will rot.',
      ].join('\n'),
    );
  const letter = shape.folders ? 'C' : 'B';
  blocks.push(
    [
      `- **Block ${letter}: the next session's model**, on its own line, last in the message, because it is`,
      '  the first thing the owner acts on.',
    ].join('\n'),
  );
  return blocks;
}

/** D7: the proof line is what replaces "gates green" wherever the short standard is the standard. */
function proofSentence(shape: SkillShape): string {
  if (!shape.short)
    return [
      '"Gates green, not seen running" and "walked the flow on the device" are different claims and',
      'must never be merged. Say which one you have, per item.',
    ].join('\n');
  return [
    'Apply the proof line to what was done and write down what you saw. "It passed" is no record.',
    '"Checked against the source" and "looks right" are different claims and must never be merged.',
    'Say which one you have.',
  ].join('\n');
}

/**
 * Its report sits above step 2's blocks because the model line is the first thing the owner acts
 * on, so it has to stay last in the message.
 */
function closeOutWorktreeStep(landing: Landing): string {
  return [
    worktreeStep(
      4,
      'session',
      [
        'Remove each worktree that is finished: each one its subagents came back with, and each one',
        'it added itself with `git worktree add`. A',
      ],
      landing,
    ),
    '',
    'Do this before you post the blocks in step 2, and put its report above them, so the model',
    'line stays last in the message. Never remove the worktree this session runs in.',
  ].join('\n');
}

/**
 * A subagent's worktree outlives it and nothing else removes it: one scan found 36 under one
 * projects folder, about 55 GB, most of them left by `/delegate` runs (owner, 2026-10-15). The
 * removal is limited to worktrees the run made because a worktree just added for new work is
 * clean and its branch is merged too, so "merged and clean" alone would take a peer's fresh one.
 */
function worktreeStep(
  n: number,
  maker: 'run' | 'session',
  which: string[],
  landing: Landing,
): string {
  return [
    `## ${n}. Remove the worktrees this ${maker} made`,
    '',
    ...which,
    "subagent's worktree outlives it, and nothing else removes it. Run each check from the primary",
    'checkout, with `git -C`; never `cd` into a worktree, because one you stand in cannot be removed.',
    '',
    ...worktreeCommands(),
    '',
    ...worktreeLimits(maker, landing),
  ].join('\n');
}

function worktreeCommands(): string[] {
  return [
    '```bash',
    'git merge-base --is-ancestor <branch> <base>',
    'git -C <worktree> status --porcelain',
    '```',
    '',
    'Remove it only when the first exits 0 (the base holds every commit on the branch) and the',
    'second prints nothing (no change and no untracked file):',
    '',
    '```bash',
    'git worktree remove <worktree>',
    'git branch -d <branch>',
    '```',
  ];
}

function worktreeLimits(maker: 'run' | 'session', landing: Landing): string[] {
  const never = [
    'Never add `--force` and never use `-D`: git refuses to remove a dirty worktree or to delete an',
    `unmerged branch, and that refusal is the check. Never remove a worktree this ${maker} did not`,
    'make, because a worktree just added for new work is clean and its branch is merged too.',
  ];
  if (landing === 'step') return [...never, ...landedLimits()];
  if (landing === 'direct') return [...never, ...directLimits()];
  return [
    ...never,
    'This step merges nothing, so it never merges into a branch the repo marks as protected, or into',
    'any other. Keep every other worktree, and report each one in one line with its reason: a commit',
    "the base does not hold, or uncommitted files. A change that waits for the owner's commit is the",
    'usual reason. That worktree stays until its work is committed and merged, then goes by the same',
    'checks. Ignored files such as `node_modules` and `.env` go with a worktree when it is removed.',
  ];
}

/**
 * Design 4.1, section 7: under `agent-pushes` the merge is the land step's. The sentence on the
 * owner's commit goes too: no commit waits for the owner under that policy, and design 4.5's
 * sweep regex matches it.
 */
function landedLimits(): string[] {
  return [
    'The merge happened in the land step; this step only removes. Keep every other worktree, and',
    'report each one in one line with its reason: a commit the base does not hold, or uncommitted',
    'files. That worktree stays until its work is committed and merged, then goes by the same',
    'checks. Ignored files such as `node_modules` and `.env` go with a worktree when it is removed.',
  ];
}

/**
 * Project folders under `agent-pushes` have no land step, so this step is where the session lands
 * (D6 As built, 2026-10-16). `--ff-only` keeps D1's guarantee that the base takes only a tree a
 * gate ran on; a refusal leaves the branch unmerged, so the checks below keep its worktree.
 */
function directLimits(): string[] {
  return [
    'First land each branch whose work is signed off: from the primary checkout, with `git -C` and',
    'the branch name written out, run `git merge --ff-only <branch>`, then `git push`. Never',
    "`--force`, and never a rebase. A refused fast-forward or push leaves that branch, and git's",
    'output goes in the report. Then this step only removes. Keep every other worktree, and report',
    'each one in one line with its reason: a commit the base does not hold, or uncommitted files.',
    'That worktree stays until its work is committed and merged, then goes by the same checks.',
    'Ignored files such as `node_modules` and `.env` go with a worktree when it is removed.',
  ];
}

/**
 * `/handoff`. It named the full ledger's standing sections by name, told the reader to read the
 * ledger "before the board", and closed by demanding every gate command be run once before it is
 * written into an `Environment` section the short ledger does not have.
 */
function handoffVars(shape: SkillShape, names: RecordNames): Record<string, string> {
  return {
    LEDGER_AND_BOARD: ledgerAndBoard(shape),
    READ_BEFORE: readBefore(shape, names),
    RECORDING: shape.items ? itemRecording(shape, names) : stepRecording(shape),
    STANDING_SECTIONS: shape.short
      ? 'Orientation, How things are here, Settled, Known facts and quirks'
      : 'Environment, Settled, Code map, Invariants, Known facts',
    CITATION_FORMS: citationForms(shape),
    PROOF_OR_GATES: proofOrGates(shape),
  };
}

function ledgerAndBoard(shape: SkillShape): string {
  if (shape.board)
    return [
      'The ledger is **what is true**. The board is what is next. Keep them apart: a fact in the board',
      'rots the moment its item is done.',
    ].join('\n');
  return [
    'The ledger is **what is true**: the one record of this work, appended to and never rewritten.',
    'There is no board here: what is next is the prompt the last session left in the chat.',
  ].join('\n');
}

/** D3: once the step log leaves, the ledger is small enough to read whole, then one item file. */
function readBefore(shape: SkillShape, names: RecordNames): string {
  const work = shape.code ? 'before any code' : 'before any work';
  if (shape.items)
    return `in full, before the board and ${work}; of the files in \`${names.items}/\`, read only your own item's`;
  return shape.board ? `before the board and ${work}` : work;
}

/** The 1.x record, which the light track keeps because it writes no board (D3 As built). */
function stepRecording(shape: SkillShape): string {
  return [
    '## Appending a step',
    '',
    '**Take the next free number by reading the file.** Another session may have taken the one a doc',
    'predicted. **Do not edit a step you did not write**: append a correction as a new step, so the',
    'wrong claim stays findable, marked wrong, with the disproof beside it.',
    '',
    stepNames(shape),
    '',
    '`personal-config handoff step` does that read for you: it reports the next free number, the',
    "ledger's modification time, and what a step has to name. It cannot *reserve* the number, since",
    'only writing would, so re-read the file immediately before you append.',
  ].join('\n');
}

function stepNames(shape: SkillShape): string {
  if (!shape.short)
    return [
      'A step names: what changed, why, what is now fixed, which questions it answered, and what is',
      'left owed. It is addressable forever: "HANDOFF 24" is how everything else refers to that work.',
    ].join('\n');
  return [
    'A step names: what changed, why, what is now settled, how the proof line was applied (what',
    'was checked and what was seen), and what is left owed. It is addressable forever: "step 24"',
    'is how everything else refers to that work.',
  ].join('\n');
}

/** Standard 2.0.0: the close-out section and the log line replace the step (D2 to D4, D13). */
function itemRecording(shape: SkillShape, names: RecordNames): string {
  const { items, ledgerStem } = names;
  return [
    '## Recording work',
    '',
    `**A closed item's record is the close-out section at the end of its own file**,`,
    `\`${items}/<n>-<slug>.md\`, written by the session that did the work. It names ${closeOutContents(shape)},`,
    "and what is left owed. The file is its writer's own: never edit another item's close-out.",
    '',
    '**Then one line at the end of `## Log`**: `- <date> · closed item <n>`. Cite the item by its',
    'number, never its path: the file moves to the archive at the next fold, and the number still',
    'finds it. Work that is not an item, such as an `/autopilot` run or a fix the owner asked for in',
    'chat, gets one line that ends in the path of what it wrote.',
    '',
    '`personal-config handoff step` prints both scaffolds and writes nothing. Where this ledger once',
    `had numbered steps, they are in the archive's \`${ledgerStem}-log.md\`, and a`,
    `\`DONE - ${ledgerStem} <n>\` row still points at one of them.`,
    '',
    `**${legacyBoard(names)}**, the record is one step in this ledger at the next free number,`,
    'read from the file, and a step you did not write is never edited.',
  ].join('\n');
}

/**
 * `/passoff`. Where the prompt goes (D1, D7, D16), and what is true once it has run: the close-out
 * section on 2.0.0, the ledger step on a 1.x board and in project folders.
 */
function passoffVars(
  shape: SkillShape,
  names: RecordNames,
  ownersCall: boolean,
): Record<string, string> {
  return {
    PROMPT_HOME: shape.items ? promptHome(names) : '',
    TRUTH: shape.items ? "The item's close-out section" : 'The ledger step',
    OWNERS_CALL: ownersCall ? ownersCallSentence() : '',
  };
}

/**
 * Autonomous-autopilot D10: the phrase `/autopilot`'s decider holds a row on (D2). Only where that
 * skill renders and the run may decide unattended, so every other policy keeps its bytes.
 */
function ownersCall(ctx: RenderContext): boolean {
  return rendersAutopilot(ctx) && agentPushes(ctx);
}

function ownersCallSentence(): string {
  return [
    '',
    "   Where a question must wait for the owner even in an unattended run, write **owner's call**",
    "   before it: `/autopilot`'s decider holds a row on those words and never answers it.",
  ].join('\n');
}

/**
 * Autonomous-autopilot D7: after the fold the run commits its own folder and the fold's tracked
 * moves, by name, and pushes. Words as design 4.2's "Step 4 gains"; the inner backticks around
 * the two file names are dropped, because a code span cannot nest one.
 */
function endCommit(): string {
  return [
    "   Then commit the run from the primary checkout, with `git -C`: `git add <the run folder's",
    // `/clean-up` commits its own moves under this policy, and a commit naming paths with nothing
    // to commit fails, so only what is still uncommitted is named.
    '   STATE.md and RUNDOWN.md, and each tracked file the fold moved, removed or changed that is',
    '   still uncommitted>`, then',
    '   `git commit <the same files> -m "autopilot run <date>"`, then `git push`. Untracked records',
    '   stay as they are. Where the archive is its own repository, commit there too, naming its',
    '   files, and push where it has a remote.',
  ].join('\n');
}

function promptHome(names: RecordNames): string {
  const { items } = names;
  return [
    '',
    '',
    `**Where it goes.** One file per item, \`${items}/<n>-<slug>.md\`, and its row in the table, in`,
    'the same edit. The file opens with `# <n>. <Title>`, then the dated line saying why it exists,',
    'then the nine parts. `personal-config passoff next` reports the next free number, read from the',
    'table, the folder and the archive: a number is never reused, even after its row has left the',
    'table. The slug is the title in lower case, each run of other characters one hyphen, cut at a',
    'hyphen to at most 48 characters. It is named once and never renamed.',
    `${legacyBoard(names)}, the prompt is a \`### <n>.\` section below the table.`,
  ].join('\n');
}

/**
 * The line break inside the code-and-git form is the wrapping the template shipped with, kept so
 * that the one shape this row does not change renders the byte it rendered before.
 */
function citationForms(shape: SkillShape): string {
  if (shape.code)
    return shape.git
      ? '`file:line`, a commit, a migration name, or the command\n  that produced it'
      : '`file:line`, a migration name, or the command that\n  produced it';
  return shape.git
    ? "the file and where in it, a commit, a document's date, or the\n  person who said so"
    : "the file and where in it, a document's date, or the person\n  who said so";
}

function proofOrGates(shape: SkillShape): string {
  if (!shape.short)
    return [
      '**Run every gate command once before writing it into Environment.** A command in a doc that has',
      'never been run in this repo is a trap for every session after you.',
    ].join('\n');
  return [
    '**Write down what proves the work sound, checked rather than assumed.** The proof line under',
    '"How things are here" is what every closing session checks against, and one that has never',
    'been applied here is a trap for every session after you.',
  ].join('\n');
}
