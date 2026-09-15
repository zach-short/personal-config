# Standard changelog

The version of `AGENT-PRACTICES.boilerplate.md`, which is versioned separately from the CLI
that renders it (see the root `CHANGELOG.md` for that). An adapted copy in another repo carries
the version it was adapted from; `personal-config doctor` reports a copy whose stamp is older
than `standard/VERSION`.

## 1.0.1 — 2026-09-15

Corrections. No rule was added, removed, or changed in substance — four places where the file
contradicted itself or its own enforcement.

- **Profile P’s Stage 2 heading** is now "What exists, verified `<date>`". The old wording
  carried the word R1’s own test greps for, so every adapted copy reported an R1 finding against
  the line that prescribes the heading.
- **The step-log shape** in Profile L is now `**N. Title.** Done <date>`, matching every ledger
  the templates and examples write, and the `step-numbers` rule that reads them. A log written to
  the old spelling was invisible to `doctor`.
- **Part 11’s commit ritual** names the files in its second block, so it no longer contradicts
  Part 6, which requires `--only` for anyone committing under a shared index.
- **Appendix A’s `{{ARCHIVE_HOME}}`** admits an in-tree folder such as `docs/archive/`, and says
  the slot is always a path — the word `none` rendered as `none/<slug>/` in Parts 2 and 7.

## 1.0.0 — 2026-09-15

- Imported unchanged from ezhomesteading's 2026-09-14 revision.
