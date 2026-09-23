import { diffSummary } from '../../lib/diff.ts';
import { readStamp, type StampParts } from '../../lib/stamp.ts';
import type { Finding } from '../../lib/types.ts';
import type { Doc } from '../scan.ts';

export type StampExpectation = {
  /** `standard/VERSION`, as installed. */
  standardVersion: string;
  /**
   * What `setup` would write at this path now, rendered as the file's own stamp says it was
   * rendered — same date, same provenance fields — or null where no run would write here, or
   * the repo carries no config to render from. `src/doctor/rerender.ts` supplies it.
   */
  rendered: string | null;
  /**
   * Whether a `.personal-config.json` sits beside the docs. A plain stamp is judged only then:
   * without a config there is nothing to render it against, and a stamped file in, say, a docs
   * folder of examples is not a personal file at all. An adapted stamp needs no config to be
   * behind — its owner put the marker there, or asked `doctor --fix` to.
   */
  configured: boolean;
};

/**
 * Drift, decided by re-rendering rather than by comparing a hash (stamp-provenance `DESIGN.md`
 * D2): a file this tool wrote is stale when `setup` would write it differently now, and a hash
 * that moved while the bytes did not — a package-supplied default the repo never saved (G12,
 * G13) — is not drift. A standard version behind `standard/VERSION` still reports on its own,
 * the 2026-09-16 call that a version line that lies is worse than a finding a reader can dismiss.
 *
 * An adapted file — marked in its stamp (D1) — is never re-rendered: the render would differ by
 * construction, and the guard in `write-plan.ts` refuses to write it, so "re-run `setup`" would
 * be advice nothing can act on. What it can still be is behind the standard it was adapted from,
 * and that reports as an advisory (D4): work to schedule, not a defect in the repo, and the one
 * finding most likely to sit for weeks — a `doctor` that is red for an upgrade you have not done
 * yet is a `doctor` people stop running.
 *
 * Silent on a file with no stamp, and that is the same call the stamp guard makes: a file no
 * re-run will overwrite is a file this has no standing to report on. The two have to agree, or
 * stripping a stamp to take a document back would buy a drift finding that no re-run could
 * ever clear.
 */
export function stampDrift(doc: Doc, expected: StampExpectation): Finding[] {
  const stamp = readStamp(doc.text);
  if (!stamp) return [];
  if (stamp.adapted) return adaptedLag(doc, stamp, expected.standardVersion);
  if (!expected.configured) return [];
  return [
    ...renderDrift(doc, expected.rendered),
    ...standardLag(doc, stamp, expected.standardVersion),
  ];
}

function renderDrift(doc: Doc, rendered: string | null): Finding[] {
  if (rendered === null || rendered === doc.text) return [];
  return [
    finding(
      doc,
      `\`setup\` would now write this file differently (${diffSummary(doc.text, rendered)}) — re-run it; or, if Part 0 rewrote this file, add \` · adapted\` to its stamp to keep it`,
    ),
  ];
}

function standardLag(doc: Doc, stamp: StampParts, current: string): Finding[] {
  if (!isOlder(stamp.standardVersion, current)) return [];
  return [finding(doc, `standard v${stamp.standardVersion} is behind v${current}`)];
}

/**
 * `unknown` is what `doctor --fix` writes where an adapted file's header names no version
 * (DIAL-6). It has to keep reporting: a stamp that names nothing can never be compared, and going
 * quiet on it would lose the one thing the migration existed to restore.
 */
function adaptedLag(doc: Doc, stamp: StampParts, current: string): Finding[] {
  if (stamp.standardVersion === 'unknown') {
    return [
      advisory(
        doc,
        'adapted from a standard version the stamp does not name — write it in as `standard v<x>` so a lag can be reported',
      ),
    ];
  }
  if (!isOlder(stamp.standardVersion, current)) return [];
  return [
    advisory(
      doc,
      `adapted from standard v${stamp.standardVersion}; v${current} is installed — the standard's changelog lists what changed, and \`setup\` will not touch an adapted file`,
    ),
  ];
}

function isOlder(a: string, b: string): boolean {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l !== r) return l < r;
  }
  return false;
}

function finding(doc: Doc, message: string): Finding {
  return {
    rule: 'stamp-drift',
    standardId: null,
    file: doc.path,
    line: 1,
    message,
    fixable: false,
  };
}

function advisory(doc: Doc, message: string): Finding {
  return { ...finding(doc, message), advisory: true };
}
