# Per-repo tier ceiling

Cap the most expensive model this repo may use. The ceiling is enforced by Claude Code's
`availableModels` setting in `.claude/settings.local.json`.

## Options

### Deep — no ceiling (the default)

This repo can run any of the models you configure. Work here is not constrained by expense or
model size. Choose this for unrestricted reasoning, for work where every tier is allowed, or for
repos where you want the full flexibility of your personal model assignments.

**What it writes:** No `.claude/settings.local.json` file. The repo inherits the full set of
available models from your personal configuration.

**Strongest argument against:** Unrestricted runs can be expensive, especially for reasoning-heavy
work on large codebases. If you want to ensure work here stays within budget, pick a lower
ceiling.

**How to undo:** Run setup again and select a different ceiling, or delete
`.claude/settings.local.json` from the repo if it exists.

### Default

Deep-tier work is delegated to subagents; operations beyond Default are capped. This is the most
common choice for production repositories where reasoning should be constrained but mechanical
work is still allowed.

A session running on the Default model will see Deep-tier tasks and delegate them via the Agent
tool to a subagent with full access. Work assigned as Default or Mechanical runs normally.

**What it writes:** `.claude/settings.local.json` with `availableModels` set to allow only
Default and Mechanical tiers. This ceiling applies to `/model`, `--model`, the model picker, and
the Agent tool's `model` parameter.

**Strongest argument against:** Some work that *could* run on Default takes longer or produces
worse results than running Deep. A ceiling trades time and quality for cost predictability.

**How to undo:** Run setup again and select a higher ceiling, or delete
`.claude/settings.local.json`.

### Mechanical

Only sweeps, renames, mechanical transforms, and read-only work. No reasoning tiers (Deep,
Default) are available. This is the strictest setting and is useful for repos where you want to
guarantee all work stays within the cheapest, most predictable tier.

A session running on the Mechanical model will delegate any Default or Deep work to a subagent.

**What it writes:** `.claude/settings.local.json` with `availableModels` set to allow only
Mechanical tier and Light (if enabled). This is the tightest cap.

**Strongest argument against:** Many real tasks genuinely need a higher reasoning tier. A
Mechanical-only ceiling will force frequent delegation and may not be practical for day-to-day
work on complex codebases.

**How to undo:** Run setup again and select a higher ceiling, or delete
`.claude/settings.local.json`.

---

## How the ceiling works

When you set a ceiling below Deep, this tool:

1. Asks you which model ID represents each allowed tier (e.g., which model runs at the Default
   level in your setup).
2. Writes `.claude/settings.local.json` with `availableModels` set to allow only that tier and
   any tiers below it.
3. Adds a clause to your repo's `CLAUDE.md` reminding sessions about the cap, but only if your
   `modelRouting` answer is `delegate-or-stop` (so the routing rule is actually in place).
4. Ensures `.claude/settings.local.json` is git-ignored so the cap doesn't spread to other people
   cloning the repo.

The cap is applied per-repository and is your personal budget choice, not part of the repo's
tracked policy. A stranger cloning the repo will not inherit it.

## Silent failures to watch for

- **Global settings override per-repo ceilings.** If your `~/.claude/settings.json` lists Deep
  models, it silently undoes every repo's cap (F2 in the design). `doctor` warns when this
  happens, but it is a silent failure in Claude Code itself.
- **Managed settings (organization-wide) replace the list outright.** An organization's managed
  settings take precedence and cannot be overridden by project or local settings. This tool
  cannot prevent that.

## Related

- `model-routing` — what to do when a task names a model your session is not running on
- `model-tiers` — your personal configuration of the Deep, Default, Mechanical, and (optionally)
  Light models
