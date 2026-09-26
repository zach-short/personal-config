import type { PlannedFile } from '../lib/types.ts';

import { renderCeiling } from './ceiling.ts';
import type { RenderContext } from './context.ts';
import { isShortTrack } from './context.ts';
import { renderConventions } from './conventions.ts';
import { renderHooks } from './hooks.ts';
import { renderPart0, renderRepoFiles } from './repo.ts';
import { renderGlobalRules } from './rules.ts';
import { renderShortStandard } from './short-standard.ts';
import { renderSkills } from './skills.ts';
import { renderStandard } from './standard.ts';
import { renderUserConfig } from './user-config.ts';

/** Everything one run would write, in the order the preview shows it. */
export async function renderAll(ctx: RenderContext): Promise<PlannedFile[]> {
  const languages = ctx.repo?.scan.languages ?? [];
  // D3: one document or the other, never the long one with parts cut. Dispatched here so the
  // two renderers do not import each other.
  const standard = isShortTrack(ctx) ? renderShortStandard(ctx) : renderStandard(ctx);

  const groups = await Promise.all([
    Promise.resolve(renderGlobalRules(ctx)),
    renderSkills(ctx),
    renderHooks(ctx),
    renderRepoFiles(ctx, languages),
    standard.then((f) => (f ? [f] : [])),
    Promise.resolve(renderConventions(ctx, languages)),
    renderCeiling(ctx).then((f) => (f ? [f] : [])),
  ]);
  const before = groups.flat();
  const after = renderUserConfig(ctx);
  // Rendered last because its "already written" list is the rest of this plan.
  const part0 = await renderPart0(ctx, [...before, ...after]);

  return [...before, ...(part0 ? [part0] : []), ...after];
}

export type { RenderContext };
