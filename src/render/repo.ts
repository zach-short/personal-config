import { join } from 'node:path';
import { hashedAnswers } from '../lib/config.ts';
import { expandHome } from '../lib/paths.ts';
import { filledTemplate } from '../lib/template.ts';
import type { PlannedFile } from '../lib/types.ts';
import {
  answer,
  boardFile,
  commitRuleLine,
  conventionsPath,
  hasBoard,
  isShortTrack,
  ledgerFile,
  offLimits,
  planned,
  projectName,
  proofLine,
  type RenderContext,
  routerFile,
  standardPath,
  trackOf,
  workRecordShape,
} from './context.ts';
import { targetUsesGit } from './target-git.ts';

export async function renderRepoFiles(
  ctx: RenderContext,
  languages: string[],
): Promise<PlannedFile[]> {
  const repo = ctx.repo;
  if (!repo) return [];

  const files = [
    await renderRouter(ctx, languages),
    ...(await renderWorkRecord(ctx)),
    await renderArchiveIndex(ctx),
    renderRepoConfig(ctx),
    renderIgnore(ctx),
  ];
  return files.filter((f): f is PlannedFile => f !== null);
}

/** D6's "shorter router" goes wherever the short standard goes; the two are read together. */
async function renderRouter(ctx: RenderContext, languages: string[]): Promise<PlannedFile> {
  return isShortTrack(ctx)
    ? renderShortRouter(ctx, languages)
    : renderFullRouter(ctx, languages);
}

async function renderFullRouter(ctx: RenderContext, languages: string[]): Promise<PlannedFile> {
  const repoPath = ctx.repo?.scan.path ?? '';
  const untracked = ctx.repo?.trackMode === 'untracked';
  const vars = {
    PROJECT_NAME: projectName(ctx),
    STANDARD_PATH: standardPath(ctx),
    LEDGER_FILE: ledgerFile(ctx),
    BOARD_FILE: boardFile(ctx),
    STACK_LINE: stackLine(ctx),
    COMMIT_LINE: commitLine(ctx),
    CONVENTIONS_LIST: conventionsList(languages),
    BROKEN_RULES: '',
    WORK_RECORD: workRecordLines(ctx),
  };
  const body = await filledTemplate(untracked ? 'CLAUDE.local.md' : 'CLAUDE.md', vars);
  return planned(ctx, join(repoPath, routerFile(ctx)), routerLabel(ctx), body);
}

/**
 * The router for the short track. It carries no stack, architecture or gate sections — those
 * are what Part 0 fills for a code repo, and this track has no Part 0 — and puts the proof line
 * (D7) where the gate commands would have gone, because that is what "done" checks against here.
 * A code repo on the light track still gets its per-language standard named, since the
 * conventions renderer still writes one for every language it finds.
 */
async function renderShortRouter(
  ctx: RenderContext,
  languages: string[],
): Promise<PlannedFile> {
  const repoPath = ctx.repo?.scan.path ?? '';
  const untracked = ctx.repo?.trackMode === 'untracked';
  // A folder of non-code work can still carry a `package.json`; the languages the scan found
  // describe a code standard this track never writes, so neither line is shown for it.
  const code = trackOf(ctx).workKind === 'code' && languages.length > 0;
  const vars = {
    PROJECT_NAME: projectName(ctx),
    TITLE_SUFFIX: untracked ? ' — personal router (not repo policy — untracked)' : '',
    STANDARD_PATH: standardPath(ctx),
    LEDGER_FILE: ledgerFile(ctx),
    CONVENTIONS_NOTE: code ? codeStandardNote(languages) : '',
    PRECEDENCE: untracked ? PRECEDENCE : '',
    WORK_RECORD: workRecordLines(ctx),
    PROOF_BLOCK: proofBlock(ctx),
    STACK_LINE: code ? stackLine(ctx) : '',
    COMMIT_LINE: commitLine(ctx),
    OFF_LIMITS_LINE: offLimitsLine(ctx),
  };
  const body = tidy(await filledTemplate('CLAUDE.short.md', vars));
  return planned(ctx, join(repoPath, routerFile(ctx)), routerLabel(ctx), body);
}

/** A folder is neither tracked nor untracked (DIAL-11), so its label claims neither. */
function routerLabel(ctx: RenderContext): string {
  const mode = ctx.repo?.trackMode;
  if (mode === 'untracked') return 'personal router (untracked)';
  if (mode === 'tracked') return 'router (tracked)';
  return 'router';
}

function codeStandardNote(languages: string[]): string {
  return [
    '',
    '> **Before writing or editing any code, read the matching code standard in full —',
    `> ${conventionsList(languages)}. Not optional, not conditional on task size.**`,
    '',
  ].join('\n');
}

/** What `CLAUDE.local.md` says about whose rules win, for a short router in a repo not yours. */
const PRECEDENCE = [
  '## Precedence',
  '',
  "1. **The repo's own rules** — its `CONTRIBUTING.md`, `AGENTS.md`/`CLAUDE.md`, and any other",
  '   convention file it keeps.',
  '2. **This file**, only where those are silent.',
  '3. Nothing else.',
  '',
  "Where 1 and 2 disagree, 1 wins and 2 is amended. **This repo's conventions are not mine to",
  'set — never edit its own rule files to suit a personal preference.**',
  '',
].join('\n');

/**
 * The proof line as the router shows it. Empty is a real state — the owner has not written one
 * yet — and it is written as an instruction to the first session rather than left blank, so the
 * gap is a task and not a hole.
 */
function proofBlock(ctx: RenderContext): string {
  const line = proofLine(ctx);
  if (line) {
    return `> ${line}\n\nA session says work here is done only after applying that test and saying what it saw.`;
  }
  return [
    '<!-- Not yet written. The first session writes it with the owner: one test somebody could run,',
    '     never a value — "the totals agree with the source table", "someone who did not write it',
    '     read it" — then puts it here and in the standard. -->',
  ].join('\n');
}

/**
 * An optional block that filled with nothing leaves a blank line behind, and two blank lines in a
 * row read as a hole. Only the short track's templates go through this: the full track's output
 * is pinned byte for byte and is never reformatted.
 */
function tidy(text: string): string {
  return `${text.replaceAll(/\n{3,}/g, '\n\n').replace(/\n+$/, '')}\n`;
}

function conventionsList(languages: string[]): string {
  if (languages.length === 0) return 'the code standard for this repo';
  return languages.map((l) => `\`${conventionsPath(l)}\` for ${l}`).join(', ');
}

function stackLine(ctx: RenderContext): string {
  const scan = ctx.repo?.scan;
  if (!scan)
    return '<!-- Runtimes, frameworks, data layer — one line each, versions where they matter. -->';
  const parts = [
    scan.languages.length > 0 ? scan.languages.join(', ') : null,
    scan.packageManager ? `package manager: ${scan.packageManager}` : null,
    scan.hasCi ? 'CI: GitHub Actions' : 'no CI',
    scan.migrations.length > 0 ? `migrations in ${scan.migrations.join(', ')}` : null,
  ].filter(Boolean);
  return `Detected ${ctx.date}: ${parts.join(' · ')}. <!-- Verify and expand — versions where they matter. -->`;
}

/**
 * Work kept out of git has no commit rule to restate (setup-tracks `DESIGN.md` §3.1, row 2) —
 * and neither has a plain folder, whatever the person answered about their repos (item 54).
 */
function commitRule(ctx: RenderContext): string {
  return targetUsesGit(ctx) ? commitRuleLine(ctx.answers) : '';
}

function commitLine(ctx: RenderContext): string {
  const line = commitRule(ctx);
  return line ? `- ${line}` : '';
}

/**
 * What the agent must not read or copy, beside the commit line under `## Never do this` (D23).
 * An empty answer is a complete one and renders nothing — not "none named", which would be a
 * line claiming the question was considered where it may simply have been skipped. `tidy`
 * closes the blank line an empty token leaves behind.
 *
 * A rule is not a guard, and this is the boundary where that matters most: a `grep -r` reads
 * the material before any rule is consulted. What makes it worth writing is that the router is
 * read before the folder is touched. The enforcement this could grow into —
 * `permissions.deny` on a `Read` pattern in the project's own settings — is reserved and
 * deliberately not built (§10.6): it is a second write target with its own merge, preview and
 * undo, and the question has to exist before that is worth wiring.
 */
function offLimitsLine(ctx: RenderContext): string {
  const named = offLimits(ctx);
  return named ? `- Never read, copy or quote from \`${named}\`.` : '';
}

/**
 * The same answer as a row in the short ledger's facts table, under the proof line's row.
 *
 * It carries its own leading newline and the template appends it to the end of the row above,
 * rather than sitting on a line of its own: a token alone on a line leaves an empty line behind
 * when it renders nothing, and one empty line inside a markdown table splits it into two
 * tables. `tidy` cannot help — it collapses three newlines or more, and this would be two.
 */
function offLimitsRow(ctx: RenderContext): string {
  const named = offLimits(ctx);
  return named ? `\n| Not to be read or copied | \`${named}\` | the owner |` : '';
}

function workRecordLines(ctx: RenderContext): string {
  if (workRecordShape(ctx) === 'folders') {
    return `- \`docs/incomplete/<slug>/\` — one folder per open effort: \`SCOPE.md\` → \`DESIGN.md\` → \`PLAN.md\` → \`RUNTIME-PASS.md\`.\n- Closed efforts move to \`${ctx.repo?.archiveHome || 'the archive'}\`.`;
  }
  const ledger = `- \`${ledgerFile(ctx)}\` — what is true: environment, settled decisions, the step log. Read first.`;
  const board = `- \`${boardFile(ctx)}\` — what is next, one standalone prompt per item.`;
  return hasBoard(ctx) ? `${ledger}\n${board}` : ledger;
}

async function renderWorkRecord(ctx: RenderContext): Promise<PlannedFile[]> {
  return workRecordShape(ctx) === 'folders' ? renderFolders(ctx) : renderLedgerAndBoard(ctx);
}

/** D9: the board is written on the full track only; the ledger on both. */
async function renderLedgerAndBoard(ctx: RenderContext): Promise<PlannedFile[]> {
  const repoPath = ctx.repo?.scan.path ?? '';
  const vars = {
    PROJECT_NAME: projectName(ctx),
    DATE: ctx.date,
    LEDGER_FILE: ledgerFile(ctx),
    BOARD_FILE: boardFile(ctx),
    ROUTER_FILE: routerFile(ctx),
    STANDARD_PATH: standardPath(ctx),
    MODEL_DEFAULT: ctx.config.models.default || 'Default',
    CONVENTIONS_NOTE: conventionsNote(ctx),
  };

  const ledger = isShortTrack(ctx)
    ? await renderShortLedger(ctx)
    : planned(
        ctx,
        join(repoPath, ledgerFile(ctx)),
        'the ledger — what is true',
        await filledTemplate('HANDOFF.md', vars),
      );
  if (!hasBoard(ctx)) return [ledger];

  return [
    ledger,
    planned(
      ctx,
      join(repoPath, boardFile(ctx)),
      'the board — what is next',
      await filledTemplate('PASSOFF.md', vars),
    ),
  ];
}

/**
 * The short track's ledger. Same shape as the full one — orientation, standing sections, an
 * append-only step log the same `doctor` rules read — but its facts table asks what proves work
 * sound here rather than for build, test, lint and typecheck commands, and it names no code
 * standard, because on this track there may be none.
 */
async function renderShortLedger(ctx: RenderContext): Promise<PlannedFile> {
  const repoPath = ctx.repo?.scan.path ?? '';
  const vars = {
    PROJECT_NAME: projectName(ctx),
    DATE: ctx.date,
    ROUTER_FILE: routerFile(ctx),
    STANDARD_PATH: standardPath(ctx),
    READ_NEXT: hasBoard(ctx) ? `\`${boardFile(ctx)}\` (what is next) → ` : '',
    PROOF_LINE:
      proofLine(ctx) || '*(not yet written — the first session writes it with the owner)*',
    OFF_LIMITS_ROW: offLimitsRow(ctx),
  };
  return planned(
    ctx,
    join(repoPath, ledgerFile(ctx)),
    'the ledger — what is true',
    tidy(await filledTemplate('HANDOFF.short.md', vars)),
  );
}

function conventionsNote(ctx: RenderContext): string {
  const languages = ctx.repo?.scan.languages ?? [];
  if (languages.length === 0) return 'not yet written';
  return languages.map((l) => `\`${conventionsPath(l)}\``).join(' and ');
}

async function renderFolders(ctx: RenderContext): Promise<PlannedFile[]> {
  const repoPath = ctx.repo?.scan.path ?? '';
  const body = await filledTemplate('incomplete-README.md', {
    DOCS_HOME: 'docs',
    ARCHIVE_HOME: ctx.repo?.archiveHome || 'the archive',
    STANDARD_PATH: standardPath(ctx),
  });
  return [
    planned(
      ctx,
      join(repoPath, 'docs', 'incomplete', 'README.md'),
      'project-folder scaffold',
      body,
    ),
  ];
}

async function renderArchiveIndex(ctx: RenderContext): Promise<PlannedFile | null> {
  const home = ctx.repo?.archiveHome;
  // An empty answer means no archive index. `none` is no longer offered, but a config saved
  // before that still carries it, and expanding it would seed `./none/INDEX.md`.
  if (!home || home.toLowerCase() === 'none') return null;
  const body = await filledTemplate('archive-INDEX.md', { PROJECT_NAME: projectName(ctx) });
  return planned(ctx, join(expandHome(home), 'INDEX.md'), 'archive index seed', body);
}

/**
 * Read by the session banner hook, so one hook serves every repo without a constant in it —
 * and by `loadConfig`, which is why `answers` is here.
 *
 * `answers` is what a later `doctor` recomputes the stamp's config hash from. Without it the
 * only answers `doctor` could see were whichever profile it happened to be given, so every
 * repo reported drift the moment it was rendered (fixed 2026-09-15). `hashedAnswers()` owns
 * the set, so what is saved and what is hashed cannot fall out of step. It sits last because
 * the banner hook greps this file line by line for the flat keys above it.
 *
 * `workProfile` records the shape that was *rendered*, and `boardFile` is empty where no board
 * was written (D9): the banner and `doctor` read these to find files, and a name for a file
 * that is not there would send both looking for it.
 */
function renderRepoConfig(ctx: RenderContext): PlannedFile {
  const shape = workRecordShape(ctx);
  const body = `${JSON.stringify(
    {
      profile: ctx.config.profile,
      workProfile: shape,
      trackMode: ctx.repo?.trackMode,
      ledgerFile: shape === 'folders' ? '' : ledgerFile(ctx),
      boardFile: shape === 'folders' || !hasBoard(ctx) ? '' : boardFile(ctx),
      standardPath: standardPath(ctx),
      archiveHome: ctx.repo?.archiveHome ?? '',
      // The completion-gate hook's command, and the one key here nothing asks for. It is
      // written empty on purpose: no question knows a repo's gate command — only Part 0's
      // adaptation session does, after running every gate once — and guessing one from the
      // package manager would have the hook running a command nobody chose. Empty means the
      // gate skips that check, which is the direction a hook has to fail in.
      gateCommand: '',
      models: ctx.config.models,
      answers: hashedAnswers(ctx.config.answers),
    },
    null,
    2,
  )}\n`;
  return planned(
    ctx,
    join(ctx.repo?.scan.path ?? '', '.personal-config.json'),
    'per-repo config',
    body,
    {
      stamp: false,
    },
  );
}

/**
 * Untracked mode writes to `.git/info/exclude` rather than `.gitignore`: the repo is not the
 * user's, and adding personal filenames to a tracked ignore file is an edit to someone else's
 * repo. Tracked mode only needs `.personal-config.json` kept out.
 *
 * A folder gets neither (DIAL-11): there is no `.git` to write into, and `writeText` creates
 * parent directories, so planning the exclude file would have *created* a `.git/` inside a
 * directory that was never a repository (found 2026-09-17, `tests/folder-render.test.ts`). Nor
 * does a person who keeps no work in git — nothing of theirs is git's to see.
 */
function renderIgnore(ctx: RenderContext): PlannedFile | null {
  const repo = ctx.repo;
  if (!repo) return null;
  if (repo.trackMode === 'n/a' || !trackOf(ctx).usesGit) return null;

  // Only names this run actually plans: the short track writes no Part 0 prompt and, when light,
  // no board, and an ignore line for a file that is never written is a claim about a file.
  const personal = ['.personal-config.json', ...(isShortTrack(ctx) ? [] : ['PART0-PROMPT.md'])];
  const untracked = [
    ledgerFile(ctx),
    ...(hasBoard(ctx) ? [boardFile(ctx)] : []),
    'CLAUDE.local.md',
    'AGENT-PRACTICES.local.md',
  ];
  const names = repo.trackMode === 'tracked' ? personal : [...personal, ...untracked];
  // Anchored to the repo root. A bare `HANDOFF.md` matches at every depth, so it would also
  // hide a `docs/HANDOFF.md` or an `examples/HANDOFF.md` the repo legitimately ships — and on
  // a case-insensitive filesystem it hides `handoff.md` too. Observed 2026-09-15.
  const lines = names.map((name) => `/${name}`);

  const target =
    repo.trackMode === 'tracked'
      ? join(repo.scan.path, '.gitignore')
      : join(repo.scan.path, '.git', 'info', 'exclude');

  return planned(ctx, target, 'ignore entries', `${lines.join('\n')}\n`, {
    strategy: 'append-lines',
    stamp: false,
  });
}

/**
 * Part 0 is the long standard's adaptation protocol, and the short standard has none: nothing in
 * it is left for a later session to fill, so there is no prompt to hand over and no 40–80k
 * session to spend on it (D6). The short track's first-session instructions live in the
 * standard itself.
 */
export async function renderPart0(ctx: RenderContext): Promise<PlannedFile | null> {
  const repo = ctx.repo;
  if (!repo || isShortTrack(ctx)) return null;

  const body = await filledTemplate('PART0-PROMPT.md', {
    PROJECT_NAME: projectName(ctx),
    MODEL_DEFAULT: ctx.config.models.default || 'your default tier',
    REPO_PATH: repo.scan.path,
    STANDARD_PATH: standardPath(ctx),
    ROUTER_FILE: routerFile(ctx),
    WORK_PROFILE:
      workRecordShape(ctx) === 'folders'
        ? 'Profile P — project folders'
        : 'Profile L — ledger + board',
    MODE: answer(ctx, 'mode', 'solo'),
    WORKTREE_SETUP_TOKEN: '{{WORKTREE_SETUP}}',
    BUILD_CMD_TOKEN: '{{BUILD_CMD}}',
    DISCOVERY_SUMMARY: discoverySummary(ctx),
    CUT_HINTS: cutHints(ctx),
    WRITTEN_FILES: '(filled at write time)',
    COMMIT_RULE: commitRule(ctx),
  });

  return planned(
    ctx,
    join(repo.scan.path, 'PART0-PROMPT.md'),
    'Part 0 prompt — paste into a fresh session',
    body,
  );
}

function discoverySummary(ctx: RenderContext): string {
  const scan = ctx.repo?.scan;
  if (!scan) return '- nothing scanned.';
  const line = proofLine(ctx);
  return [
    `- Languages detected from marker files: ${scan.languages.join(', ') || 'none'}.`,
    `- Package manager from the lockfile: ${scan.packageManager ?? 'none found'}.`,
    `- CI: ${scan.hasCi ? '`.github/workflows` exists — take the gates from it' : 'no `.github/workflows` — take the gates from the toolchain'}.`,
    `- Migrations: ${scan.migrations.join(', ') || 'none found — confirm with a grep before recording the absence'}.`,
    `- Existing docs: ${scan.existingDocs.join(', ') || 'none'}.`,
    // `git worktree list` includes the checkout being set up, so a count of 1 means none extra.
    `- Extra worktrees beyond this checkout: ${Math.max(scan.worktrees - 1, 0)}.`,
    // D7 on the full track: the owner's own test of soundness rides beside the gates rather
    // than replacing them. Absent when empty, so a run that never answered it renders as before.
    ...(line
      ? [
          `- The owner's proof line — what proves work here is sound: "${line}". Put it in the router's Commands section beside the gates.`,
        ]
      : []),
  ].join('\n');
}

function cutHints(ctx: RenderContext): string {
  const scan = ctx.repo?.scan;
  const hints: string[] = [];
  if (scan && !scan.hasCi)
    hints.push(
      'No `.github/workflows` was found, so the *CI* enforcement tag and every "what CI runs" are candidates to cut.',
    );
  if (scan && scan.migrations.length === 0)
    hints.push(
      'No migrations directory was found, so the migration-number rule is a candidate to cut — keep the general numbered-shared-resource rule if any number is shared.',
    );
  if (answer(ctx, 'mode', 'solo') === 'solo')
    hints.push(
      "Part 12 is already cut; its cross-references (`grep -n 'Part 12'`) are still yours to fix here.",
    );
  if (!targetUsesGit(ctx))
    hints.push(
      'This work is not kept in git, so Part 6 — parallel sessions, worktrees and the commit rules — is a candidate to cut whole; keep only what a plain folder can honour.',
    );
  return hints.length > 0 ? hints.join(' ') : 'Verify each before cutting.';
}
