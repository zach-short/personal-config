import { join } from 'node:path';
import { readText } from '../lib/disk.ts';
import { claudeSkillsDir, repoRoot } from '../lib/paths.ts';
import { docStem, itemsDirFor } from '../lib/repo-config.ts';
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
 * `/audit` is written exactly where `/autopilot` is, because `/autopilot` loads it with the Skill
 * tool for its "audit first" option, and it writes board rows, which project folders keep none of
 * (audit-skill DESIGN 4.1). It carries no `disable-model-invocation`: the harness blocks a model's
 * Skill call to a skill that sets it, so `/autopilot` could not load it (owner, 2026-10-15).
 */
const AUTOPILOT_SKILLS = ['autopilot', 'audit'] as const;

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
    : [...SKILLS, 'delegate', ...AUTOPILOT_SKILLS];
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
): Record<string, string> {
  if (name === 'close-out') return closeOutVars(shape, namesOf(ctx));
  if (name === 'handoff') return handoffVars(shape, namesOf(ctx));
  if (name === 'passoff') return passoffVars(shape, namesOf(ctx));
  if (name === 'clean-up') return cleanUpVars(shape, namesOf(ctx));
  if (name === 'delegate') return delegateVars(ctx, shape);
  if (name === 'autopilot') return autopilotVars(ctx);
  if (name === 'audit') return { BOARD_FILE: boardFile(ctx), TIER_TABLE: tierTable(ctx, '') };
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
  const vars = shape.folders
    ? delegateFolderVars()
    : delegateBoardVars(ctx, namesOf(ctx), commits);
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
    ITEMS_DIR: namesOf(ctx).items,
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

function delegateBoardVars(
  ctx: RenderContext,
  names: RecordNames,
  commits: boolean,
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
    ].join('\n'),
    ITEM_FILE_RULE: [
      '',
      "- Where the brief says the item's file is tracked, append its `## Close-out, <date>` section",
      '  there: what changed and why, what is now fixed, which questions it answered, and what is',
      '  left owed. Otherwise put that text in your report. It is the one record you write.',
    ].join('\n'),
    RECORD: delegateRecord(names, commits),
    HELD: [
      'After that the row is `HELD`: its "Waits on" names the file the open findings are written in,',
      `  and the item's file gets a dated note of what is done and what is left.`,
    ].join('\n'),
  };
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
function cleanUpVars(shape: SkillShape, names: RecordNames): Record<string, string> {
  return {
    WHAT_MOVES: shape.folders
      ? 'closed project folders'
      : 'closed item files and their rows, old log lines, finished design folders',
    FINISHED: shape.folders ? finishedFolders() : finishedItems(names),
    MOVE_STEPS: [shape.folders ? '' : foldMove(shape, names), folderMove(shape)]
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
    COMMIT_CLAUSE: shape.git
      ? [
          ' Then the',
          'commit blocks for everything the sweep changed. **The archive may be its own repository**:',
          'its commit is rooted there and names its own files, exactly as the command printed it.',
        ].join('\n')
      : '',
  };
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
function foldMove(shape: SkillShape, names: RecordNames): string {
  const commit = shape.git
    ? [
        "   Run it only once every `DONE` item's close-out is committed: a fold takes the file out",
        '   of the tree.',
      ]
    : [];
  return [
    '1. **The board and the ledger**: `personal-config fold --dry-run`, then `personal-config fold`.',
    "   Each `DONE` item's file is written to the archive, read back, given an index line that keeps",
    '   what its row said, and only then removed with its row. An archive copy with other bytes',
    '   stops that item. Log lines older than 90 days go to the archive log. `personal-config undo`',
    `   puts back what it removed. ${legacyBoard(names)}, every row and every step number stays;`,
    '   prompts and old bodies go.',
    ...commit,
  ].join('\n');
}

function folderMove(shape: SkillShape): string {
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
    '   the move: repoint it first. Uncommitted changes block it too, and **the commit is the',
    "   owner's**: post the blocks it prints and stop there for that folder. Once it is committed,",
    '   `personal-config archive <slug> --move --dry-run`, then again without `--dry-run`.',
  ].join('\n');
}

/**
 * `/close-out`. Three things it asserted of every reader: that the record lands in a commit
 * beside code, that there is a board item or a phase to close, and that "gates green" is a claim
 * the reader can make. None holds on the short track, and the runtime-pass block never held for a
 * ledger target on any track.
 */
function closeOutVars(shape: SkillShape, names: RecordNames): Record<string, string> {
  const blocks = handBackBlocks(shape);
  return {
    CLOSE_OUT_TRIGGER: trigger(shape),
    WORK_UNIT: workUnit(shape),
    RECORD_WHERE: recordWhere(shape),
    RECORD_STEPS: [recordStep(shape, names), foldStep(shape), landedEarly(shape)]
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
function foldStep(shape: SkillShape): string {
  if (shape.folders) return '';
  if (shape.items) return itemFoldStep(shape);
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
function itemFoldStep(shape: SkillShape): string {
  const timing = shape.git
    ? [
        "  Fold an item only once the owner has committed its close-out, so this item's file waits",
        '  for the next close-out or for `/clean-up`.',
      ]
    : [];
  return [
    "- **Fold what is dead.** `personal-config fold` moves each `DONE` item's file to the archive,",
    '  and its row leaves the table with it; the archive index line keeps what the row said. Log',
    '  lines older than 90 days go to the archive log. It writes the archive and reads it back',
    '  before it removes anything, which is the only safe order for a document git is not holding',
    '  a copy of.',
    ...timing,
  ].join('\n');
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
function passoffVars(shape: SkillShape, names: RecordNames): Record<string, string> {
  return {
    PROMPT_HOME: shape.items ? promptHome(names) : '',
    TRUTH: shape.items ? "The item's close-out section" : 'The ledger step',
  };
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
