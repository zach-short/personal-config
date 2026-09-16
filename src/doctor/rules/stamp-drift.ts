import { readStamp } from '../../lib/stamp.ts';
import type { Finding } from '../../lib/types.ts';
import type { Doc } from '../scan.ts';

export type StampExpectation = { configHash: string; standardVersion: string };

/**
 * Drift: a file this tool wrote whose stamped config hash no longer matches the merged config,
 * or whose standard version is behind `standard/VERSION`. Both mean the file predates an
 * answer or a standard revision — it is stale, not wrong, and re-running `setup` fixes it.
 *
 * Silent on a file with no stamp, and that is the same call the stamp guard makes in
 * `write-plan.ts`: a file no re-run will overwrite is a file this has no standing to report on.
 * The two have to agree, or stripping a stamp to take a document back would buy a drift finding
 * that no re-run could ever clear.
 */
export function stampDrift(doc: Doc, expected: StampExpectation): Finding[] {
  const stamp = readStamp(doc.text);
  if (!stamp) return [];

  const findings: Finding[] = [];
  if (stamp.configHash !== expected.configHash) {
    findings.push(
      finding(
        doc,
        `stamped config ${stamp.configHash}, current is ${expected.configHash} — re-run \`personal-config setup\``,
      ),
    );
  }
  if (isOlder(stamp.standardVersion, expected.standardVersion)) {
    findings.push(
      finding(doc, `standard v${stamp.standardVersion} is behind v${expected.standardVersion}`),
    );
  }
  return findings;
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
