import { DEFAULT_DOC_NAMES } from '../lib/repo-config.ts';
import type { StampParts } from '../lib/stamp.ts';
import { withStamp } from '../lib/stamp.ts';
import type { Answers, Config, PlannedFile, RepoPlan, WorkProfile } from '../lib/types.ts';

export type RenderContext = {
  config: Config;
  answers: Answers;
  stamp: StampParts;
  date: string;
  repo: RepoPlan | null;
};

export function answer(ctx: RenderContext, key: string, fallback = ''): string {
  const value = ctx.answers[key];
  return typeof value === 'string' ? value : fallback;
}

/** Every planned file goes through here, so nothing can be written without a stamp. */
export function planned(
  ctx: RenderContext,
  path: string,
  label: string,
  contents: string,
  options: { extension?: string; strategy?: PlannedFile['strategy']; stamp?: boolean } = {},
): PlannedFile {
  const { extension = 'md', strategy = 'overwrite', stamp = true } = options;
  return {
    path,
    label,
    strategy,
    mode: modeFor(extension),
    contents: stamp ? withStamp(contents, ctx.stamp, extension) : contents,
  };
}

/**
 * Executability is derived from the extension rather than asked for at the call site, because
 * every shell script this tool writes is written to be run: they are hook scripts, and
 * `settings.json` registers them as `command` entries invoked by bare path. Without the bit
 * those entries exit 126 and the harness reports a failed hook, which is why the commit guard
 * and the session banner had never fired for anyone who installed them (found 2026-09-17).
 *
 * Keyed on `sh` and not on the comment style, which `yml` shares with it: a rendered `.yml` is
 * data and has no business being executable.
 */
function modeFor(extension: string): number | undefined {
  return extension === 'sh' ? 0o755 : undefined;
}

/**
 * A file a command changes *in place* rather than generates — the board row `passoff claim`
 * marks, the line `archive` adds to an index. It carries no stamp, and that is the point: a
 * stamp claims this tool produced the file, and re-stamping an edited one would also refresh the
 * config hash `doctor` compares against, hiding drift in a file nothing re-rendered. A board a
 * person wrote by hand would acquire a stamp it never earned.
 *
 * It still enters the plan through this module, so an edit gets the same preview, the same
 * backup and the same `undo` as a generated file.
 */
export function edit(path: string, label: string, contents: string): PlannedFile {
  return { path, label, contents, strategy: 'overwrite' };
}

/**
 * The three track axes (setup-tracks `DESIGN.md` D1, D4), read as answers and never as a
 * hardcoded name. An absent answer reads as the behaviour at 0.2.5 — `code`, `full`, git —
 * which is DIAL-7's rule restated at the one place a renderer meets it: a profile stored before
 * the questions existed must render exactly what it rendered then.
 */
export type Track = {
  workKind: 'code' | 'non-code';
  weight: 'full' | 'light';
  usesGit: boolean;
};

export function trackOf(ctx: RenderContext): Track {
  return {
    workKind: answer(ctx, 'workKind', 'code') === 'non-code' ? 'non-code' : 'code',
    weight: answer(ctx, 'configWeight', 'full') === 'light' ? 'light' : 'full',
    usesGit: answer(ctx, 'usesGit', 'yes') !== 'no',
  };
}

/**
 * D3 and D6 share one predicate. Non-code work gets the short standard because the long one is
 * written for a programmer even where it is domain-neutral (D3); a light setup gets it because
 * the long one costs 40–80k of context to adopt (D6). Either answer alone is enough, and the
 * shorter router goes with it: the full router's first line sends the reader to a code standard,
 * and its sections are stack, architecture and gate commands.
 */
export function isShortTrack(ctx: RenderContext): boolean {
  const track = trackOf(ctx);
  return track.workKind === 'non-code' || track.weight === 'light';
}

/** D9: light writes a ledger and no board. Non-code + full keeps both (§3.1). */
export function hasBoard(ctx: RenderContext): boolean {
  return trackOf(ctx).weight === 'full';
}

/**
 * The shape the work record takes. Profile P — one folder per effort, `SCOPE → DESIGN → PLAN →
 * RUNTIME-PASS` behind two gates — is machinery the short standard does not describe and a
 * ≤200-line document could not carry, so on the short track the answer `folders` renders as a
 * ledger. The alternative was a `docs/incomplete/README.md` citing "Part 2.2" of a standard with
 * no Part 2.2: a document that renders clean and is wrong for its reader. A build-level call
 * taken in item 44 (2026-09-19), reversible here; the honest fix is to stop asking
 * `work-profile` on this track, which is a catalog change and not a renderer's.
 */
export function workRecordShape(ctx: RenderContext): WorkProfile {
  if (isShortTrack(ctx)) return 'ledger';
  return ctx.repo?.workProfile ?? 'ledger';
}

/** The ledger and board filenames, honouring an adopted file's name (standard §0.2). */
export function ledgerFile(ctx: RenderContext): string {
  return ctx.repo?.scan.ledgerDoc ?? DEFAULT_DOC_NAMES.ledger;
}

export function boardFile(ctx: RenderContext): string {
  return ctx.repo?.scan.boardDoc ?? DEFAULT_DOC_NAMES.board;
}

/**
 * Untracked is the one mode with filenames of its own; `tracked` and a folder's `n/a` (DIAL-11)
 * both take the plain names. A folder has no `.git`, so nothing about it is untracked — it is
 * simply the person's own, which is why `planRepo` records it `owned` — and until 2026-09-19
 * these tested `=== 'tracked'`, which planned a `CLAUDE.local.md` and an `AGENT-PRACTICES.local.md`
 * for a directory that is nobody else's (HANDOFF 49, left owed to item 44).
 */
export function routerFile(ctx: RenderContext): string {
  return ctx.repo?.trackMode === 'untracked' ? 'CLAUDE.local.md' : 'CLAUDE.md';
}

export function standardPath(ctx: RenderContext): string {
  return ctx.repo?.trackMode === 'untracked'
    ? 'AGENT-PRACTICES.local.md'
    : 'docs/AGENT-PRACTICES.md';
}

export function conventionsPath(language: string): string {
  return `docs/conventions-${language}.md`;
}

export function projectName(ctx: RenderContext): string {
  return ctx.repo?.scan.name ?? 'your project';
}

/** The proof line (D7), in the owner's words; empty until they have written one. */
export function proofLine(ctx: RenderContext): string {
  return answer(ctx, 'proofLine').trim();
}

/** What the agent must not read or copy (D23); empty is a complete answer, not a missing one. */
export function offLimits(ctx: RenderContext): string {
  return answer(ctx, 'offLimits').trim();
}

/**
 * The answers one target renders from: the shared `you` and `practices` answers, plus what was
 * asked once for this target. The proof line is asked in the `discover` phase into a per-target
 * map and carried on the `RepoPlan`; nothing copied it back, so at 0.3.0 it was asked and then
 * dropped before any renderer or the saved `.personal-config.json` saw it (found 2026-09-19).
 * Laid over the shared answers here, it is hashed with them and saved with them, so `doctor`
 * rebuilds the same expectation from the repo's own record.
 *
 * `offLimits` (D23) takes the same trip for the same reason, added 2026-09-22 by following that
 * bug's path line by line rather than by finding it again.
 */
export function targetAnswers(answers: Answers, repo: RepoPlan | null): Answers {
  return repo ? { ...answers, proofLine: repo.proofLine, offLimits: repo.offLimits } : answers;
}

export function commitRuleLine(answers: Answers): string {
  const policy = answers.commitPolicy;
  if (policy === 'agent-commits')
    return 'Commit in small slices; never `git push`, never `git add -A`.';
  if (policy === 'no-rule') return '';
  return 'Never run `git commit`, `git push`, `git add -A` or `git add .` — print the two blocks instead.';
}

export type { Config, RepoPlan };
