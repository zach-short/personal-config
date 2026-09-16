import { join } from 'node:path';
import { configFile, repoRoot } from './paths.ts';
import { loadProfileFrom } from './profile-source.ts';
import type { Answers, Cli, Config } from './types.ts';

/**
 * Merge order, lowest first: `starter` → `--profile <name>` → the user's saved config → the
 * repo's `.personal-config.json` → `--from` → CLI flags. A profile is therefore a *default
 * provider*, which is why `--profile` sits below the files: a saved answer outranks the profile
 * that suggested it.
 *
 * `--from` sits above them instead, and deliberately: it carries thirty answers the person gave
 * seconds ago on the site, and the failure worth preventing is those answers losing silently to
 * a saved config they have forgotten writing. The cost, accepted 2026-09-16: running it inside
 * an already-configured repo re-renders that repo to the new answers.
 */
export async function loadConfig(cli: Cli, repoDir: string | null): Promise<Config> {
  const layers = [
    await readProfile('starter'),
    cli.profile === 'starter' ? {} : await readProfile(cli.profile),
    await readJson(configFile()),
    repoDir ? await readJson(join(repoDir, '.personal-config.json')) : {},
    cli.from ? await loadProfileFrom(cli.from) : {},
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
 * The answers that belong to the *person* rather than to a repo — the set `setup` saves into
 * `~/.config/personal-config/config.json` so a second run does not re-ask them.
 *
 * This is an allowlist, and deliberately: an answer added to the catalog later is per-repo
 * until someone puts it here. That is the safe direction. The saved layer sits below a repo's
 * `.personal-config.json` in the merge, so a key the repo already holds cannot move its stamp
 * — but a key *no* repo has ever saved is a new input to the hash, and every configured repo
 * reports drift the moment it appears. Verified both ways 2026-09-15: a saved `commitPolicy`
 * differing from the rendered repo's left `doctor` clean, and one invented key produced six
 * `stamp-drift` findings.
 *
 * `practices.*` is absent on purpose. Those answers read as a person's house style, but they
 * are what each repo's `docs/conventions-<language>.md` is rendered from, and a Go repo and a
 * Swift repo want different ones. The owner's call, 2026-09-15.
 *
 * `workProfile`, `trackMode`, `archiveHome`, `mode` and `tracker` are absent because they are
 * already saved per repo, and `projectsDir` because it is where an invocation was pointed.
 */
const PERSONAL_ANSWERS = new Set([
  'attribution',
  'commitPolicy',
  'docsMcp',
  'hooks',
  'keepExistingGlobal',
  'models.deep',
  'models.default',
  'models.fast',
  'modelRouting',
  'skills',
]);

/** The subset of `answers` that is saved for the person, sorted so the file is diff-stable. */
export function personalAnswers(answers: Answers): Answers {
  return Object.fromEntries(
    Object.entries(answers)
      .filter(([key]) => PERSONAL_ANSWERS.has(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/** What the saved layer holds, for a caller that wants to report it before the merge hides it. */
export async function savedUserConfig(): Promise<Partial<Config>> {
  return readJson(configFile());
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
