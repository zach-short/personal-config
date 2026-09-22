import { type RenderContext, trackOf } from './context.ts';

/**
 * **The person's answer governs the global layer; the target's kind governs the target.**
 *
 * `usesGit` answers "will you use this config in git repos at all?" (setup-tracks `DESIGN.md`
 * D4) — a fact about the person, true of them while being false of one of their targets. D5
 * gave `RepoScan` a `kind` so a renderer could tell which target it is looking at, and four
 * per-target sites went on reading the person's answer anyway: a plain folder belonging to
 * somebody who also keeps repos was handed a rule against `git commit` and a standard whose
 * Part 0 was never told to cut the worktree part (PASSOFF item 54, reproduced 2026-09-22).
 *
 * Both halves are load-bearing. A folder never gets git content, because it has no `.git` to
 * honour the content — that half is the bug. A repo whose owner answered `no` does not get it
 * either, because an answer given is not overruled by what the filesystem happens to show; the
 * person's `no` is the one place they can say "not here either".
 *
 * `trackOf` already reads the answer as `!== 'no'` rather than `=== 'yes'`, which is the same
 * `isNot` shape `track-mode`'s `when` spec uses, so a third `usesGit` answer (item 58 amends the
 * design first) reads as "not no" instead of silently suppressing everything.
 *
 * It lives in its own file rather than beside `trackOf` because `src/render/context.ts` is
 * item 44's, and one rule with two homes is the drift this helper exists to prevent.
 *
 * **Not every `usesGit` read is this one.** `renderGlobalRules` and `renderSkills` write to
 * `~/.claude/`, where there is no target and the person's answer is the only input there could
 * be. And `renderIgnore` keeps its own spelling — it tests the recorded `trackMode === 'n/a'`,
 * which is DIAL-11's per-target claim rather than this one, and is the site that has been
 * correct all along.
 */
export function targetUsesGit(ctx: RenderContext): boolean {
  return ctx.repo?.scan.kind === 'git' && trackOf(ctx).usesGit;
}
