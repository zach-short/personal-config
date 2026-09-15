import { join } from 'node:path';
import { configFile, repoRoot } from './paths.ts';
import type { Answers, Cli, Config } from './types.ts';

/**
 * Merge order, lowest first: `starter` → `--profile <name>` → the user's saved config → the
 * repo's `.personal-config.json` → CLI flags. A profile is therefore a *default provider*,
 * which is why `--profile` sits below the files: a saved answer outranks the profile that
 * suggested it.
 */
export async function loadConfig(cli: Cli, repoDir: string | null): Promise<Config> {
  const layers = [
    await readProfile('starter'),
    cli.profile === 'starter' ? {} : await readProfile(cli.profile),
    await readJson(configFile()),
    repoDir ? await readJson(join(repoDir, '.personal-config.json')) : {},
    cliLayer(cli),
  ];
  return layers.reduce<Config>(mergeLayer, emptyConfig(cli.profile));
}

export function emptyConfig(profile: string): Config {
  return {
    profile,
    identity: { githubLogin: null },
    models: { deep: '', default: '', fast: '' },
    answers: {},
    projectsDir: '~/Projects',
    archiveHome: '',
  };
}

async function readProfile(name: string): Promise<Partial<Config>> {
  const path = join(repoRoot(), 'profiles', `${name}.json`);
  const layer = await readJson(path);
  if (Object.keys(layer).length === 0 && name !== 'starter') {
    throw new Error(`No profile named "${name}" — looked in profiles/${name}.json`);
  }
  return layer;
}

async function readJson(path: string): Promise<Partial<Config>> {
  const file = Bun.file(path);
  if (!(await file.exists())) return {};
  return (await file.json()) as Partial<Config>;
}

function cliLayer(cli: Cli): Partial<Config> {
  return cli.projectsDir ? { projectsDir: cli.projectsDir } : {};
}

function mergeLayer(base: Config, layer: Partial<Config>): Config {
  return {
    profile: layer.profile ?? base.profile,
    identity: { ...base.identity, ...layer.identity },
    models: { ...base.models, ...layer.models },
    answers: { ...base.answers, ...layer.answers },
    projectsDir: layer.projectsDir ?? base.projectsDir,
    archiveHome: layer.archiveHome ?? base.archiveHome,
  };
}

/**
 * Answers deliberately outside the hash, because they shape no rendered byte.
 *
 * `projectsDir` is where `setup` was pointed to look for repos — an input to the invocation,
 * not a configuration. Hashing it stamps identical files differently on two machines, and it
 * is the wrong thing to persist into a repo besides.
 *
 * The three `models.*` keys are already hashed as `models`, which `modelsFrom()` in
 * `commands/setup.ts` derives from exactly them. Hashing both counts one answer twice.
 */
const UNHASHED_ANSWERS = new Set([
  'projectsDir',
  'models.deep',
  'models.default',
  'models.fast',
]);

/**
 * The answers a stamp covers — and, by construction, exactly the set `setup` saves into
 * `.personal-config.json`. Both sides go through here so they cannot drift apart: whatever is
 * hashed is written down, and whatever is written down is what `doctor` hashes back.
 */
export function hashedAnswers(answers: Answers): Answers {
  return Object.fromEntries(
    Object.entries(answers)
      .filter(([key]) => !UNHASHED_ANSWERS.has(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * The stamp's `config <sha256[:8]>` — what makes drift detectable on a later `doctor` run.
 *
 * The promise this keeps is **save what is hashed**, not "hash only what is already saved".
 * Before 2026-09-15 nothing persisted the answers at all, so `doctor` could only ever rebuild
 * a profile's defaults and every freshly rendered repo reported drift on its first run. The
 * other direction — dropping `answers` from the hash so it only covers the handful of fields
 * `.personal-config.json` already held — was rejected: the `practices.*` answers are the main
 * thing that changes rendered content, and a drift rule that cannot see a practice change is
 * not worth the run.
 */
export async function configHash(config: Config): Promise<string> {
  const stable = JSON.stringify({
    models: config.models,
    answers: hashedAnswers(config.answers),
    archiveHome: config.archiveHome,
  });
  const digest = new Bun.CryptoHasher('sha256').update(stable).digest('hex');
  return digest.slice(0, 8);
}
