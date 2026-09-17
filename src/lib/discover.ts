import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { exists as isFile } from './disk.ts';
import { isGitRepo, ownerFromRemote, remoteUrl, worktreeCount } from './git.ts';
import { expandHome } from './paths.ts';
import { type DocNames, readDocNames } from './repo-config.ts';
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

/** A project folder fixes the profile the way a ledger does (standard §0.2). */
const FOLDER_MARKERS = ['docs/incomplete'];
const DOC_MARKERS = [
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
  const names = await readDocNames(path);
  const [languages, packageManager, hasCi, migrations, existingDocs, worktrees, owner] =
    await Promise.all([
      detectLanguages(path),
      detectPackageManager(path),
      exists(join(path, '.github', 'workflows')),
      detectPresent(path, MIGRATION_DIRS),
      detectPresent(path, [names.ledger, names.board, ...DOC_MARKERS]),
      worktreeCount(path),
      remoteUrl(path).then(ownerFromRemote),
    ]);

  const adopted = adoptedDocs(names, existingDocs);
  return {
    path,
    name: basename(path),
    languages,
    packageManager,
    hasCi,
    migrations,
    existingDocs,
    ...adopted,
    worktrees,
    remoteOwner: owner,
    impliedProfile: impliedProfile(existingDocs, adopted),
  };
}

type AdoptedDocs = Pick<RepoScan, 'ledgerDoc' | 'boardDoc'>;

/** Adopted under its own name: a rename would break every citation already pointing at it. */
function adoptedDocs(names: DocNames, existingDocs: string[]): AdoptedDocs {
  return {
    ledgerDoc: existingDocs.includes(names.ledger) ? names.ledger : null,
    boardDoc: existingDocs.includes(names.board) ? names.board : null,
  };
}

function impliedProfile(existingDocs: string[], adopted: AdoptedDocs): WorkProfile | null {
  if (adopted.ledgerDoc || adopted.boardDoc) return 'ledger';
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
  if (await isFile(path)) return true;
  // `isFile` is false for a directory, so probe for one separately.
  return readdir(path)
    .then(() => true)
    .catch(() => false);
}
