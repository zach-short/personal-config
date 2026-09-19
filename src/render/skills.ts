import { join } from 'node:path';
import { readText } from '../lib/disk.ts';
import { claudeSkillsDir, repoRoot } from '../lib/paths.ts';
import { stampLine } from '../lib/stamp.ts';
import type { PlannedFile } from '../lib/types.ts';
import { answer, planned, type RenderContext, trackOf } from './context.ts';

const SKILLS = ['close-out', 'scope', 'passoff', 'handoff'] as const;

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
  const choice = answer(ctx, 'skills', 'none');
  if (choice === 'none') return [];

  const offered: readonly string[] = trackOf(ctx).weight === 'light' ? LIGHT_SKILLS : SKILLS;
  const wanted = choice === 'all' ? [...offered] : selected(ctx, offered);
  return Promise.all(wanted.map((name) => renderSkill(ctx, name)));
}

function selected(ctx: RenderContext, offered: readonly string[]): string[] {
  const value = ctx.answers.skills;
  if (Array.isArray(value)) return value.filter((v) => offered.includes(v));
  return [];
}

async function renderSkill(ctx: RenderContext, name: string): Promise<PlannedFile> {
  const source = await readText(join(repoRoot(), 'templates', 'skills', `${name}.md`));
  return planned(
    ctx,
    join(claudeSkillsDir(), name, 'SKILL.md'),
    `skill — /${name}`,
    stampAfterFrontmatter(source, stampLine(ctx.stamp)),
    { stamp: false },
  );
}

/** The harness reads frontmatter only when `---` is the first line, so the stamp goes below it. */
function stampAfterFrontmatter(source: string, stamp: string): string {
  if (!source.startsWith('---\n')) return `${stamp}\n${source}`;
  const close = source.indexOf('\n---\n', 4);
  if (close === -1) return `${stamp}\n${source}`;
  const cut = close + '\n---\n'.length;
  return `${source.slice(0, cut)}\n${stamp}\n${source.slice(cut)}`;
}
