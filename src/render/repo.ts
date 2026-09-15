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
  ledgerFile,
  planned,
  projectName,
  type RenderContext,
  routerFile,
  standardPath,
} from './context.ts';

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

async function renderRouter(ctx: RenderContext, languages: string[]): Promise<PlannedFile> {
  const repoPath = ctx.repo?.scan.path ?? '';
  const tracked = ctx.repo?.trackMode === 'tracked';
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
  const name = routerFile(ctx);
  const body = await filledTemplate(tracked ? 'CLAUDE.md' : 'CLAUDE.local.md', vars);
  return planned(
    ctx,
    join(repoPath, name),
    tracked ? 'router (tracked)' : 'personal router (untracked)',
    body,
  );
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

function commitLine(ctx: RenderContext): string {
  const line = commitRuleLine(ctx.answers);
  return line ? `- ${line}` : '';
}

function workRecordLines(ctx: RenderContext): string {
  if (ctx.repo?.workProfile === 'folders') {
    return `- \`docs/incomplete/<slug>/\` — one folder per open effort: \`SCOPE.md\` → \`DESIGN.md\` → \`PLAN.md\` → \`RUNTIME-PASS.md\`.\n- Closed efforts move to \`${ctx.repo.archiveHome || 'the archive'}\`.`;
  }
  return `- \`${ledgerFile(ctx)}\` — what is true: environment, settled decisions, the step log. Read first.\n- \`${boardFile(ctx)}\` — what is next, one standalone prompt per item.`;
}

async function renderWorkRecord(ctx: RenderContext): Promise<PlannedFile[]> {
  return ctx.repo?.workProfile === 'folders' ? renderFolders(ctx) : renderLedgerAndBoard(ctx);
}

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

  return [
    planned(
      ctx,
      join(repoPath, ledgerFile(ctx)),
      'the ledger — what is true',
      await filledTemplate('HANDOFF.md', vars),
    ),
    planned(
      ctx,
      join(repoPath, boardFile(ctx)),
      'the board — what is next',
      await filledTemplate('PASSOFF.md', vars),
    ),
  ];
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
 */
function renderRepoConfig(ctx: RenderContext): PlannedFile {
  const body = `${JSON.stringify(
    {
      profile: ctx.config.profile,
      workProfile: ctx.repo?.workProfile,
      trackMode: ctx.repo?.trackMode,
      ledgerFile: ctx.repo?.workProfile === 'folders' ? '' : ledgerFile(ctx),
      boardFile: ctx.repo?.workProfile === 'folders' ? '' : boardFile(ctx),
      standardPath: standardPath(ctx),
      archiveHome: ctx.repo?.archiveHome ?? '',
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
 */
function renderIgnore(ctx: RenderContext): PlannedFile | null {
  const repo = ctx.repo;
  if (!repo) return null;

  const personal = ['.personal-config.json', 'PART0-PROMPT.md'];
  const untracked = [
    ledgerFile(ctx),
    boardFile(ctx),
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

export async function renderPart0(ctx: RenderContext): Promise<PlannedFile | null> {
  const repo = ctx.repo;
  if (!repo) return null;

  const body = await filledTemplate('PART0-PROMPT.md', {
    PROJECT_NAME: projectName(ctx),
    MODEL_DEFAULT: ctx.config.models.default || 'your default tier',
    REPO_PATH: repo.scan.path,
    STANDARD_PATH: standardPath(ctx),
    ROUTER_FILE: routerFile(ctx),
    WORK_PROFILE:
      repo.workProfile === 'folders'
        ? 'Profile P — project folders'
        : 'Profile L — ledger + board',
    MODE: answer(ctx, 'mode', 'solo'),
    WORKTREE_SETUP_TOKEN: '{{WORKTREE_SETUP}}',
    BUILD_CMD_TOKEN: '{{BUILD_CMD}}',
    DISCOVERY_SUMMARY: discoverySummary(ctx),
    CUT_HINTS: cutHints(ctx),
    WRITTEN_FILES: '(filled at write time)',
    COMMIT_RULE: commitRuleLine(ctx.answers),
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
  return [
    `- Languages detected from marker files: ${scan.languages.join(', ') || 'none'}.`,
    `- Package manager from the lockfile: ${scan.packageManager ?? 'none found'}.`,
    `- CI: ${scan.hasCi ? '`.github/workflows` exists — take the gates from it' : 'no `.github/workflows` — take the gates from the toolchain'}.`,
    `- Migrations: ${scan.migrations.join(', ') || 'none found — confirm with a grep before recording the absence'}.`,
    `- Existing docs: ${scan.existingDocs.join(', ') || 'none'}.`,
    // `git worktree list` includes the checkout being set up, so a count of 1 means none extra.
    `- Extra worktrees beyond this checkout: ${Math.max(scan.worktrees - 1, 0)}.`,
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
  return hints.length > 0 ? hints.join(' ') : 'Verify each before cutting.';
}
