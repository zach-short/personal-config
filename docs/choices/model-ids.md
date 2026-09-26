# Model IDs for tier ceilings

When you set a tier ceiling on a repo, this tool asks which model ID represents each tier in your
setup. This is asked once per person and reused across all capped repos.

## Why model IDs matter

Model IDs control what the Agent tool, the model picker, and Claude Code accept or reject. A
ceiling on "Default" in the `availableModels` list means:

- Family names like `opus` match every Opus version.
- Version prefixes like `claude-opus-5` match Opus 5 and later versions.
- An exact model like `claude-opus-5-5` turns off the family's wildcard and allows only that
  version.

If you pick "sonnet" for your Mechanical tier, the ceiling allows Sonnet 5.0, 5.1, and any
future Sonnet version. If you pick `claude-sonnet-5`, only that exact version is allowed.

## The options

### Family names (recommended)

- **claude-opus** (matches Opus 4, 5, 5.5, future versions)
- **claude-sonnet** (matches Sonnet 4, 4.1, 5, future versions)
- **claude-haiku** (matches Haiku 3, 4, 4.5, future versions)
- **claude-fable** (matches Fable 5, 5.1, future versions)

Family names survive new releases. When Claude releases Opus 5.6, your ceiling on "opus" will
automatically include it.

**Best for:** People who want future model versions to work without reconfiguring.

### Exact versions

- **claude-opus-5-5** (exactly Opus 5.5, nothing else)
- **claude-sonnet-5** (exactly Sonnet 5, nothing else)
- **claude-haiku-4-5** (exactly Haiku 4.5, nothing else)
- **claude-fable-5-1** (exactly Fable 5.1, nothing else)

Exact versions freeze at that release and never match newer versions. They give you predictable
behavior across sessions.

**Best for:** Teams or workflows where consistency and predictability matter more than automatic
upgrades.

### Other — type it

If your setup uses a model not listed, type its ID exactly as Claude Code names it. Examples:

- `claude-opus-5` (prefix form)
- `gpt-4` (if using an OpenAI provider integration)
- A custom model ID from your organization's setup

**Best for:** Uncommon setups or local models.

## How to undo

Run setup again and pick a different model ID, or edit `.claude/settings.local.json` in the
affected repos directly.

## Related

- `tier-ceiling` — the per-repo ceiling that caps which tiers are available
- `model-tiers` — your personal configuration of Deep, Default, Mechanical, and Light models
