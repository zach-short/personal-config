import { join } from 'node:path';
import { readText } from '../lib/disk.ts';
import { claudeSkillsDir, repoRoot } from '../lib/paths.ts';
import { stampAfterFrontmatter, stampLine } from '../lib/stamp.ts';
import { fill } from '../lib/template.ts';
import type { PlannedFile } from '../lib/types.ts';
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
 * One directory per skill under `~/.claude/skills/<name>/SKILL.md`, matching the layout the
 * harness already loads. The frontmatter is what decides when a skill triggers, so it names
 * the phrasings a user actually types rather than describing the skill to itself.
 */
export async function renderSkills(ctx: RenderContext): Promise<PlannedFile[]> {
  return Promise.all(wantedSkills(ctx).map((name) => renderSkill(ctx, name)));
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
    : [...SKILLS, 'delegate', 'autopilot'];
}

async function renderSkill(ctx: RenderContext, name: string): Promise<PlannedFile> {
  const source = await readText(join(repoRoot(), 'templates', 'skills', `${name}.md`));
  const filled = fill(source, variables(ctx, name, shapeOf(ctx)));
  const body = stampAfterFrontmatter(filled, stampLine(ctx.stamp));
  return planned(ctx, join(claudeSkillsDir(), name, 'SKILL.md'), `skill — /${name}`, body, {
    stamp: false,
  });
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
};

function shapeOf(ctx: RenderContext): SkillShape {
  const track = trackOf(ctx);
  return {
    short: isShortTrack(ctx),
    board: hasBoard(ctx),
    code: track.workKind === 'code',
    git: track.usesGit,
    folders: workRecordShape(ctx) === 'folders',
  };
}

function variables(
  ctx: RenderContext,
  name: string,
  shape: SkillShape,
): Record<string, string> {
  if (name === 'close-out') return closeOutVars(shape);
  if (name === 'handoff') return handoffVars(shape);
  if (name === 'clean-up') return cleanUpVars(shape);
  if (name === 'delegate') return delegateVars(ctx, shape);
  if (name === 'autopilot') return autopilotVars(ctx);
  return {};
}

/**
 * `/delegate`. Rendered only for code + full + git (`offeredSkills`), so the two axes left are the
 * work-record shape (D22: a board, or project folders recorded through the phase header) and the
 * commit policy (D10). The tier names are the person's own, filled here so the template carries no
 * model family name (D12). Its `/autopilot` clauses render only on a board, where that skill does
 * (D22); on project folders they would name a skill that is not installed.
 */
function delegateVars(ctx: RenderContext, shape: SkillShape): Record<string, string> {
  const commits = answer(ctx, 'commitPolicy', 'print-blocks') === 'agent-commits';
  const vars = shape.folders ? delegateFolderVars() : delegateBoardVars(ctx, commits);
  return {
    ...vars,
    TIER_TABLE: tierTable(ctx, ''),
    COMMIT_RULE: commits
      ? [
          'Commit on your own worktree branch, naming the exact files in both the `git add` and',
          '  the commit. Never push and never merge. If a hook blocks the commit, print the two',
          '  commit blocks and do not work around it.',
        ].join('\n')
      : 'Do not commit. Leave the change in the worktree, and list every untracked file it adds.',
    AUDIT_SOURCE: commits
      ? "Take it from the builder's branch."
      : [
          "Take it from the builder's diff against `HEAD` (`git -C <builder's",
          '  worktree> diff HEAD`) and the untracked files the builder listed.',
        ].join('\n'),
  };
}

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
function autopilotVars(ctx: RenderContext): Record<string, string> {
  const commits = answer(ctx, 'commitPolicy', 'print-blocks') === 'agent-commits';
  return {
    LEDGER_FILE: ledgerFile(ctx),
    BOARD_FILE: boardFile(ctx),
    TIER_TABLE: tierTable(ctx, '   '),
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
    COMMIT_BLOCKS: commits
      ? [
          'for each worktree, its branch, in the merge order above, and the two',
          '      blocks for a worktree whose commit a hook blocked. No branch is pushed or merged.',
        ].join('\n')
      : [
          'for each worktree, the two blocks the owner runs, `git -C <worktree>',
          '      add <files>` and `git -C <worktree> commit <files> -m "..."`, naming the same files.',
        ].join('\n'),
  };
}

function delegateBoardVars(ctx: RenderContext, commits: boolean): Record<string, string> {
  const ledger = ledgerFile(ctx);
  const board = boardFile(ctx);
  // Finding 4 of the Deep review: a hook can still block an agent's commit, and the record must
  // say so, because `/autopilot` builds the next row from this branch only if it holds a commit.
  const state = commits
    ? 'committed on its branch and not merged, or "not committed" where a hook blocked it'
    : '"not yet committed"';
  return {
    GATE_CLEARED: [
      `On the board (\`${board}\`): an \`OPEN\` row with a model and a written prompt, every item`,
      '  its "Waits on" names `DONE`, and no "scope first". Otherwise stop and run `/scope`.',
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
      'session sees the claim.',
    ].join('\n'),
    RECORD: [
      `Write one step in \`${ledger}\` at the next free number, read from the file now. Name`,
      "  the builder's and the auditor's models, the worktree, the branch, the commit state",
      `  (${state}), the relay passes, the verdict, each finding as \`open\`, and a Deep lift`,
      "  as the person's call. Then mark the row `DONE` against that step, and post the `/close-out`",
      "  hand-back blocks: in chat, or into the run's state file under `/autopilot`.",
    ].join('\n'),
    HELD: [
      'After that the row is `HELD`: its "Waits on" names the file the open findings are written in,',
      '  and its section gets a dated note of what is done and what is left.',
    ].join('\n'),
  };
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
function cleanUpVars(shape: SkillShape): Record<string, string> {
  return {
    WHAT_MOVES: shape.folders
      ? 'closed project folders'
      : 'closed board prompts, old ledger step bodies, finished design folders',
    FINISHED: shape.folders ? finishedFolders() : finishedLedger(),
    MOVE_STEPS: [shape.folders ? '' : foldMove(), folderMove(shape)]
      .filter((step) => step !== '')
      .join('\n'),
    GREP_WHERE: shape.folders
      ? 'across every document in the tree'
      : 'across the ledger, the board and every document in the tree',
    LIVE_TEXT: shape.folders
      ? 'an open project folder'
      : 'an open board row, a ledger standing section',
    HISTORICAL_TEXT: shape.folders
      ? "a closed phase's `As built:` paragraph"
      : 'a `DONE` row, a ledger step',
    COMMIT_CLAUSE: shape.git
      ? [
          ' Then the',
          'commit blocks for everything the sweep changed. **The archive may be its own repository**:',
          'its commit is rooted there and names its own files, exactly as the command printed it.',
        ].join('\n')
      : '',
  };
}

function finishedLedger(): string {
  return [
    '- **A board row** is finished when it says `DONE — <step>` and that step is in the ledger.',
    '  `SUPERSEDED` and `SETTLED AS NO` are finished too, but their sections stay: each carries a',
    '  fact written nowhere else.',
    '- **A ledger step** gives up its body only once it is older than the newest twenty. Its',
    '  number, title and date stay, because every citation of it depends on that line.',
    '- **A design folder** is finished when every board row that names it is. One open row citing',
    '  it keeps it in the tree.',
  ].join('\n');
}

function finishedFolders(): string {
  return [
    'A project folder is finished when every phase in it is checked off and its status says so.',
    'A folder with a phase left, or one marked `HELD`, stays in the tree.',
  ].join('\n');
}

function foldMove(): string {
  return [
    '1. **The board and the ledger** — `personal-config fold --dry-run`, then `personal-config fold`.',
    '   Every row and every step number stays; prompts and old bodies go.',
  ].join('\n');
}

function folderMove(shape: SkillShape): string {
  const n = shape.folders ? '1' : '2';
  if (!shape.git)
    return [
      `${n}. **Each finished folder** — \`personal-config archive\` needs git and refuses without it, so`,
      '   do its steps yourself: grep for what cites the folder, copy it to the archive, **verify',
      '   every file arrived before deleting the original**, and give it one line in the',
      "   archive's `INDEX.md`.",
    ].join('\n');
  return [
    `${n}. **Each finished folder** — \`personal-config archive <slug>\`. It lists what cites the`,
    '   folder and whether the repo has recorded its final state. A path read at runtime blocks',
    '   the move: repoint it first. Uncommitted changes block it too, and **the commit is the',
    "   owner's** — post the blocks it prints and stop there for that folder. Once it is committed,",
    '   `personal-config archive <slug> --move --dry-run`, then again without `--dry-run`.',
  ].join('\n');
}

/**
 * `/close-out`. Three things it asserted of every reader: that the record lands in a commit
 * beside code, that there is a board item or a phase to close, and that "gates green" is a claim
 * the reader can make. None holds on the short track, and the runtime-pass block never held for a
 * ledger target on any track.
 */
function closeOutVars(shape: SkillShape): Record<string, string> {
  const blocks = handBackBlocks(shape);
  return {
    CLOSE_OUT_TRIGGER: trigger(shape),
    WORK_UNIT: workUnit(shape),
    RECORD_WHERE: recordWhere(shape),
    RECORD_STEPS: [recordStep(shape), foldStep(shape), landedEarly(shape)]
      .filter((step) => step !== '')
      .join('\n'),
    BLOCK_COUNT: blocks.length === 3 ? 'three' : 'two',
    HAND_BACK_BLOCKS: blocks.join('\n'),
    PROOF_SENTENCE: proofSentence(shape),
  };
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

function recordStep(shape: SkillShape): string {
  if (shape.folders) return phaseHeader();
  const tail = shape.short
    ? [
        '  answered. **Do not edit a step you did not write**; append a correction as a new step.',
      ]
    : [
        '  answered. Add any new file to the code map. **Do not edit a step you did not write**;',
        '  append a correction as a new step.',
      ];
  return [
    '- **One new step at the next free number** — **read the file to find it**, do not trust a',
    '  number written elsewhere. Name what changed, why, what is now fixed, and which questions it',
    ...tail,
  ].join('\n');
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
function foldStep(shape: SkillShape): string {
  if (shape.folders) return '';
  const dead = shape.board
    ? "this item's prompt, now its row says `DONE`, and any step body older than the newest twenty"
    : 'any step body older than the newest twenty';
  return [
    `- **Fold what is now dead** — ${dead}.`,
    '  `personal-config fold` does it: the row keeps its pointer and a step keeps its number,',
    '  title and date as one line, because every citation depends on that line still being there.',
    '  It appends to the archive and reads it back before it cuts, which is the only safe order',
    '  for a document git is not holding a copy of.',
  ].join('\n');
}

function landedEarly(shape: SkillShape): string {
  if (shape.board)
    return [
      '- **Landed early, or interrupted?** Same ritual, different header: leave the item unmarked, add',
      '  a status note — what is done, what is left, what it changes about the plan — and write the',
      '  handoff. The pass-off then targets *the remainder of this item*, not the next one.',
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
          '- **Block A — the pass-off prompt**, in full, as a fenced block. It must stand alone: the next',
          '  agent will not see this conversation.',
        ].join('\n')
      : [
          "- **Block A — the next session's prompt**, in full, as a fenced block. It must stand",
          '  alone: the next agent will not see this conversation.',
        ].join('\n'),
  ];
  if (shape.folders)
    blocks.push(
      [
        '- **Block B — the runtime entries this piece added.** Three lines each: the goal it checks in',
        '  product terms, exactly where and how to reach it, and what the right answer is — including',
        '  the query that finds the fixture, not an id that will rot.',
      ].join('\n'),
    );
  const letter = shape.folders ? 'C' : 'B';
  blocks.push(
    [
      `- **Block ${letter} — the next session's model**, on its own line, last in the message, because it is`,
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
    'Apply the proof line to what was done and write down what you saw — not that it passed.',
    '"Checked against the source" and "looks right" are different claims and must never be merged.',
    'Say which one you have.',
  ].join('\n');
}

/**
 * `/handoff`. It named the full ledger's standing sections by name, told the reader to read the
 * ledger "before the board", and closed by demanding every gate command be run once before it is
 * written into an `Environment` section the short ledger does not have.
 */
function handoffVars(shape: SkillShape): Record<string, string> {
  return {
    LEDGER_AND_BOARD: ledgerAndBoard(shape),
    READ_BEFORE: readBefore(shape),
    STEP_NAMES: stepNames(shape),
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
    'There is no board here — what is next is the prompt the last session left in the chat.',
  ].join('\n');
}

function readBefore(shape: SkillShape): string {
  const work = shape.code ? 'before any code' : 'before any work';
  return shape.board ? `before the board and ${work}` : work;
}

function stepNames(shape: SkillShape): string {
  if (!shape.short)
    return [
      'A step names: what changed, why, what is now fixed, which questions it answered, and what is',
      'left owed. It is addressable forever — "HANDOFF 24" is how everything else refers to that work.',
    ].join('\n');
  return [
    'A step names: what changed, why, what is now settled, how the proof line was applied — what',
    'was checked and what was seen — and what is left owed. It is addressable forever — "step 24"',
    'is how everything else refers to that work.',
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
