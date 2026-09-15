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
    contents: stamp ? withStamp(contents, ctx.stamp, extension) : contents,
  };
}

/** The ledger and board filenames, honouring an existing file's name (standard §0.2). */
export function ledgerFile(ctx: RenderContext): string {
  return ctx.repo?.scan.existingDocs.includes('HANDOFF.md') ? 'HANDOFF.md' : 'HANDOFF.md';
}

export function boardFile(): string {
  return 'PASSOFF.md';
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
