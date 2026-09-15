import { join } from 'node:path';
import { repoRoot } from './paths.ts';

/** The stamp's `v<pkg version>` — read from package.json so it cannot drift from the release. */
export async function version(): Promise<string> {
  const file = Bun.file(join(repoRoot(), 'package.json'));
  const pkg = (await file.json()) as { version?: string };
  return pkg.version ?? '0.0.0';
}
