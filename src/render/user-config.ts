import { personalAnswers } from '../lib/config.ts';
import { configFile } from '../lib/paths.ts';
import type { Answers, PlannedFile } from '../lib/types.ts';
import { YOU_QUESTIONS } from '../questions/index.ts';
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

  const record = { models: ctx.config.models, answers, globalAnswers: globalAnswers(ctx) };
  const body = `${JSON.stringify(record, null, 2)}\n`;
  return [planned(ctx, configFile(), 'your saved answers (all repos)', body, { stamp: false })];
}

/**
 * The `you` answers this run rendered the global files from (init-command D10). `init` writes no
 * global file, so it reads this to say when a folder's track differs from theirs (D6) and to take
 * the four `you` answers `answers` does not hold (`outputStyle`, `chatStyle`, `writeDoc`,
 * `writeDocCheck`, PLAN §0 F3).
 *
 * Its own key, outside `answers`, so it is a record and not a layer: an answer under `answers`
 * is a default for every later run and enters every stamp hash, and `PERSONAL_ANSWERS` keeps the
 * track out of that set on purpose (`src/lib/config.ts`). Every `you` key is recorded, the person's
 * included, so the record reads whole without the file's other half.
 */
function globalAnswers(ctx: RenderContext): Answers {
  const keys = new Set(YOU_QUESTIONS.map((q) => q.configKey));
  return Object.fromEntries(
    Object.entries(ctx.config.answers)
      .filter(([key]) => keys.has(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}
