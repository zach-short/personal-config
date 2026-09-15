import { join } from 'node:path';
import { configFile, repoRoot } from './paths.ts';
import type { Cli, Config } from './types.ts';

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

/** The stamp's `config <sha256[:8]>` — what makes drift detectable on a later `doctor` run. */
export async function configHash(config: Config): Promise<string> {
  const stable = JSON.stringify({
    models: config.models,
    answers: sortedAnswers(config.answers),
    archiveHome: config.archiveHome,
  });
  const digest = new Bun.CryptoHasher('sha256').update(stable).digest('hex');
  return digest.slice(0, 8);
}

function sortedAnswers(answers: Config['answers']): Config['answers'] {
  return Object.fromEntries(Object.entries(answers).sort(([a], [b]) => a.localeCompare(b)));
}
