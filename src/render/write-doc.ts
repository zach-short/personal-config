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
 * Whether `settings.json` gets the `PostToolUse` entry that runs `check.sh hook` on every save
 * (D7, the `write-doc-check` question). The entry runs a script inside the skill folder, so it is
 * planned only where `wantsWriteDoc` plans that folder: an entry pointing at a script no run wrote
 * would fail on every save. Then `hooks` must not be `none`, whose option promises that nothing
 * reaches `settings.json`, read with the fallback `wantedHooks` uses (G26). An absent
 * `writeDocCheck` reads `skill`, the recommended answer, which installs nothing.
 *
 * `renderHooks` reads this for the entry and `skillVariables` for the sentence that says the check
 * runs on every save, so the skill says so exactly where the entry exists.
 */
export function wantsWriteDocHook(ctx: RenderContext): boolean {
  if (!wantsWriteDoc(ctx)) return false;
  if (answer(ctx, 'hooks', 'none') === 'none') return false;
  return answer(ctx, 'writeDocCheck', 'skill') === 'every';
}

/** One path for the script the skill's last step runs and the hook entry runs. */
export function writeDocCheckScript(): string {
  return join(claudeSkillsDir(), 'write-doc', 'check.sh');
}

/**
 * The answer-dependent passages (design hazard 4). The STE report and the pointer at
 * `language-style.md` exist only where that rule was written; with no rule, the skill names no
 * chat style at all. The last limit says the check also runs on every save only where the hook
 * entry is planned (Phase 3 item 4); everywhere else it says that nothing checks a file on its own.
 */
function skillVariables(ctx: RenderContext, dir: string): Record<string, string> {
  const ste = answer(ctx, 'chatStyle', 'ste') === 'ste';
  return {
    STYLE_PATH: join(dir, 'style.md'),
    CHECK_PATH: writeDocCheckScript(),
    SAVE_CHECK: wantsWriteDocHook(ctx)
      ? 'A hook also runs this check on the new text of every `.md`, `.mdx`, `.txt`, `.rst`, `.tex` and `.adoc` file saved with Write or Edit, and shows you the problems it finds. It does not read Word files, and it skips the files `personal-config` generated, so always run step 9.'
      : 'The check runs only when step 9 runs. Nothing checks a file automatically, so always run step 9.',
    CHAT_SCOPE: ste
      ? 'This skill covers written work only. Chat replies follow the ASD-STE100 rule in `language-style.md` and nothing else.'
      : 'This skill covers written work only. Chat replies are outside it.',
    REPORT_HEADING: ste ? 'Report to the author in ASD-STE100.' : 'Report to the author.',
  };
}
