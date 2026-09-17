import { join } from 'node:path';
import { readText } from '../lib/disk.ts';
import { claudeSkillsDir, repoRoot } from '../lib/paths.ts';
import { stampLine } from '../lib/stamp.ts';
import type { PlannedFile } from '../lib/types.ts';
import { answer, planned, type RenderContext } from './context.ts';

const SKILLS = ['close-out', 'scope', 'passoff', 'handoff'] as const;

/**
 * One directory per skill under `~/.claude/skills/<name>/SKILL.md`, matching the layout the
 * harness already loads. The frontmatter is what decides when a skill triggers, so it names
 * the phrasings a user actually types rather than describing the skill to itself.
 */
export async function renderSkills(ctx: RenderContext): Promise<PlannedFile[]> {
  const choice = answer(ctx, 'skills', 'none');
  if (choice === 'none') return [];

  const wanted = choice === 'all' ? [...SKILLS] : selected(ctx);
  return Promise.all(wanted.map((name) => renderSkill(ctx, name)));
}

function selected(ctx: RenderContext): string[] {
  const value = ctx.answers.skills;
  if (Array.isArray(value))
    return value.filter((v) => (SKILLS as readonly string[]).includes(v));
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
