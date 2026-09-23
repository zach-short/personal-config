import { proseLines } from './markdown.ts';
import { versionsBetween } from './semver.ts';

export type ChangelogEntry = {
  version: string;
  date: string;
  /** The entry's own text below its heading, trimmed of blank lines at either end. */
  body: string;
};

/**
 * Both changelogs head an entry `## <version> — <date>` (upgrade-command `DESIGN.md` U4). A
 * level-two heading of any other shape still ends the entry above it — an `## Unreleased` must
 * not be read as more of the release beneath it — but is not an entry itself.
 */
const ENTRY = /^## (\S+) — (\d{4}-\d{2}-\d{2})\s*$/;

/**
 * Headings are found among prose lines only, so a fenced example quoting a changelog heading
 * cannot open an entry. The body is sliced from the whole text, fences included.
 */
export function parseChangelog(text: string): ChangelogEntry[] {
  const lines = text.split('\n');
  const headings = proseLines(text).filter(({ text: line }) => /^## /.test(line));

  return headings.flatMap((heading, index) => {
    const match = heading.text.match(ENTRY);
    if (!match?.[1] || !match[2]) return [];
    const end = headings[index + 1]?.line ?? lines.length + 1;
    const body = lines.slice(heading.line, end - 1).join('\n');
    return [{ version: match[1], date: match[2], body: trimBlankLines(body) }];
  });
}

/**
 * The entries a copy adapted at `from` has not seen once `to` is installed — after `from`, up to
 * and including `to`, newest first (D2, DIAL-4). All of them, because a skipped middle version
 * is a skipped instruction.
 */
export function entriesBetween(
  entries: ChangelogEntry[],
  from: string,
  to: string,
): ChangelogEntry[] {
  const wanted = versionsBetween(
    entries.map((entry) => entry.version),
    from,
    to,
  );
  return wanted.flatMap((version) => entries.filter((entry) => entry.version === version));
}

function trimBlankLines(text: string): string {
  return text.replace(/^\s*\n/, '').replace(/\s+$/, '');
}
