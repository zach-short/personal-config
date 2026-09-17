import { join } from 'node:path';
import { readJson } from './disk.ts';
import { repoRoot } from './paths.ts';

/** The stamp's `v<pkg version>` — read from package.json so it cannot drift from the release. */
export async function version(): Promise<string> {
  const pkg = (await readJson(join(repoRoot(), 'package.json'))) as { version?: string };
  return pkg.version ?? '0.0.0';
}
