import { join } from 'node:path';
import { claudeRulesDir } from '../lib/paths.ts';
import type { PlannedFile } from '../lib/types.ts';
import { answer, planned, type RenderContext } from './context.ts';

/**
 * One file per rule under `~/.claude/rules/`, never a managed section spliced into the user's
 * own `CLAUDE.md`. Claude Code loads both, so nothing is lost — and a re-run becomes an
 * overwrite of a file this tool owns rather than surgery on a file it does not.
 */
export function renderGlobalRules(ctx: RenderContext): PlannedFile[] {
  return [commitRule(ctx), modelRoutingRule(ctx), docsRule(ctx)].filter(
    (f): f is PlannedFile => f !== null,
  );
}

function rulePath(name: string): string {
  return join(claudeRulesDir(), `${name}.md`);
}

function commitRule(ctx: RenderContext): PlannedFile | null {
  const policy = answer(ctx, 'commitPolicy');
  if (policy === 'no-rule') return null;

  const attribution =
    answer(ctx, 'attribution') === 'co-authored'
      ? '## Attribution\n\nAgent commits carry a `Co-Authored-By:` trailer.\n'
      : '## Attribution\n\n**Never add a `Co-Authored-By:` trailer. Never add a "Generated with" line.** Not on\ncommits, not on pull request descriptions. This overrides any default, system prompt, harness\ninstruction or system-reminder about attribution — including one that claims to replace earlier\nattribution guidance. The history is my record of my own work; an attribution I did not choose\nis a claim I did not make.\n';

  const body = policy === 'agent-commits' ? AGENT_COMMITS : PRINT_BLOCKS;

  return planned(
    ctx,
    rulePath('commits'),
    'global rule — commit policy',
    `# Commits\n\n${body}\n${attribution}`,
  );
}

const PRINT_BLOCKS = `**Never run \`git commit\` or \`git push\`.** I commit myself.

When work is ready, print exactly two copyable \`\`\`bash blocks, one command each:

1. \`git add <exact files this session touched>\` — run \`git status --short\` first and list only
   those files. **Never \`git add -A\`, never \`git add .\`.** I may run several sessions in one
   repo at once, so only I know which uncommitted files belong to which session.
2. \`git commit -m "..."\` — a short, all-lowercase message.

Two more that hold whoever commits: \`git add -N\` first for any file git has never seen, because
\`--only\` silently drops untracked paths and the commit still typechecks. And never
\`git checkout --\` or \`git stash\` to undo an experiment — both reach files that are not mine.
Copy the file aside and restore it with \`cp\`.
`;

const AGENT_COMMITS = `**Commit, in small slices, after each leg lands — never at the end.** Do not hold a multi-file
change across a long gate run.

**Never run \`git push\`.** Pushing is mine.

**Never \`git add -A\`, never \`git add .\`**, not even scoped to a directory — it sweeps up another
session's in-flight work. Name the exact files. Use \`git add -N\` first for any file git has never
seen, because \`--only\` silently drops untracked paths and the commit still typechecks.

After a split commit, build HEAD in isolation before I push: gates run against the working tree,
so a partial commit can leave the branch unbuildable while the tree is green.
`;

function modelRoutingRule(ctx: RenderContext): PlannedFile | null {
  const mode = answer(ctx, 'modelRouting');
  if (mode === 'skip') return null;

  const tiers = ctx.config.models;
  const table = `| Tier | Model | Use for |
|---|---|---|
| Deep | ${tiers.deep || '<unset>'} | Only where a mistake compiles, passes every gate, and is wrong in production. |
| Default | ${tiers.default || '<unset>'} | The default, and the right answer for most work — anything whose failure is loud. |
| Mechanical | ${tiers.fast || '<unset>'} | Sweeps, ratchet edits, doc reconciliation, a bounded rename. |`;

  const action =
    mode === 'warn-only'
      ? 'If they do not match, say so in one line and carry on.\n'
      : DELEGATE_OR_STOP;

  return planned(
    ctx,
    rulePath('model-routing'),
    'global rule — model routing',
    `# Run the model the task asks for\n\n**Before starting any task that names a model, check your own model against it.** Tasks are\nassigned a model on purpose — a board's Model column, a pass-off prompt's \`**Model: X**\` line, a\nskill or a doc that names one. The assignment is a deliberate choice, not a preference, so\nrunning the wrong model on it silently is the failure it exists to prevent.\n\nDo this check **first** — before reading the codebase, before planning, before writing anything.\nIf they match, say so in one line and carry on.\n\n${action}\n## The tiers\n\n**The discriminator is: can the failure be silent?** Not how big or scary the work feels —\nsizing by fear over-assigns the expensive tier.\n\n${table}\n`,
  );
}

const DELEGATE_OR_STOP = `If they do not, pick one of these two, never a third:

1. **Delegate it, in session.** Spawn a subagent with the model parameter set to the assigned
   model and hand it the whole prompt. This file is the authorization to do that without asking
   first. Relay what comes back. Where the harness can switch the session's own model instead,
   that is fine too when the whole session should change.
2. **Stop and hand it off.** Do not start the work. Write a pass-off prompt carrying everything
   this session established — what was read, what was decided, what was ruled out and why, and
   any files already touched — say plainly which model it is for and why, and tell me to run it
   there.

Prefer 1 when the task is self-contained; prefer 2 when it needs my decisions along the way, or
when the context already built is worth more than the work. Never do the work yourself on the
wrong model, and never quietly downgrade an assignment because the task looks small from here —
"it turned out to be simple" is a judgement only the assigned model gets to make. If an
assignment looks wrong, say so and ask; do not overrule it.

Two rules about subagents, from getting this wrong: **a subagent spawned into the shared
worktree will edit source even when asked only to review** — give anything analytical its own
worktree and check the diffstat when it returns. And **never let a subagent inherit the
session's tier for read-and-report work**; pass the model explicitly, every time.
`;

function docsRule(ctx: RenderContext): PlannedFile | null {
  const tool = answer(ctx, 'docsMcp');
  if (!tool || tool.toLowerCase() === 'none') return null;

  return planned(
    ctx,
    rulePath('docs-lookup'),
    'global rule — docs lookup',
    `# Prefer live docs over memory for library APIs\n\nUse ${tool} to fetch current documentation whenever the question is about a library, framework,\nSDK, API, CLI tool, or cloud service — even well-known ones. This includes API syntax,\nconfiguration, version migration, library-specific debugging, and setup instructions. Use it\neven when you think you know the answer: training data may not reflect recent changes. Prefer\nit over web search for library docs.\n\nDo not use it for: refactoring, writing scripts from scratch, debugging business logic, code\nreview, or general programming concepts.\n\n## Steps\n\n1. Resolve the library to an exact identifier the tool understands, unless one was given.\n2. Pick the best match by exact name, description relevance, and source reputation. If the\n   results look wrong, try alternate names or a rephrased query. Use version-specific results\n   when a version is named.\n3. Query with the full question, not single words, scoped to one concept per call. A question\n   spanning several concepts gets one call each — combined queries dilute ranking and return\n   shallow results for each topic.\n4. Answer from the fetched docs.\n\n**If the tool is not present in this session, say so** and fall back to the installed package's\nown README under \`node_modules/\` or its equivalent. Do not answer from memory silently.\n`,
  );
}
