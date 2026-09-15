import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { DEFAULT_DOC_NAMES, type DocNames, docStem, readDocNames } from '../lib/repo-config.ts';

export type DocKind =
  | 'ledger'
  | 'board'
  | 'standard'
  | 'conventions'
  | 'archive-index'
  /** §2.2 — a Profile P effort's `SCOPE.md`, `DESIGN.md`, `PLAN.md` or `RUNTIME-PASS.md`. */
  | 'project'
  /** §8.2 — the docs index, which is the one map of a docs tree. */
  | 'docs-index'
  | 'other';

export type Doc = {
  path: string;
  kind: DocKind;
  text: string;
  lines: string[];
  /** A source template: unfilled by construction, so the prose rules do not apply to it. */
  isTemplate: boolean;
  /** How this repo cites its ledger — `HANDOFF` unless §0.2 adopted another name. */
  ledgerStem: string;
};

/**
 * `templates/` exists to hold `{{TOKENS}}`, and the boilerplate standard quotes R1's own
 * trigger words while defining R1. Checking either for filled-ness is checking a stencil for
 * being a drawing. An *adapted* copy in a real repo is still checked.
 */
export function isTemplateSource(path: string): boolean {
  const normalized = path.replaceAll('\\', '/');
  return (
    normalized.startsWith('templates/') ||
    normalized.includes('/templates/') ||
    normalized.includes('.boilerplate.')
  );
}

export function eachLine(doc: Doc): Array<{ text: string; line: number }> {
  return doc.lines.map((text, index) => ({ text, line: index + 1 }));
}

/** Lines inside fenced blocks are code, and most rules are about prose. */
export function proseLines(doc: Doc): Array<{ text: string; line: number }> {
  let fenced = false;
  return eachLine(doc).filter(({ text }) => {
    if (text.trimStart().startsWith('```')) {
      fenced = !fenced;
      return false;
    }
    return !fenced;
  });
}

const NAMES: Array<[RegExp, DocKind]> = [
  [/^HANDOFF\.md$/, 'ledger'],
  [/^PASSOFF\.md$/, 'board'],
  [/^AGENT-PRACTICES(\.local|\.boilerplate)?\.md$/, 'standard'],
  [/^agent-practices.*\.md$/, 'standard'],
  [/^conventions-.*\.md$/, 'conventions'],
  [/^INDEX\.md$/, 'archive-index'],
  [/^(SCOPE|DESIGN|PLAN|RUNTIME-PASS)\.md$/, 'project'],
];

/** §2.2 puts one folder per open effort under `incomplete/`; every doc in one is a project doc. */
const IN_PROGRESS = /(^|\/)incomplete\/.+\.md$/;

/** §8.2's docs index. The repo's own root `README.md` is not one, hence the required folder. */
const DOCS_INDEX = /(^|\/)docs\/README\.md$/i;

/**
 * The adopted names win over the table, so a repo whose ledger is `NOTES.md` gets the ledger
 * rules; the table still runs, so a repo keeping both files is not made to choose.
 */
export function kindOf(path: string, names: DocNames = DEFAULT_DOC_NAMES): DocKind {
  const name = basename(path);
  if (name === names.ledger) return 'ledger';
  if (name === names.board) return 'board';

  // Path before name: a Profile P repo keeps whatever it likes inside an effort's folder, and
  // all of it is a doc the prose rules apply to. Before 2026-09-15 they all landed in `other`,
  // which every rule skips, so a Profile P repo was walked and nothing applied to anything.
  const normalized = path.replaceAll('\\', '/');
  if (IN_PROGRESS.test(normalized)) return 'project';
  if (DOCS_INDEX.test(normalized)) return 'docs-index';

  return NAMES.find(([pattern]) => pattern.test(name))?.[1] ?? 'other';
}

/**
 * `.claude/worktrees` holds second checkouts of the same repo, so scanning them reports every
 * finding twice and attributes it to a path the owner does not edit. Findings belong to the
 * primary checkout.
 */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'vendor',
  'worktrees',
]);

export async function collectDocs(root: string, depth = 4): Promise<Doc[]> {
  const [paths, names] = await Promise.all([walk(root, depth), readDocNames(root)]);
  const ledgerStem = docStem(names.ledger);
  return Promise.all(
    paths.map(async (path) => {
      const text = await Bun.file(path).text();
      return {
        path,
        kind: kindOf(path, names),
        text,
        lines: text.split('\n'),
        isTemplate: isTemplateSource(path),
        ledgerStem,
      };
    }),
  );
}

async function walk(dir: string, depth: number): Promise<string[]> {
  if (depth < 0) return [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const found: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) found.push(...(await walk(path, depth - 1)));
    } else if (entry.name.endsWith('.md')) {
      found.push(path);
    }
  }
  return found;
}

/**
 * Inline code and a quoted single word are *mentions*, not uses: a doc defining R1 has to be
 * able to write `never "today"`, and a code map has to be able to say a template carries
 * `{{TOKENS}}`. Stripping both before matching is what lets these rules describe themselves.
 */
export function stripMentions(text: string): string {
  // A short quoted phrase, not an arbitrary quotation: R1 itself writes `never "last week"`.
  return text.replaceAll(/`[^`]*`/g, '').replaceAll(/"[\w -]{1,20}"/g, '');
}
