import { join } from 'node:path';
import { repoRoot } from '../lib/paths.ts';
import { fill } from '../lib/template.ts';
import type { PlannedFile } from '../lib/types.ts';
import { PRACTICE_AREAS } from '../questions/index.ts';
import { answer, planned, type RenderContext, standardPath } from './context.ts';

export async function standardVersion(): Promise<string> {
  const file = Bun.file(join(repoRoot(), 'standard', 'VERSION'));
  return (await file.exists()) ? (await file.text()).trim() : '0.0.0';
}

async function boilerplate(): Promise<string> {
  return Bun.file(join(repoRoot(), 'standard', 'AGENT-PRACTICES.boilerplate.md')).text();
}

/**
 * The adapted copy. Everything a human could answer is filled here; `{{WORKTREE_SETUP}}` and
 * `{{BUILD_CMD}}` are deliberately left, because only the repo knows them and Part 0's prompt
 * is what collects them.
 */
export async function renderStandard(ctx: RenderContext): Promise<PlannedFile | null> {
  const root = ctx.repo?.scan.path;
  if (!root) return null;

  const mode = answer(ctx, 'mode', 'solo');
  const body = pipeline(await boilerplate(), ctx, mode);

  return planned(ctx, join(root, standardPath(ctx)), 'the working standard, adapted', body);
}

function pipeline(text: string, ctx: RenderContext, mode: string): string {
  const withPolicy = replacePartEleven(text, ctx);
  const cut = mode === 'solo' ? cutTeams(withPolicy) : withPolicy;
  return fill(header(cut, ctx, mode), placeholders(ctx, mode));
}

function placeholders(ctx: RenderContext, mode: string): Record<string, string> {
  return {
    DATE: ctx.date,
    MODE: mode,
    DOCS_HOME: 'docs',
    // Interpolated into a path — `{{ARCHIVE_HOME}}/<slug>/`. The literal `none` that §0.3
    // allows for an empty slot would render `none/<slug>/`, so an unanswered archive falls
    // back to the in-tree default Appendix A names instead.
    ARCHIVE_HOME: ctx.repo?.archiveHome || 'docs/archive',
    TRACKER: mode === 'team' ? answer(ctx, 'tracker', 'none') : 'none',
    MODEL_DEEP: ctx.config.models.deep || 'unset',
    MODEL_DEFAULT: ctx.config.models.default || 'unset',
    MODEL_FAST: ctx.config.models.fast || 'unset',
    DATE_MEASURED: '2026-08-16',
  };
}

/** Part 11 is the one part the standard marks as editable preference — so we write it. */
function replacePartEleven(text: string, ctx: RenderContext): string {
  const paragraphs = PRACTICE_AREAS.filter((area) => area.policy)
    .map((area) => area.policy?.(policyAnswer(ctx, area.question.configKey)))
    .filter((p): p is string => Boolean(p));

  const interactive =
    '**The owner is interactive.** When a decision is theirs, ask before building it, in chat, in\nthe same turn, batched. A decision built on a guess is built twice.';

  const replacement = [
    '# Part 11 — Owner policy',
    '',
    'Everything above is craft. This part is preference. It was written from the answers given to',
    `\`personal-config\` on ${ctx.date}; edit it freely — it is yours.`,
    '',
    interactive,
    '',
    ...paragraphs.flatMap((p) => [p, '']),
  ].join('\n');

  return replaceSection(text, '# Part 11 —', '# Part 12 —', replacement);
}

/** The commit-policy area reads the `you` answer; every other policy area has its own. */
function policyAnswer(ctx: RenderContext, configKey: string): string {
  if (configKey === 'practices.commit-policy-practice')
    return answer(ctx, 'commitPolicy', 'print-blocks');
  return answer(ctx, configKey, 'none');
}

function cutTeams(text: string): string {
  return replaceSection(text, '# Part 12 —', '# Appendix A —', '');
}

function replaceSection(
  text: string,
  startMark: string,
  endMark: string,
  body: string,
): string {
  const start = text.indexOf(startMark);
  const end = text.indexOf(endMark);
  if (start === -1 || end === -1 || end < start) return text;
  const tail = body ? `${body}\n\n---\n\n` : '';
  return `${text.slice(0, start)}${tail}${text.slice(end)}`;
}

function header(text: string, ctx: RenderContext, mode: string): string {
  const note = [
    '',
    `**Pre-filled by \`personal-config\` on ${ctx.date}.** Appendix A is filled, except the two`,
    'slots only this repo can answer — the fresh-checkout recipe and the build command — which Part 0',
    `produces. The profile is chosen (${ctx.repo?.workProfile === 'folders' ? 'Profile P — project folders' : 'Profile L — ledger + board'}),`,
    mode === 'solo'
      ? 'and Part 12 (teams) was cut because one person decides here.'
      : 'and Part 12 (teams) was kept.',
    'Part 11 was written from the answers given. **Part 0 has not run**: the gates, the gates that',
    'lie, the directory map and the hazards are still missing, and `PART0-PROMPT.md` is the prompt',
    'that collects them. Until it has run, this file is not yet adapted and must not be cited as',
    'authority on this repo.',
    '',
  ].join('\n');

  return text.replace(
    '**Adapted: not yet — run Part 0.**',
    `**Adapted: not yet — run Part 0.**\n${note}`,
  );
}
