import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { isGitRepo, ownerFromRemote, remoteUrl, worktreeCount } from './git.ts';
import { expandHome } from './paths.ts';
import type { RepoScan, WorkProfile } from './types.ts';

/** Marker file → language. First match per language wins; a repo can report several. */
const LANGUAGE_MARKERS: Array<[string, string]> = [
  ['package.json', 'typescript'],
  ['tsconfig.json', 'typescript'],
  ['go.mod', 'go'],
  ['Package.swift', 'swift'],
  ['project.yml', 'swift'],
  ['pyproject.toml', 'python'],
  ['Cargo.toml', 'rust'],
];

const LOCKFILES: Array<[string, string]> = [
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
];

const MIGRATION_DIRS = ['migrations', 'supabase/migrations', 'db/migrate'];

/** Files whose presence means the profile is already chosen (standard §0.2) — adopt, never rename. */
const LEDGER_MARKERS = ['HANDOFF.md', 'PASSOFF.md'];
const FOLDER_MARKERS = ['docs/incomplete'];
const DOC_MARKERS = [
  'HANDOFF.md',
  'PASSOFF.md',
  'docs/incomplete',
  'AGENT-PRACTICES.md',
  'docs/agent-practices.md',
  'CLAUDE.md',
  'CLAUDE.local.md',
  'AGENTS.md',
];

export async function scanProjectsDir(dir: string): Promise<RepoScan[]> {
  const root = expandHome(dir);
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const candidates = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));
  const scans = await Promise.all(
    candidates.map(async (e) => {
      const path = join(root, e.name);
      return (await isGitRepo(path)) ? scanRepo(path) : null;
    }),
  );
  return scans
    .filter((s): s is RepoScan => s !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function scanRepo(path: string): Promise<RepoScan> {
  const [languages, packageManager, hasCi, migrations, existingDocs, worktrees, owner] =
    await Promise.all([
      detectLanguages(path),
      detectPackageManager(path),
      exists(join(path, '.github', 'workflows')),
      detectPresent(path, MIGRATION_DIRS),
      detectPresent(path, DOC_MARKERS),
      worktreeCount(path),
      remoteUrl(path).then(ownerFromRemote),
    ]);

  return {
    path,
    name: basename(path),
    languages,
    packageManager,
    hasCi,
    migrations,
    existingDocs,
    worktrees,
    remoteOwner: owner,
    impliedProfile: impliedProfile(existingDocs),
  };
}

function impliedProfile(existingDocs: string[]): WorkProfile | null {
  if (LEDGER_MARKERS.some((m) => existingDocs.includes(m))) return 'ledger';
  if (FOLDER_MARKERS.some((m) => existingDocs.includes(m))) return 'folders';
  return null;
}

async function detectLanguages(path: string): Promise<string[]> {
  const hits = await Promise.all(
    LANGUAGE_MARKERS.map(async ([marker, lang]) =>
      (await exists(join(path, marker))) ? lang : null,
    ),
  );
  return [...new Set(hits.filter((l): l is string => l !== null))];
}

async function detectPackageManager(path: string): Promise<string | null> {
  for (const [lockfile, manager] of LOCKFILES) {
    if (await exists(join(path, lockfile))) return manager;
  }
  return null;
}

async function detectPresent(path: string, names: string[]): Promise<string[]> {
  const hits = await Promise.all(
    names.map(async (name) => ((await exists(join(path, name))) ? name : null)),
  );
  return hits.filter((n): n is string => n !== null);
}

async function exists(path: string): Promise<boolean> {
  if (await Bun.file(path).exists()) return true;
  // Bun.file().exists() is false for directories, so probe for a directory separately.
  return readdir(path)
    .then(() => true)
    .catch(() => false);
}
