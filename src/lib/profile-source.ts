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

/** Generous for one small JSON document, and short enough that a dead server is not a hang. */
const FETCH_TIMEOUT_MS = 10_000;

/** Room for an apex/www or trailing-slash hop, few enough that a redirect loop terminates. */
const MAX_REDIRECTS = 5;

async function fetchProfile(url: string, given: string): Promise<Partial<Config>> {
  const { response, from } = await followSecurely(url, given);
  if (!response.ok) throw new Error(`--from ${given} → HTTP ${response.status} from ${from}`);
  return asProfile(await response.json(), from);
}

/**
 * Redirects are followed by hand so that every hop is checked rather than only the URL typed.
 * `fetch`'s own following would take a 302 from https down to http and send the request anyway:
 * the protocol check ran once, against the URL given, and the promise this tool makes is about
 * the request it sends.
 */
async function followSecurely(
  start: string,
  given: string,
): Promise<{ response: Response; from: string }> {
  let from = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    requireSecure(from, given);
    const response = await get(from, given);
    const next = redirectTarget(response, from);
    if (next === null) return { response, from };
    from = next;
  }
  throw new Error(`--from ${given} redirected more than ${MAX_REDIRECTS} times`);
}

function requireSecure(url: string, given: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error(`--from ${given} is not https — a profile is only fetched over https`);
  }
}

/** Without a deadline a server that accepts and never answers hangs `setup` with no message. */
async function get(url: string, given: string): Promise<Response> {
  try {
    return await fetch(url, {
      headers: { accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    const reason = timedOut ? `no answer in ${FETCH_TIMEOUT_MS / 1000}s` : 'the request failed';
    throw new Error(`--from ${given} → ${reason} (${url})`);
  }
}

/** A 3xx without a `location` is not a redirect anyone can follow; let it fail as a status. */
function redirectTarget(response: Response, from: string): string | null {
  if (response.status < 300 || response.status >= 400) return null;
  const location = response.headers.get('location');
  return location === null ? null : new URL(location, from).toString();
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
