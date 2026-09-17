import { join, relative } from 'node:path';
import { exists, readText } from '../../lib/disk.ts';
import { excludeFile } from '../../lib/git.ts';
import { readTrackMode } from '../../lib/repo-config.ts';
import type { Finding, PlannedFile } from '../../lib/types.ts';

const PERSONAL = ['.personal-config.json', 'PART0-PROMPT.md'];

/**
 * A personal file that git can see is a personal file about to be swept into a commit. This
 * checks both ignore mechanisms, because untracked mode deliberately uses `.git/info/exclude`
 * rather than editing a repo-owned `.gitignore`.
 */
export async function ignoredFiles(repoRoot: string, extra: string[] = []): Promise<Finding[]> {
  const ignoreText = await readBoth(repoRoot);
  const wanted = [...PERSONAL, ...extra];

  const present = await Promise.all(
    wanted.map(async (name) => ((await exists(join(repoRoot, name))) ? name : null)),
  );

  return present
    .filter((name): name is string => name !== null)
    .filter((name) => !ignoreText.includes(name))
    .map((name) => ({
      rule: 'ignored',
      standardId: null,
      file: join(repoRoot, name),
      line: 1,
      message: `personal file is not covered by .gitignore or .git/info/exclude`,
      fixable: true,
    }));
}

/**
 * Both ignore files, and the exclude one is located by asking git rather than by spelling
 * `.git/info/exclude` out. A linked worktree's `.git` is a file, so the spelled path does not
 * exist there and every already-excluded file reads as uncovered — and `--fix` would then
 * append a line this would never see, once per run, forever. The detector and the fix have to
 * agree about which file they are talking about.
 */
async function readBoth(repoRoot: string): Promise<string> {
  const files = [join(repoRoot, '.gitignore'), await excludeFile(repoRoot)];
  const texts = await Promise.all(
    files.map(async (f) => ((await exists(f)) ? readText(f) : '')),
  );
  return texts.join('\n');
}

/**
 * Where this rule's fix lands, and it is the same choice `setup` made rather than a second
 * opinion about it: a repo you track keeps its entries in `.gitignore`, and a repo you do not
 * is kept out of `.git/info/exclude`, which is not yours to commit. A config that says nothing
 * is read as untracked, because writing into someone else's `.gitignore` is the worse mistake.
 */
export async function ignoreTarget(repoRoot: string): Promise<string> {
  const mode = await readTrackMode(repoRoot);
  return mode === 'tracked' ? join(repoRoot, '.gitignore') : excludeFile(repoRoot);
}

/**
 * The one mechanical fix `doctor --fix` applies: the names this rule found, as ignore lines.
 *
 * Anchored with a leading `/` for the reason the renderer anchors its own: a bare
 * `PART0-PROMPT.md` matches at every depth, so it would also hide one a repo legitimately
 * ships, and on a case-insensitive filesystem it hides other spellings too — observed in this
 * repo, 2026-09-15. `append-lines` rather than `overwrite` so an ignore file a person wrote
 * keeps every line and its order; it is also why the stamp guard lets this through, which it
 * does for exactly the writes that claim no authorship.
 */
export function ignoreFix(repoRoot: string, target: string, findings: Finding[]): PlannedFile {
  // `relative`, not a slice of the root's length: `doctor .` makes the root `.`, and
  // `join('.', 'PART0-PROMPT.md')` normalizes away the prefix that slice assumes is there —
  // which silently produced `/RT0-PROMPT.md`, an ignore line matching nothing.
  const lines = findings.map((f) => `/${relative(repoRoot, f.file)}`);
  return {
    path: target,
    contents: `${lines.join('\n')}\n`,
    label: 'ignore entries',
    strategy: 'append-lines',
  };
}
