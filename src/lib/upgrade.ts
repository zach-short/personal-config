import { type ChangelogEntry, entriesBetween } from './changelog.ts';
import { compareVersions } from './semver.ts';

/**
 * What one adapted standard's stamp says against the installed standard — the whole decision
 * `upgrade` makes, kept apart from the command so it is tested by calling it (L2).
 */
export type Verdict =
  | { kind: 'current'; version: string }
  | { kind: 'behind'; from: string; to: string; entries: ChangelogEntry[] }
  /** DIAL-2: the stamp is newer than what is installed — a cached, older copy of this tool. */
  | { kind: 'ahead'; from: string; to: string }
  /** What `doctor --fix` writes where an adapted file's header named no version (DIAL-6). */
  | { kind: 'unnamed' }
  | { kind: 'unreadable'; from: string };

export function assess(stamped: string, installed: string, entries: ChangelogEntry[]): Verdict {
  if (stamped === 'unknown') return { kind: 'unnamed' };
  const order = compareVersions(stamped, installed);
  if (order === null) return { kind: 'unreadable', from: stamped };
  if (order === 0) return { kind: 'current', version: installed };
  if (order > 0) return { kind: 'ahead', from: stamped, to: installed };
  return {
    kind: 'behind',
    from: stamped,
    to: installed,
    entries: entriesBetween(entries, stamped, installed),
  };
}

/**
 * Only a verdict this command cannot act on is a failure. Being behind is information, not a
 * defect (DIAL-3) — the same reason `doctor` reports it as an advisory. `ahead` fails because the
 * fix is to the tool, not the repo, and a loop over twelve repos has to notice that once rather
 * than read twelve clean exits; `unreadable` fails because a stamp nothing can compare is broken.
 */
export function isFailure(verdict: Verdict): boolean {
  return verdict.kind === 'ahead' || verdict.kind === 'unreadable';
}

/** The one line per adapted file, and the reason a person reads before any entry. */
export function verdictLine(path: string, verdict: Verdict): string {
  switch (verdict.kind) {
    case 'current':
      return `${path} — adapted from standard v${verdict.version}, which is the installed one. Nothing to do.`;
    case 'behind':
      return `${path} — adapted from standard v${verdict.from}; v${verdict.to} is installed. ${entryCount(verdict.entries.length)}`;
    case 'ahead':
      return `${path} — adapted from standard v${verdict.from}, newer than the v${verdict.to} this copy of personal-config ships. Update the package (\`npm install -g personal-config@latest\`, or clear the \`npx\` cache) and run this again; reading the changelog backwards would tell you to undo a change.`;
    case 'unnamed':
      return `${path} — adapted, but its stamp names no standard version. Write the one it was adapted from into the stamp as \`standard v<x>\` and run this again.`;
    case 'unreadable':
      return `${path} — adapted from standard v${verdict.from}, which is not a version this can compare. Correct the stamp to \`standard v<major>.<minor>.<patch>\`.`;
  }
}

/**
 * An empty slice between two different versions is the changelog missing an entry, and D2's
 * accepted cost is that this would otherwise read as a confident, empty prompt. Saying so is the
 * one guard this command can put on that.
 */
function entryCount(count: number): string {
  if (count === 0) {
    return "The standard's changelog has no entry between the two — it is missing one, so nothing below says what changed.";
  }
  return count === 1 ? 'One changelog entry between:' : `${count} changelog entries between:`;
}

/** The entries as they appear in both outputs: heading, then body, newest first. */
export function entriesText(entries: ChangelogEntry[], level = '##'): string {
  return entries
    .map((entry) => `${level} ${entry.version} — ${entry.date}\n\n${entry.body}`)
    .join('\n\n');
}
