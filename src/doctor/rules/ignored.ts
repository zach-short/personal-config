import { join } from 'node:path';
import { exists, readText } from '../../lib/disk.ts';
import type { Finding } from '../../lib/types.ts';

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

async function readBoth(repoRoot: string): Promise<string> {
  const files = [join(repoRoot, '.gitignore'), join(repoRoot, '.git', 'info', 'exclude')];
  const texts = await Promise.all(
    files.map(async (f) => ((await exists(f)) ? readText(f) : '')),
  );
  return texts.join('\n');
}

export function ignoreFix(
  repoRoot: string,
  findings: Finding[],
): { path: string; lines: string[] } {
  return {
    path: join(repoRoot, '.git', 'info', 'exclude'),
    lines: findings.map((f) => f.file.slice(repoRoot.length + 1)),
  };
}
