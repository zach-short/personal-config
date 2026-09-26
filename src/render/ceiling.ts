import { join } from 'node:path';
import type { PlannedFile } from '../lib/types.ts';
import { answer, planned, type RenderContext } from './context.ts';

/**
 * Render the tier ceiling into `.claude/settings.local.json` when the repo has a ceiling below
 * Deep. The file is merged rather than overwritten (F4), and git-ignored by the ignore renderer
 * (src/render/repo.ts).
 *
 * Scope: per-repo only (D2). The ceiling's CLAUDE.md clause is written elsewhere by the repo
 * renderer and is conditional on both ceiling < Deep and modelRouting = delegate-or-stop (D3).
 */
export async function renderCeiling(ctx: RenderContext): Promise<PlannedFile | null> {
  const repo = ctx.repo;
  if (!repo) return null;

  const ceiling = answer(ctx, 'tierCeiling', 'deep');
  if (ceiling === 'deep') return null;

  // Build the availableModels list based on the ceiling.
  // Each tier is represented by the model ID the person configured for it.
  const models: string[] = [];

  // The ceiling controls what tiers are available.
  // - mechanical ceiling: [mechanical, light (if enabled)]
  // - default ceiling: [default, mechanical, light (if enabled)]
  // - deep ceiling: nothing (no file needed)

  const mechanicalId = answer(ctx, 'modelIds.mechanical', '');
  const defaultId = answer(ctx, 'modelIds.default', '');
  const lightId = answer(ctx, 'modelIds.light', '');

  // Handle "Other" placeholder replacements that may still be in answers
  // (should not happen if validation is correct, but be safe)
  if (mechanicalId && mechanicalId !== 'other') models.push(mechanicalId);

  if (ceiling === 'default') {
    if (defaultId && defaultId !== 'other') models.push(defaultId);
  }

  // Add Light tier if enabled and ceiling allows it
  const lightEnabled = answer(ctx, 'modelLightEnabled', 'no') === 'yes';
  if (lightEnabled && lightId && lightId !== 'other') {
    models.push(lightId);
  }

  // If no models were collected, don't write the file
  if (models.length === 0) return null;

  const body: Record<string, unknown> = {
    availableModels: models,
  };

  const repoPath = repo.scan.path;
  return planned(
    ctx,
    join(repoPath, '.claude', 'settings.local.json'),
    'settings.local.json — tier ceiling merged in',
    `${JSON.stringify(body, null, 2)}\n`,
    {
      strategy: 'merge-json',
      stamp: false,
    },
  );
}
