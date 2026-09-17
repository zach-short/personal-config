import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { exists as isFile } from './disk.ts';
import { isGitRepo, ownerFromRemote, remoteUrl, worktreeCount } from './git.ts';
import { expandHome } from './paths.ts';
import { type DocNames, readDocNames } from './repo-config.ts';
import type { RepoScan, TargetKind, WorkProfile } from './types.ts';

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

/**
 * The directory each ecosystem above writes for itself. Every entry is the generated
 * counterpart of a marker this scanner already reads — `node_modules` beside the lockfiles in
 * `LOCKFILES`, `target` beside `Cargo.toml`, `vendor` beside `go.mod`, `Pods` and
 * `DerivedData` beside `Package.swift` — which is what keeps it one bounded list rather than
 * an open-ended catalogue of directories somebody disliked. It grows when the scanner learns a
 * new ecosystem, and not otherwise.
 *
 * Consulted for plain directories only. A git repo is a candidate on the strength of its
 * `.git` whatever it is called, exactly as it was at 0.2.6.
 */
const TOOL_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  'target',
  'vendor',
  'Pods',
  'DerivedData',
  '__pycache__',
  'venv',
  'site-packages',
]);

/**
 * Discovery finds git repos *and* plain directories, each tagged (setup-tracks `DESIGN.md`
 * D5): some of a person's work is in git and some of it is a folder on disk, and the folders
 * were invisible to `setup` until now.
 *
 * Dropping the `isGitRepo` filter means every directory one level down qualifies unless
 * something says otherwise, so `admitsFolder` is what says otherwise. Its rule is the existing
 * "not hidden" test extended twice rather than a parallel exclusion list: a directory is not a
 * candidate if a *tool* made it (`TOOL_DIRS`), and not a candidate if it is empty of anything a
 * person would see. A git repo skips both tests — `.git` is the declaration, and an empty repo
 * is still a repo somebody made on purpose.
 */
export async function scanProjectsDir(dir: string): Promise<RepoScan[]> {
  const root = expandHome(dir);
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const candidates = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));
  const scans = await Promise.all(
    candidates.map(async (e) => {
      const path = join(root, e.name);
      if (await isGitRepo(path)) return scanRepo(path, 'git');
      return (await admitsFolder(path, e.name)) ? scanRepo(path, 'folder') : null;
    }),
  );
  return scans
    .filter((s): s is RepoScan => s !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Not a tool's directory, and not empty of anything a person put there. */
async function admitsFolder(path: string, name: string): Promise<boolean> {
  if (TOOL_DIRS.has(name)) return false;
  const entries = await readdir(path).catch(() => []);
  return entries.some((entry) => !entry.startsWith('.'));
}

/**
 * The git reads are asked of git targets only, and that is load-bearing rather than tidy.
 * Every git command resolves the *enclosing* repository, so `git remote get-url origin` run in
 * a plain folder that happens to sit inside one answers with that repository's remote — a
 * folder under a scanned directory inside a checkout would report an owner it does not have,
 * and the ownership guard would then decide a target's track mode from somebody else's remote.
 * Found 2026-09-17 by the fixtures, which live inside this repo. A folder has no remote and no
 * worktrees; saying so here is cheaper than every caller having to remember it.
 */
export async function scanRepo(path: string, kind: TargetKind = 'git'): Promise<RepoScan> {
  const names = await readDocNames(path);
  const git = kind === 'git';
  const [languages, packageManager, hasCi, migrations, existingDocs, worktrees, owner] =
    await Promise.all([
      detectLanguages(path),
      detectPackageManager(path),
      exists(join(path, '.github', 'workflows')),
      detectPresent(path, MIGRATION_DIRS),
      detectPresent(path, [names.ledger, names.board, ...DOC_MARKERS]),
      git ? worktreeCount(path) : 0,
      git ? remoteUrl(path).then(ownerFromRemote) : null,
    ]);

  const adopted = adoptedDocs(names, existingDocs);
  return {
    path,
    name: basename(path),
    kind,
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
