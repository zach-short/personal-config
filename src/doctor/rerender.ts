import { basename, resolve } from 'node:path';
import { scanRepo } from '../lib/discover.ts';
import { isGitRepo } from '../lib/git.ts';
import { readRecordedTrackMode, readWorkProfile } from '../lib/repo-config.ts';
import { readStamp, type StampParts } from '../lib/stamp.ts';
import type { Config, RepoPlan } from '../lib/types.ts';
import { type RenderContext, targetAnswers } from '../render/context.ts';
import { renderAll } from '../render/index.ts';
import type { Doc } from './scan.ts';

/** What `setup` would write at this doc's path now, or null where no run would write there. */
export type Rerender = (doc: Doc) => string | null;

/**
 * The plan `setup` would write into a configured repo now, rebuilt from that repo's own record
 * (stamp-provenance `DESIGN.md` D2) — the front half of `setup` without a terminal: the scan is
 * re-run on the directory, the shape and mode come out of `.personal-config.json`, and the
 * answers are the merged config `doctor` already loads, which the repo's saved answers sit on
 * top of.
 *
 * **Each file is rendered as its own stamp says it was rendered.** The context takes the stamp
 * off the disk — CLI version, date, config hash, standard version — and dates itself the same
 * day, so the render and the file agree on every field that is a fact about *when* and *what
 * ran* rather than about the inputs. Three of those fields sit inside the body as well as the
 * stamp: the ledger's "Started <date>", the router's "Detected <date>", the standard's
 * "Pre-filled on <date>". Rendered today, every one of those would differ the day after setup,
 * and a drift rule that fires daily is one nobody reads. Rendered at the file's own date, the
 * comparison is exact equality and asks the one question drift means: would the same inputs,
 * on the same day, still produce these bytes? A hash that moved on a package default the repo
 * never saved (G12, G13) then compares equal; an answer that moves a byte (G17) does not.
 *
 * One render per distinct stamp, not per file — a repo's files usually share one.
 */
export async function rerender(root: string, config: Config, docs: Doc[]): Promise<Rerender> {
  const stamps = plainStamps(docs);
  if (stamps.size === 0) return () => null;

  const repo = await recordedPlan(root, config);
  const byStamp = new Map<string, Map<string, string>>();
  for (const [key, stamp] of stamps) byStamp.set(key, await renderAt(config, repo, stamp));

  return (doc) => {
    const stamp = readStamp(doc.text);
    // Checked here as well as in `plainStamps`: an adapted file's siblings usually share its
    // provenance, so the map has an entry for its key — and a render for its path — anyway.
    if (stamp === null || stamp.adapted) return null;
    return byStamp.get(stampKey(stamp))?.get(resolve(doc.path)) ?? null;
  };
}

/** The distinct stamps worth rendering for: an adapted file is never compared (D1). */
function plainStamps(docs: Doc[]): Map<string, StampParts> {
  const found = new Map<string, StampParts>();
  for (const doc of docs) {
    const stamp = readStamp(doc.text);
    if (stamp !== null && !stamp.adapted) found.set(stampKey(stamp), stamp);
  }
  return found;
}

function stampKey(stamp: StampParts): string {
  return [stamp.version, stamp.date, stamp.configHash, stamp.standardVersion].join(' ');
}

async function renderAt(
  config: Config,
  repo: RepoPlan,
  stamp: StampParts,
): Promise<Map<string, string>> {
  const answers = targetAnswers(config.answers, repo);
  const ctx: RenderContext = {
    config: { ...config, answers },
    answers,
    stamp,
    date: stamp.date,
    repo,
  };
  const files = await renderAll(ctx);
  return new Map(files.filter(isCompared).map((file) => [file.path, file.contents]));
}

/**
 * The Part 0 prompt is a snapshot of discovery at the moment `setup` ran — the docs that
 * existed, the worktrees beside the checkout — and it exists to be pasted once and deleted.
 * Re-deriving it after the run has written the ledger and the board finds those documents and
 * reports a different prompt, which is not the file being stale; it is the snapshot doing its
 * job. Everything else `setup` writes is a document meant to stay current.
 */
function isCompared(file: { path: string }): boolean {
  return file.path.endsWith('.md') && basename(file.path) !== 'PART0-PROMPT.md';
}

/**
 * The per-repo plan `contextFor` in `commands/setup.ts` gets from the `discover` phase, read
 * back instead. The three per-target facts `renderRepoConfig` recorded come from there; the two
 * per-target answers (`proofLine`, `offLimits`) were hashed and saved with the shared ones, so
 * they are already in `config.answers` and `targetAnswers` lays the same values back over. The
 * scan is re-run on the directory, resolved first so its `name` is the directory's and not `.`.
 * Where the record says nothing about mode — a file a person wrote by hand — `untracked` is the
 * guess whose planned filenames nobody hand-writes, so a wrong guess compares nothing.
 */
async function recordedPlan(root: string, config: Config): Promise<RepoPlan> {
  const path = resolve(root);
  const kind = (await isGitRepo(path)) ? 'git' : 'folder';
  const [scan, workProfile, trackMode] = await Promise.all([
    scanRepo(path, kind),
    readWorkProfile(root),
    readRecordedTrackMode(root),
  ]);
  return {
    scan,
    workProfile: workProfile ?? 'ledger',
    trackMode: trackMode ?? (kind === 'folder' ? 'n/a' : 'untracked'),
    archiveHome: config.archiveHome,
    owned: true,
    proofLine: String(config.answers.proofLine ?? '').trim(),
    offLimits: String(config.answers.offLimits ?? '').trim(),
  };
}
