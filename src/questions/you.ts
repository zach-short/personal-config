import type { Question } from '../lib/types.ts';

/**
 * Phase 1 — what is true of *you*, across every repo. These become files in
 * `~/.claude/rules/`, so they are asked once and reused everywhere.
 *
 * The first three are the track axes (setup-tracks `DESIGN.md` D1, D4, D13): what kind of work
 * this is, how much of the method you want, and whether git is involved. They are three
 * questions rather than one combined setup name so that every combination stays reachable —
 * including the programmer who wants the light config — and they sit here rather than in a
 * phase of their own because work kind and git use are exactly what `you` means: facts about
 * the person that hold across every target. A new `Phase` value would also be a runtime
 * `undefined` read on the site, which reads `PHASE_COPY[question.phase]` unchecked.
 *
 * The recommended option of each is the **first**, and is the one that preserves the behaviour
 * at 0.2.6 (DIAL-1/2/3). Nothing reads these answers yet — the renderers are their own board
 * items — so a run that takes the recommended three writes exactly what it wrote before.
 */
export const YOU_QUESTIONS: Question[] = [
  {
    id: 'work-kind',
    phase: 'you',
    kind: 'select',
    ask: 'Is this for code, or for other kinds of work?',
    configKey: 'workKind',
    readMore: 'work-kind',
    options: [
      {
        value: 'code',
        label: 'Code',
        example: 'repos, builds, pull requests',
        recommended: true,
      },
      {
        value: 'non-code',
        label: 'Other work',
        example: 'writing, research, teaching, accounting, ops',
        recommended: false,
      },
    ],
  },
  {
    id: 'config-weight',
    phase: 'you',
    kind: 'select',
    ask: 'Do you want the whole method, or a lighter setup?',
    configKey: 'configWeight',
    readMore: 'config-weight',
    options: [
      {
        value: 'full',
        label: 'The whole method',
        example: 'every document, every skill',
        recommended: true,
      },
      {
        value: 'light',
        label: 'Lighter',
        example: 'fewer files, less to read at the start of each session',
        recommended: false,
      },
    ],
  },
  {
    id: 'uses-git',
    phase: 'you',
    kind: 'select',
    ask: 'Do you keep this work in git?',
    configKey: 'usesGit',
    readMore: 'uses-git',
    options: [
      // D20 upholds D2 — two values, no third — and puts what a third value would have said
      // into the labels instead: "Yes, in git repos" / "No, just folders" is a pair a person
      // who keeps one repo *and* one loose folder can answer neither half of truthfully
      // (setup-tracks `DESIGN.md` G29). After item 54, `yes` means *git is in play somewhere*
      // and the target's kind decides where, so "some or all" is not a hedge — it is what the
      // value has meant since `targetUsesGit` (G27). Settled copy, §10.5: the warm variant.
      {
        value: 'yes',
        label: 'Yes, some or all of it',
        example: 'commits and history, in at least one place',
        recommended: true,
      },
      {
        value: 'no',
        label: 'No, none of it',
        example: 'the files live on disk and that’s it',
        recommended: false,
      },
    ],
  },
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
        example: 'Agent ends with `git add src/foo.ts` then `git commit src/foo.ts -m "..."`',
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
    // Asked wherever an answer reaches a rendered file (PASSOFF item 56, corrected by item 62).
    // `commits.md` goes to code work kept in git (`src/render/rules.ts:24`, gated on
    // `code && usesGit`), but `commitRuleLine` (`src/render/context.ts:167`) is read by
    // `src/render/repo.ts:179`, `src/render/standard.ts:109` and `src/render/short-standard.ts:59`
    // for **any** git target — non-code included. Gating this on `code` too silently defaulted
    // every non-code-in-git run to `print-blocks` without ever asking, which is a real loss of
    // choice (HANDOFF 67 accepted it as a known tradeoff; item 62 reverses that acceptance).
    // `isNot: 'no'`, never `is: 'yes'`: a third value meaning "some of it" would otherwise stop
    // asking the git questions of the people who most need them.
    when: { key: 'usesGit', isNot: 'no' },
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
    // Read only inside `commitRule` (`src/render/rules.ts`), so it rides on exactly the
    // condition that writes the rule: an attribution answer with no commit rule to carry it
    // has nowhere to be written.
    when: {
      all: [
        { key: 'workKind', is: 'code' },
        { key: 'usesGit', isNot: 'no' },
      ],
    },
  },
  {
    id: 'model-deep',
    phase: 'you',
    kind: 'text',
    ask: 'Which model is your Deep tier — for work whose mistakes pass every gate?',
    configKey: 'models.deep',
    readMore: 'model-tiers',
    placeholder: 'e.g. a top reasoning model, named as your harness names it',
    // Deep and Mechanical are rendered in two places and both are the full weight: the full
    // standard's `MODEL_DEEP`/`MODEL_FAST` placeholders (`src/render/standard.ts`) and the tier
    // table in `model-routing.md`, which `src/render/rules.ts` writes whenever the weight is
    // full — **non-code included**. So the condition is the weight alone and not the short-track
    // negation (`code && full`): the tighter conjunction would stop asking a non-code, full
    // person for tiers their own `model-routing.md` still prints, and the table would render
    // `<unset>`. The short standard reads `models.default` alone (D6), which is why that
    // question keeps no condition while these two take one (PASSOFF item 56).
    when: { key: 'configWeight', is: 'full' },
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
    // The other half of the tier table; see `model-deep` above for why the weight alone.
    when: { key: 'configWeight', is: 'full' },
  },
  {
    id: 'model-light-enabled',
    phase: 'you',
    kind: 'select',
    ask: 'Do you want a narrow tier below Mechanical, for work where you can tell immediately if it went wrong?',
    configKey: 'modelLightEnabled',
    readMore: 'model-tiers',
    options: [
      {
        value: 'no',
        label: 'No — three tiers is enough',
        example: 'Mechanical keeps the whole mechanical band, as it does today',
        recommended: true,
      },
      {
        value: 'yes',
        label: 'Yes — add a fourth tier below Mechanical',
        example: 'A read-only report or one checked transform goes below Mechanical',
        recommended: false,
      },
    ],
    // The same gate as `model-deep`/`model-fast`, for the same reason given there: the only thing
    // this answer changes is the tier table in `model-routing.md`, which `src/render/rules.ts`
    // writes on the full weight alone. A light setup has no table for a fourth row to appear in,
    // so the question has no referent there. `no` is recommended because the tier is opt-in
    // (`model-tiers` DESIGN D1) — everyone content with three keeps today's three-row table and
    // is never asked for a fourth model name.
    when: { key: 'configWeight', is: 'full' },
  },
  {
    id: 'model-light',
    phase: 'you',
    kind: 'text',
    ask: 'Which model is your Light tier — for work where you can tell immediately if it went wrong?',
    configKey: 'models.light',
    readMore: 'model-tiers',
    placeholder: 'e.g. your smallest, quickest model',
    // Both conditions, not the opt-in alone: the weight gates the table this name is rendered
    // into, and the opt-in gates whether the row exists at all. Gating on the opt-in by itself
    // would take a model name on a light setup that writes no `model-routing.md` to put it in.
    when: {
      all: [
        { key: 'configWeight', is: 'full' },
        { key: 'modelLightEnabled', is: 'yes' },
      ],
    },
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
        example:
          'Row says Deep, session is Default → a review goes to a Deep subagent; a build is handed off',
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
    // `src/render/rules.ts` writes `model-routing.md` on the full weight and on no other
    // condition — D6 cuts it from a light setup, where its advice to delegate to a subagent is
    // the most expensive thing on the page. Cut with the other six by the owner's call on
    // 2026-09-22, and gated on the weight alone for the same reason as the tiers above: the
    // rule is domain-neutral and a non-code, full run still gets it.
    when: { key: 'configWeight', is: 'full' },
  },
  {
    id: 'docs-mcp',
    phase: 'you',
    kind: 'text',
    ask: 'Which docs-lookup tool should be preferred over training memory for library APIs?',
    configKey: 'docsMcp',
    readMore: 'docs-lookup',
    placeholder: 'a connected docs MCP, or "none" to skip this rule',
    // `docs-lookup.md` is entirely library APIs and goes to code work only (`src/render/rules.ts`,
    // G4). Weight and git do not gate it: a light code setup still gets the rule.
    when: { key: 'workKind', is: 'code' },
  },
  {
    id: 'hooks',
    phase: 'you',
    kind: 'select',
    ask: 'Should any of this be enforced by a hook, not just written as a rule?',
    configKey: 'hooks',
    readMore: 'hooks',
    options: [
      // The option installs two guards, not one: the commit guard where the target is a repo,
      // and the delete guard — `rm`, `rmdir`, `unlink` — for non-code work on either weight
      // (D25, `src/render/hooks.ts`). Its old label named three git commands to a person who
      // had just answered that they keep none of their work in git (G29), so it named the one
      // guard they would never get. Settled copy, §10.5: the plain variant. The value stays
      // `commit-guard`; renaming it would break every stored profile that carries it (DIAL-7).
      {
        value: 'commit-guard',
        label: 'Yes — block the commands that can’t be undone',
        example:
          '`git commit` and `git push` in a repo, `rm` for other work; the hook refuses and says what to do instead',
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
    // Sits beside `hooks` because both answers end up in the same `~/.claude/settings.json`.
    // It is a question rather than a constant for the reason every other default here is one:
    // an output style changes how an agent behaves in every session, and a behaviour change
    // with no question behind it has no long form and no argument against it either.
    // `check-first` is recommended because it is what 0.2.6 does — it writes no output style
    // at all — not because it is the better of the two.
    id: 'output-style',
    phase: 'you',
    kind: 'select',
    ask: 'How should your agent handle unclear decisions?',
    configKey: 'outputStyle',
    readMore: 'output-style',
    options: [
      {
        value: 'check-first',
        label: 'Check first',
        example: 'pauses on anything unclear',
        recommended: true,
      },
      {
        value: 'proactive',
        label: 'Act',
        example: 'makes reasonable calls and keeps going',
        recommended: false,
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
