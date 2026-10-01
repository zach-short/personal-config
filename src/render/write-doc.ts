import { join } from 'node:path';
import { readText } from '../lib/disk.ts';
import { claudeSkillsDir, repoRoot } from '../lib/paths.ts';
import { stampAfterFrontmatter, stampLine } from '../lib/stamp.ts';
import { fill } from '../lib/template.ts';
import type { PlannedFile } from '../lib/types.ts';
import { answer, planned, type RenderContext, trackOf } from './context.ts';

/**
 * `/write-doc`: one folder, `~/.claude/skills/write-doc/`, holding the skill, the style it reads
 * in its first step and the script it runs in its last (write-doc-ste `DESIGN.md` D6). Its own
 * renderer rather than a sixth entry in `renderSkills`, so the `skills` answer and the
 * `write-doc` answer each own their own files (`PLAN.md` BD-4).
 */
export async function renderWriteDoc(ctx: RenderContext): Promise<PlannedFile[]> {
  if (!wantsWriteDoc(ctx)) return [];

  const dir = join(claudeSkillsDir(), 'write-doc');
  const source = (name: string) => readText(join(repoRoot(), 'templates', 'write-doc', name));
  const [skill, style, check] = await Promise.all([
    source('SKILL.md'),
    source('style.md'),
    source('check.sh'),
  ]);

  const filled = fill(skill, skillVariables(ctx, dir));
  return [
    planned(
      ctx,
      join(dir, 'SKILL.md'),
      'skill — /write-doc',
      stampAfterFrontmatter(filled, stampLine(ctx.stamp)),
      { stamp: false },
    ),
    planned(ctx, join(dir, 'style.md'), 'skill — /write-doc style', style),
    // `sh` is what makes it executable (`planned()`), and the skill runs it by bare path.
    planned(ctx, join(dir, 'check.sh'), 'skill — /write-doc check script', check, {
      extension: 'sh',
    }),
  ];
}

/**
 * Three conditions, each read here rather than trusted to the wizard. D5: non-code work only.
 * BD-2: through `trackOf`, because a `writeDoc: yes` saved on a non-code run is still in the
 * answers on a later code run (`src/commands/setup.ts` seeds from the saved config), where the
 * question is never asked. D10: not under `skills: none`, whose option promises that nothing is
 * written to `~/.claude/skills/`; read with the fallback `renderSkills` uses, so "skills are
 * installed" means one thing in both renderers. D9: an absent `writeDoc` reads `yes`, because
 * `doctor` renders from saved answers without the wizard (`src/doctor/rerender.ts`), and the
 * recommended answer is what a profile saved before the question existed means.
 */
export function wantsWriteDoc(ctx: RenderContext): boolean {
  if (trackOf(ctx).workKind !== 'non-code') return false;
  if (answer(ctx, 'skills', 'none') === 'none') return false;
  return answer(ctx, 'writeDoc', 'yes') === 'yes';
}

/**
 * The answer-dependent passages (design hazard 4). The STE report and the pointer at
 * `language-style.md` exist only where that rule was written; with no rule, the skill names no
 * chat style at all.
 */
function skillVariables(ctx: RenderContext, dir: string): Record<string, string> {
  const ste = answer(ctx, 'chatStyle', 'ste') === 'ste';
  return {
    STYLE_PATH: join(dir, 'style.md'),
    CHECK_PATH: join(dir, 'check.sh'),
    CHAT_SCOPE: ste
      ? 'This skill covers written work only. Chat replies follow the ASD-STE100 rule in `language-style.md` and nothing else.'
      : 'This skill covers written work only. Chat replies are outside it.',
    REPORT_HEADING: ste ? 'Report to the author in ASD-STE100.' : 'Report to the author.',
  };
}
