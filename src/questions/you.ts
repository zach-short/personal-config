import type { Question } from '../lib/types.ts';

/**
 * Phase 1 — what is true of *you*, across every repo. These become files in
 * `~/.claude/rules/`, so they are asked once and reused everywhere.
 */
export const YOU_QUESTIONS: Question[] = [
  {
    id: 'commit-policy',
    phase: 'you',
    kind: 'select',
    ask: 'Who runs `git commit` — you, or the agent?',
    configKey: 'commitPolicy',
    readMore: 'commit-policy',
    options: [
      {
        value: 'print-blocks',
        label: 'Only me — the agent prints the commands',
        example: 'Agent ends with `git add src/foo.ts` then `git commit -m "fix null case"`',
        recommended: true,
      },
      {
        value: 'agent-commits',
        label: 'The agent may commit, never push',
        example: 'Agent commits each green slice; you review the log and push',
        recommended: false,
      },
      {
        value: 'no-rule',
        label: 'No rule — leave it to the agent',
        example: 'Nothing is written; the agent does whatever it would do by default',
        recommended: false,
      },
    ],
  },
  {
    id: 'attribution',
    phase: 'you',
    kind: 'select',
    ask: 'Should agent commits say an agent wrote them?',
    configKey: 'attribution',
    readMore: 'attribution',
    options: [
      {
        value: 'none',
        label: 'No trailers',
        example: 'A plain `fix: handle null timezone` and nothing else',
        recommended: true,
      },
      {
        value: 'co-authored',
        label: 'Add a `Co-Authored-By:` trailer',
        example: '`Co-Authored-By: Claude <noreply@anthropic.com>` on every agent commit',
        recommended: false,
      },
    ],
  },
  {
    id: 'model-deep',
    phase: 'you',
    kind: 'text',
    ask: 'Which model is your Deep tier — for work whose mistakes pass every gate?',
    configKey: 'models.deep',
    readMore: 'model-tiers',
    placeholder: 'e.g. a top reasoning model, named as your harness names it',
  },
  {
    id: 'model-default',
    phase: 'you',
    kind: 'text',
    ask: 'Which model is your Default tier — everything whose failure is loud?',
    configKey: 'models.default',
    readMore: 'model-tiers',
    placeholder: 'e.g. your everyday model',
  },
  {
    id: 'model-fast',
    phase: 'you',
    kind: 'text',
    ask: 'Which model is your Mechanical tier — sweeps, renames, doc reconciliation?',
    configKey: 'models.fast',
    readMore: 'model-tiers',
    placeholder: 'e.g. your fastest model',
  },
  {
    id: 'model-routing',
    phase: 'you',
    kind: 'select',
    ask: 'What should a session do when a task names a model it is not running on?',
    configKey: 'modelRouting',
    readMore: 'model-routing',
    options: [
      {
        value: 'delegate-or-stop',
        label: 'Delegate to that model, or stop and hand off',
        example: 'Board row says Deep, session is Default → it spawns a Deep subagent',
        recommended: true,
      },
      {
        value: 'warn-only',
        label: 'Say so in one line, then carry on',
        example: 'Session notes the mismatch and does the work anyway',
        recommended: false,
      },
      {
        value: 'skip',
        label: 'No rule — I do not tag tasks with models',
        example: 'Nothing is written; useful if you never use a board',
        recommended: false,
      },
    ],
  },
  {
    id: 'docs-mcp',
    phase: 'you',
    kind: 'text',
    ask: 'Which docs-lookup tool should be preferred over training memory for library APIs?',
    configKey: 'docsMcp',
    readMore: 'docs-lookup',
    placeholder: 'a connected docs MCP, or "none" to skip this rule',
  },
  {
    id: 'hooks',
    phase: 'you',
    kind: 'select',
    ask: 'Should any of this be enforced by a hook, not just written as a rule?',
    configKey: 'hooks',
    readMore: 'hooks',
    options: [
      {
        value: 'commit-guard',
        label: 'Yes — block `git commit`, `git push` and `git add -A`',
        example:
          'The agent tries `git commit`; the hook refuses and prints the two-block ritual',
        recommended: true,
      },
      {
        value: 'both',
        label: 'That, plus a session-start banner',
        example:
          'Every session opens with your ledger, your standard, and the top open board row',
      },
      {
        value: 'none',
        label: 'No hooks — rules only',
        example: 'Nothing is added to `~/.claude/settings.json`',
      },
    ],
  },
  {
    id: 'skills',
    phase: 'you',
    kind: 'select',
    ask: 'Should the four workflow skills be installed?',
    configKey: 'skills',
    readMore: 'skills',
    options: [
      {
        value: 'all',
        label: 'All four — /close-out, /scope, /passoff, /handoff',
        example: 'You type `/close-out`; the agent runs the whole end-of-work ritual',
        recommended: true,
      },
      {
        value: 'none',
        label: 'None',
        example: 'Nothing is written to `~/.claude/skills/`',
      },
    ],
  },
  {
    id: 'keep-existing-global',
    phase: 'you',
    kind: 'select',
    ask: 'Your `~/.claude` already has rules and hooks — what should happen to them?',
    configKey: 'keepExistingGlobal',
    readMore: 'existing-global-config',
    options: [
      {
        value: 'keep',
        label: 'Keep every one, untouched',
        example: 'New rules land beside them as separate files in `~/.claude/rules/`',
        recommended: true,
      },
      {
        value: 'report',
        label: 'Keep them, and list any that cover the same ground',
        example: 'A `CLAUDE.md` "# Commits" section is reported so you can delete it yourself',
        recommended: false,
      },
    ],
  },
];
