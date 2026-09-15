import { personalAnswers } from '../lib/config.ts';
import { configFile } from '../lib/paths.ts';
import type { PlannedFile } from '../lib/types.ts';
import { planned, type RenderContext } from './context.ts';

/**
 * `~/.config/personal-config/config.json` — the person's answers, so a second run opens with
 * what they said the first time instead of the profile's guesses.
 *
 * Until 2026-09-15 `loadConfig` read this file as the middle layer of a five-layer merge and
 * no command wrote it (`grep -rn "configFile()" src/` returned the reader and the path helper
 * and nothing else), so the layer was documented, merge-ordered and always empty:
 * `--profile starter` was silently the whole of anyone's saved state.
 *
 * **Overwrite, not merge.** The file is what this run answered, so an answer dropped from the
 * set disappears rather than lingering; a merge strategy would make a saved answer unremovable.
 * The overwrite is backed up and `personal-config undo` restores it, like every other file here.
 *
 * Not stamped: a stamp is a drift marker for a *rendered* document, and this file is an input
 * to rendering rather than an output of it — the same reason `.personal-config.json` carries none.
 */
export function renderUserConfig(ctx: RenderContext): PlannedFile[] {
  const answers = personalAnswers(ctx.config.answers);
  if (Object.keys(answers).length === 0) return [];

  const body = `${JSON.stringify({ models: ctx.config.models, answers }, null, 2)}\n`;
  return [planned(ctx, configFile(), 'your saved answers (all repos)', body, { stamp: false })];
}
