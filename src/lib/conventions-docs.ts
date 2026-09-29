import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * A `docs/conventions-<suffix>.md` suffix → the language id discovery reports, and how strongly
 * that file claims it. Rank 0 is a hand-picked name for the language (`ts`), 1 is the name this
 * tool would write itself (`typescript`), 2 is a sibling that stands in for it.
 *
 * `js` stands in for `typescript` because the scanner cannot tell them apart — `package.json`
 * alone reports `typescript` — so a JavaScript repo that keeps `conventions-js.md` would
 * otherwise get a `conventions-typescript.md` beside it: the two-standards bug of 2026-09-29.
 */
const SUFFIXES: Record<string, [language: string, rank: number]> = {
  ts: ['typescript', 0],
  tsx: ['typescript', 0],
  typescript: ['typescript', 1],
  js: ['typescript', 2],
  javascript: ['typescript', 2],
  golang: ['go', 0],
  go: ['go', 1],
  py: ['python', 0],
  python: ['python', 1],
  rs: ['rust', 0],
  rust: ['rust', 1],
  swift: ['swift', 1],
};

const PATTERN = /^conventions-(.+)\.md$/;

/**
 * The code standards a repo already keeps, by language, under whatever name (standard §0.2 —
 * adopted, not renamed, because every citation already points at the name it has). Where two
 * files claim one language, the hand-picked name wins over the default: a repo holding both
 * `conventions-ts.md` and a generated `conventions-typescript.md` is cited by the one a person
 * wrote. Two *languages* — `conventions-go.md` beside `conventions-typescript.md` — are not a
 * duplicate and both stand.
 */
export async function detectConventionsDocs(path: string): Promise<Record<string, string>> {
  const entries = await readdir(join(path, 'docs')).catch(() => []);
  const best: Record<string, [file: string, rank: number]> = {};
  for (const entry of [...entries].sort()) {
    const claim = claimOf(entry);
    if (!claim) continue;
    const [language, rank] = claim;
    const held = best[language];
    if (!held || rank < held[1]) best[language] = [`docs/${entry}`, rank];
  }
  return Object.fromEntries(Object.entries(best).map(([language, [file]]) => [language, file]));
}

function claimOf(entry: string): [string, number] | null {
  const suffix = PATTERN.exec(entry)?.[1];
  return suffix ? (SUFFIXES[suffix.toLowerCase()] ?? null) : null;
}
