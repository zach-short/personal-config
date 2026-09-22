import { join } from 'node:path';
import { readText } from '../lib/disk.ts';
import { repoRoot } from '../lib/paths.ts';
import { fill } from '../lib/template.ts';
import type { PlannedFile } from '../lib/types.ts';
import {
  boardFile,
  hasBoard,
  ledgerFile,
  planned,
  projectName,
  proofLine,
  type RenderContext,
  routerFile,
  standardPath,
} from './context.ts';
import { COMMIT_POLICY_KEY, OWNER_IS_INTERACTIVE, policyParagraphs } from './standard.ts';
import { targetUsesGit } from './target-git.ts';

/** DIAL-9: one file beside the long one, sharing `standard/VERSION` with it (D10). */
async function shortBoilerplate(): Promise<string> {
  return readText(join(repoRoot(), 'standard', 'AGENT-PRACTICES.short.md'));
}

/**
 * The short standard (setup-tracks `DESIGN.md` D3): a document written for non-code work and for
 * a light setup, not the long one with parts cut. It has no Part 0 — nothing in it is left for an
 * adaptation session to fill — so every token is filled here, and a `{{` that survives into the
 * output is a renderer bug that `doctor`'s placeholder rule names rather than a slot for later.
 *
 * Two sections are conditional, cut the way `solo` mode cuts Part 12 of the long standard: by
 * string surgery between headings, the house mechanism for a render-time cut. The one difference
 * is that a cut here runs to the *next* `##` heading rather than to a named one, so reordering
 * the document cannot leave a section standing because the neighbour it was cut against moved.
 */
export async function renderShortStandard(ctx: RenderContext): Promise<PlannedFile | null> {
  const root = ctx.repo?.scan.path;
  if (!root) return null;

  const body = pipeline(await shortBoilerplate(), ctx);
  return planned(ctx, join(root, standardPath(ctx)), 'the working standard, short form', body);
}

const WHAT_IS_NEXT = '## What is next';
const IN_GIT = '## If this work is in git';
const PREFERENCES = '## Preferences';

function pipeline(text: string, ctx: RenderContext): string {
  const withBoard = hasBoard(ctx) ? text : cutSection(text, WHAT_IS_NEXT);
  // The target's kind, not the person's answer: a folder belonging to somebody who also keeps
  // repos has no git section to keep (item 54).
  const withGit = targetUsesGit(ctx) ? withBoard : cutSection(withBoard, IN_GIT);
  const withPolicy = replaceSectionBody(withGit, PREFERENCES, preferences(ctx));
  return `${fill(withPolicy, placeholders(ctx)).replace(/\n+$/, '')}\n`;
}

function placeholders(ctx: RenderContext): Record<string, string> {
  const line = proofLine(ctx);
  const commit = policyParagraphs(ctx).find((p) => p.configKey === COMMIT_POLICY_KEY);
  return {
    DATE: ctx.date,
    PROJECT_NAME: projectName(ctx),
    LEDGER_FILE: ledgerFile(ctx),
    BOARD_FILE: boardFile(ctx),
    ROUTER_FILE: routerFile(ctx),
    // DIAL-4: one model, not three tiers. The default tier is the one a light setup runs on.
    MODEL: ctx.config.models.default || 'your default model',
    PROOF_BLOCK: line ? `> ${line}` : '> *(not yet written — see below)*',
    COMMIT_POLICY: commit?.text ?? '',
  };
}

/**
 * The owner's preferences, from the two policy questions a non-code run still answers (copy
 * registers and drive-by fixes). The commit policy is not here: it belongs to the git section,
 * which is cut when the work is not in git, and a rule about commits under "preferences" would
 * survive that cut and describe a repository that is not there.
 */
function preferences(ctx: RenderContext): string {
  const paragraphs = policyParagraphs(ctx)
    .filter((p) => p.configKey !== COMMIT_POLICY_KEY)
    .map((p) => p.text);
  return [
    `Written from the answers given to \`personal-config\` on ${ctx.date}; edit freely — it is yours.`,
    '',
    OWNER_IS_INTERACTIVE,
    ...paragraphs.flatMap((p) => ['', p]),
  ].join('\n');
}

/**
 * A `## ` section: from the line that *starts with* `heading` to the line before the next `## `
 * heading, or the end of the file. Matched by prefix because two of the headings carry a filename
 * after a dash — `## What is next — \`PASSOFF.md\`` — and a whole-line match left the board
 * section standing in every light render while the cut reported nothing (found 2026-09-19 by
 * `tests/tracks.test.ts`, which is why the negative cases there assert on the heading itself).
 */
function sectionLines(lines: string[], heading: string): { start: number; end: number } | null {
  const start = lines.findIndex((line) => line === heading || line.startsWith(`${heading} `));
  if (start === -1) return null;
  const next = lines.slice(start + 1).findIndex((line) => line.startsWith('## '));
  return { start, end: next === -1 ? lines.length : start + 1 + next };
}

function cutSection(text: string, heading: string): string {
  const lines = text.split('\n');
  const range = sectionLines(lines, heading);
  if (!range) return text;
  return [...lines.slice(0, range.start), ...lines.slice(range.end)].join('\n');
}

function replaceSectionBody(text: string, heading: string, body: string): string {
  const lines = text.split('\n');
  const range = sectionLines(lines, heading);
  if (!range) return text;
  return [
    ...lines.slice(0, range.start),
    heading,
    '',
    body,
    '',
    ...lines.slice(range.end),
  ].join('\n');
}
