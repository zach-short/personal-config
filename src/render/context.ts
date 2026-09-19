import { DEFAULT_DOC_NAMES } from '../lib/repo-config.ts';
import type { StampParts } from '../lib/stamp.ts';
import { withStamp } from '../lib/stamp.ts';
import type { Answers, Config, PlannedFile, RepoPlan } from '../lib/types.ts';

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

/** The ledger and board filenames, honouring an adopted file's name (standard §0.2). */
export function ledgerFile(ctx: RenderContext): string {
  return ctx.repo?.scan.ledgerDoc ?? DEFAULT_DOC_NAMES.ledger;
}

export function boardFile(ctx: RenderContext): string {
  return ctx.repo?.scan.boardDoc ?? DEFAULT_DOC_NAMES.board;
}

export function routerFile(ctx: RenderContext): string {
  return ctx.repo?.trackMode === 'tracked' ? 'CLAUDE.md' : 'CLAUDE.local.md';
}

export function standardPath(ctx: RenderContext): string {
  return ctx.repo?.trackMode === 'tracked'
    ? 'docs/AGENT-PRACTICES.md'
    : 'AGENT-PRACTICES.local.md';
}

export function conventionsPath(language: string): string {
  return `docs/conventions-${language}.md`;
}

export function projectName(ctx: RenderContext): string {
  return ctx.repo?.scan.name ?? 'your project';
}

export function commitRuleLine(answers: Answers): string {
  const policy = answers.commitPolicy;
  if (policy === 'agent-commits')
    return 'Commit in small slices; never `git push`, never `git add -A`.';
  if (policy === 'no-rule') return '';
  return 'Never run `git commit`, `git push`, `git add -A` or `git add .` — print the two blocks instead.';
}

export type { Config, RepoPlan };
