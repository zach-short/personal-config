import { join } from 'node:path';
import { exists, readJson } from './disk.ts';
import { expandHome, repoRoot } from './paths.ts';
import type { Config } from './types.ts';

/**
 * `setup --from` takes one of three things, and a resolver cannot tell a bare id from a
 * relative path without knowing the id's shape. DIAL-6 fixed it: 8 characters of `[a-z0-9]`,
 * crypto-random. So the rule is — no scheme, no `/`, no `.`, and it matches `SHORT_ID` — that
 * is an id; anything else is a URL or a path.
 */
const SHORT_ID = /^[a-z0-9]{8}$/;

export type ProfileSource = 'id' | 'url' | 'path';

export function classifySource(value: string): ProfileSource {
  if (SHORT_ID.test(value) && !value.includes('/') && !value.includes('.')) return 'id';
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? 'url' : 'path';
}

/**
 * Where a short id resolves. The origin is fixed rather than configurable — the variant that
 * took a flag was offered and declined (`DESIGN.md` §5.2) — and it is read from `package.json`
 * so that no site of one person's lands in `src/`, which S1 forbids and a test greps for.
 */
export async function profileUrl(id: string): Promise<string> {
  return new URL(`/p/${id}`, await origin()).toString();
}

/** Resolves whichever of the three forms was given, into a config layer the merge can take. */
export async function loadProfileFrom(value: string): Promise<Partial<Config>> {
  const kind = classifySource(value);
  if (kind === 'path') return readProfileFile(expandHome(value));
  return fetchProfile(kind === 'id' ? await profileUrl(value) : value, value);
}

async function readProfileFile(path: string): Promise<Partial<Config>> {
  if (!(await exists(path))) throw new Error(`No profile at ${path} — --from found no file`);
  return asProfile(await readJson(path), path);
}

async function fetchProfile(url: string, given: string): Promise<Partial<Config>> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error(`--from ${given} is not https — a profile is only fetched over https`);
  }
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`--from ${given} → HTTP ${response.status} from ${url}`);
  return asProfile(await response.json(), url);
}

/** Parsed JSON is `unknown` until something narrows it — T1's rule at a real boundary. */
function asProfile(parsed: unknown, from: string): Partial<Config> {
  if (!isRecord(parsed)) throw new Error(`${from} is not a profile object`);
  if (parsed.answers !== undefined && !isRecord(parsed.answers)) {
    throw new Error(`${from} has an "answers" that is not an object`);
  }
  return parsed as Partial<Config>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `homepage` is the package's own field; S1 keeps the string out of `src/`. */
async function origin(): Promise<string> {
  const pkg = (await readJson(join(repoRoot(), 'package.json'))) as {
    homepage?: string;
  };
  if (pkg.homepage === undefined)
    throw new Error('package.json has no "homepage" to resolve an id against');
  return pkg.homepage;
}
