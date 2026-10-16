import type { GlobalFile } from '../lib/types.ts';
import { trackRuleFiles } from './rules.ts';
import { skillFiles } from './skills.ts';
import { writeDocFiles } from './write-doc.ts';

/**
 * Every global file a `setup` run may remove because it no longer renders it
 * (setup-global-leftovers D1, BD-2). Each renderer names its own files, so a skill or rule added
 * there joins this list without an edit here. `settings.json`, `config.json` and
 * `language-style.md` (BD-7) are never on it. Hook scripts and `write-doc/check.sh` are not on it
 * either: they go by stamp and by whether an entry still runs them (setup-hook-leftovers BD-6,
 * BD-7), which a stamp alone cannot answer, so `setup`'s `scriptLeftovers` plans them.
 *
 * A list of paths, not a render: `renderAll` stays a function of the answers, and `doctor`'s
 * rerender must never see a removal (BD-1).
 */
export function globalCandidates(): GlobalFile[] {
  return [...skillFiles(), ...writeDocFiles(), ...trackRuleFiles()];
}
