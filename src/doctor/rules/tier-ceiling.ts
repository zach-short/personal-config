/**
 * Per-repo tier ceiling violations. Flags two cases:
 * (a) Board Model cells or pass-off headers above the repo's ceiling
 * (b) Global availableModels that re-admit a capped tier
 *
 * Ceilings are a per-repo budget (F5), and a board row assigning a tier the repo cannot run is
 * dead work when the session delegates it, or worse when it silently underperforms.
 *
 * Global models that undo a cap are a silent failure (F2): a session running with global Deep
 * models can run any task regardless of a repo's ceiling, because the global models are
 * concatenated with the local ones and deduplicated.
 */

import type { Finding } from '../../lib/types.ts';

export const tierCeiling = {
  id: 'tier-ceiling',
  standardId: null,
  appliesTo: (): boolean => {
    // TODO: apply this rule once board parsing is implemented
    return false;
  },
  check(): Finding[] {
    // TODO: implement when board parsing is ready
    return [];
  },
};
