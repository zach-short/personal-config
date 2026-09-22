import type { Answers, AnswerValue, ConfigLayer, ModelTiers } from './types.ts';

/**
 * The one place a parsed JSON document becomes a merge layer, and the only thing standing
 * between `loadConfig` and whatever those documents actually hold.
 *
 * Until 2026-09-22 there was nothing: `config.ts` read every layer as `as Partial<Config>`, a
 * claim about four files' shape that nothing had checked (`docs/conventions-ts.md` T1). A
 * `"models": "Opus 5"` therefore reached `{ ...base.models, ...layer.models }`, which spreads a
 * string's character indices over the three tiers and leaves `models.deep` whatever the layer
 * below said — wrong, silent, and stamped into `.personal-config.json` by `configHash`.
 *
 * Unknown keys are kept rather than refused, because `.personal-config.json` is read twice:
 * here as a config layer, and by `repo-config.ts` for `ledgerFile`, `standardPath`,
 * `worktreePath`, `archiveHome` and `trackMode`. Half its keys are not `Config`'s by design.
 */
export function asConfigLayer(parsed: unknown, from: string): ConfigLayer {
  if (!isRecord(parsed)) throw new Error(`${from} is not a profile object`);
  const layer: ConfigLayer = {};
  if (parsed.profile !== undefined) layer.profile = asString(parsed.profile, 'profile', from);
  if (parsed.identity !== undefined) layer.identity = asIdentity(parsed.identity, from);
  if (parsed.models !== undefined) layer.models = asModels(parsed.models, from);
  if (parsed.answers !== undefined) layer.answers = asAnswers(parsed.answers, from);
  if (parsed.projectsDir !== undefined) {
    layer.projectsDir = asString(parsed.projectsDir, 'projectsDir', from);
  }
  if (parsed.archiveHome !== undefined) {
    layer.archiveHome = asString(parsed.archiveHome, 'archiveHome', from);
  }
  return layer;
}

/**
 * The same layer with any `identity` dropped — applied to every layer that did not ship inside
 * the package this tool is running from.
 *
 * A login is not a preference: `setup` passes `config.identity.githubLogin` to `ownsRepo`, and
 * a repo you own is the one where this tool writes *tracked* files and edits `.gitignore`
 * rather than keeping out of the way in `.git/info/exclude`. So a document that names a login
 * is a document that can point those writes at a repository you only cloned. Found 2026-09-17;
 * `--from` is the sharp edge, since it fetches a profile someone else handed out.
 *
 * `profiles/<name>.json` keeps its identity because it ships with the code that is running;
 * `grep -l githubLogin profiles/*.json` lists the ones that name a login. The saved user config
 * and a repo's `.personal-config.json` are stripped too, though neither is hostile:
 * `grep -rn identity src/ templates/` on 2026-09-22 matched `config.ts`, `types.ts` and
 * `setup.ts` and no renderer, so nothing this tool writes ever puts a login in either. Allowing
 * them would only widen the surface for a field that can arrive by hand-editing alone.
 */
export function withoutIdentity(layer: ConfigLayer): ConfigLayer {
  const { identity: _handedOver, ...rest } = layer;
  return rest;
}

function asIdentity(value: unknown, from: string): NonNullable<ConfigLayer['identity']> {
  if (!isRecord(value)) throw new Error(problem(from, 'identity', 'an object'));
  const login = value.githubLogin;
  // Absent stays absent rather than becoming an explicit `null`. `mergeLayer` spreads a layer's
  // identity over the one below it, so a `{ githubLogin: null }` synthesized here would erase a
  // login the profile underneath had legitimately set.
  if (login === undefined) return {};
  if (login !== null && typeof login !== 'string') {
    throw new Error(problem(from, 'identity.githubLogin', 'a string'));
  }
  return { githubLogin: login };
}

const TIERS = ['deep', 'default', 'fast'] as const;

function asModels(value: unknown, from: string): Partial<ModelTiers> {
  if (!isRecord(value)) throw new Error(problem(from, 'models', 'an object'));
  const models: Partial<ModelTiers> = {};
  for (const tier of TIERS) {
    if (value[tier] !== undefined) models[tier] = asString(value[tier], `models.${tier}`, from);
  }
  return models;
}

function asAnswers(value: unknown, from: string): Answers {
  if (!isRecord(value)) throw new Error(problem(from, 'answers', 'an object'));
  const answers: Answers = {};
  for (const [key, answer] of Object.entries(value)) {
    if (!isAnswerValue(answer)) {
      throw new Error(problem(from, `answers.${key}`, 'a string, boolean or list of strings'));
    }
    answers[key] = answer;
  }
  return answers;
}

function isAnswerValue(value: unknown): value is AnswerValue {
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function asString(value: unknown, field: string, from: string): string {
  if (typeof value !== 'string') throw new Error(problem(from, field, 'a string'));
  return value;
}

/** Both halves of what a person needs to fix it: which document, and which field in it. */
function problem(from: string, field: string, expected: string): string {
  return `${from}: "${field}" is not ${expected}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
