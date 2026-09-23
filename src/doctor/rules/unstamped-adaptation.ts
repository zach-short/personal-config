import { eachLine } from '../../lib/markdown.ts';
import { readStamp, stampLine } from '../../lib/stamp.ts';
import type { Finding, PlannedFile } from '../../lib/types.ts';
import type { Doc } from '../scan.ts';

/**
 * §0.7's header, at the start of a line. It is the one surviving evidence that a Part 0 session
 * rewrote a file: §0.8 told that session to delete the stamp and grep to prove none survived, so
 * the repos that most need this migration have no stamp to key on (stamp-provenance `DESIGN.md`
 * D3, H2). The header is agent-written prose and varies after these words — one adapted copy
 * this was scoped against closes the bold there, the other runs on into a sentence — so the
 * match stops where the protocol's wording stops.
 */
const HEADER = /^\*\*Adapted to this repo\b/;

/**
 * A standard version, on a line of the preamble that also says "standard", spelled as one:
 * `v1.0.2`, or `version: 1.2.0` — the boilerplate's own `**Standard version: 1.2.0**` line, and
 * the `… boilerplate.md\` v1.0.2` form the adapted copies use. Requiring the `v` or the word is
 * what keeps a runtime's version on a neighbouring line — `Bun 1.2.9` — from being read as the
 * standard's. A wrong version would claim a provenance the file does not have; `unknown` says
 * what is true and the drift rule keeps asking for it (DIAL-6).
 */
const NAMED_VERSION = /\bstandard\b[^\n]*?(?:\bversion:?\s*v?|\bv)(\d+\.\d+\.\d+)\b/i;

/**
 * The preamble ends where the body starts. Every adaptation keeps `# Part 1`, and a version
 * quoted below it — a changelog entry, a rule citing the standard by number — is not the one the
 * file was adapted from. The cap is for a file with no parts at all.
 */
const PREAMBLE_LIMIT = 120;

export const UNSTAMPED_ADAPTATION = 'unstamped-adaptation';

/**
 * A file a Part 0 session adapted and then unstamped, as §0.8 instructed until 2026-09-23. Such
 * a file is invisible to both stamp readers: `setup` will not touch it, which is right, and
 * `doctor` cannot say which standard it came from, which is not (G5). The fix under `--fix`
 * gives it an adapted stamp — provenance without permission — at the standard version its own
 * header names.
 */
export const unstampedAdaptation = {
  id: UNSTAMPED_ADAPTATION,
  standardId: '§0.7',
  appliesTo: () => true,
  check(doc: Doc): Finding[] {
    if (readStamp(doc.text) !== null) return [];
    const header = eachLine(doc.text).find(({ text }) => HEADER.test(text));
    if (!header) return [];
    return [
      {
        rule: UNSTAMPED_ADAPTATION,
        standardId: '§0.7',
        file: doc.path,
        line: header.line,
        message: messageFor(adaptedStandardVersion(doc.text)),
        fixable: true,
      },
    ];
  },
};

function messageFor(named: string): string {
  const from =
    named === 'unknown'
      ? 'from a standard version its header does not name'
      : `from standard v${named}`;
  return `adapted by Part 0 ${from} and carries no stamp, so nothing can report when that standard moves — \`doctor --fix\` writes an adapted stamp, which \`setup\` never overwrites`;
}

/** The standard version the file's own preamble names, else `unknown` (DIAL-6). */
export function adaptedStandardVersion(text: string): string {
  for (const { text: line } of preamble(text)) {
    const match = line.match(NAMED_VERSION);
    if (match?.[1]) return match[1];
  }
  return 'unknown';
}

function preamble(text: string): Array<{ text: string; line: number }> {
  const lines = eachLine(text);
  const body = lines.findIndex(({ text: line }) => /^# Part\b/.test(line));
  return lines.slice(0, body === -1 ? PREAMBLE_LIMIT : body);
}

/**
 * Eight hex digits the hash function will never mean: the file's provenance in answers is
 * unknowable — the session that adapted it rewrote the render, and nothing recorded which
 * answers produced the bytes it started from — and the current merged config's hash would claim
 * exactly that knowledge. Nothing reads an adapted file's hash (the guard refuses the file and
 * the drift rule never re-renders it), so the field carries the one honest value the stamp's
 * shape admits.
 */
const UNKNOWN_HASH = '00000000';

/**
 * The one write `--fix` makes for this rule: an adapted stamp line, prepended by the
 * `mark-adapted` strategy in `write-plan.ts`, which keeps every other byte. Versioned and dated
 * by the run that writes it, the way every stamp is; the standard version is the header's.
 */
export function adaptationFix(
  path: string,
  text: string,
  at: { version: string; date: string },
): PlannedFile {
  const contents = stampLine({
    version: at.version,
    date: at.date,
    configHash: UNKNOWN_HASH,
    standardVersion: adaptedStandardVersion(text),
    adapted: true,
  });
  return { path, contents, label: 'adapted stamp', strategy: 'mark-adapted' };
}
