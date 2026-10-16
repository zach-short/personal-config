import type { GlobalFile } from '../lib/types.ts';
import { trackRuleFiles } from './rules.ts';
import { skillFiles } from './skills.ts';
import { writeDocFiles } from './write-doc.ts';

/**
 * Every global file a `setup` run may remove because it no longer renders it
 * (setup-global-leftovers D1, BD-2). Each renderer names its own files, so a skill or rule added
 * there joins this list without an edit here. Hook scripts, `settings.json` and `config.json` are
 * never on it (D3), and neither are `write-doc/check.sh` (BD-3) or `language-style.md` (BD-7).
 *
 * A list of paths, not a render: `renderAll` stays a function of the answers, and `doctor`'s
 * rerender must never see a removal (BD-1).
 */
export function globalCandidates(): GlobalFile[] {
  return [...skillFiles(), ...writeDocFiles(), ...trackRuleFiles()];
}
