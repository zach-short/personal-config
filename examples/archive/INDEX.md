<!-- personal-config v0.1.0 · 2026-09-15 · config e3a91f04 · standard v1.0.0 -->
# archive-leaflet — index

Docs pulled out of the `leaflet` repo when they closed. One folder per topic, flat, no nesting.
**This is a map, not a copy:** status lives in the files themselves and can drift out of date
here. What an archive owes a reader is accurate pointers, not a uniform shape.

> **This is an example.** `leaflet` is a fictional repo. Copy the shape, not the facts.

Legend: ✅ closed/shipped · 🟡 built, not runtime-verified · ⚪ planned/open · 🔍 audit (findings only)

## Closed

- **outbox-click-counting/** ✅ — `DESIGN.md` and `RUNTIME-PASS.md` for moving click counting off
  the redirect path onto an outbox plus a sweep. Closed 2026-09-05, last commit `7c21ab9`,
  verified 2026-09-05. The decision it records is still live and is restated in `HANDOFF.md`
  under Settled; **the backpressure question it deliberately left open is board item 1.**

- **rate-limiting-audit/** ✅🔍 — findings only, no code. Enumerated every path that can be
  called without authentication and what limits each one has. Closed 2026-09-08, last commit
  `e4d0f31`, verified 2026-09-08. Its one live consequence — that the redirect path is
  deliberately unlimited — is board item 4, `SETTLED AS NO`, with the reason.

## Standing rules that outlived their doc

- **The redirect path makes exactly one database read.** From `outbox-click-counting/`. It is
  the reason counting is asynchronous at all, and it is the kind of rule that compiles fine when
  broken — a second query there is a latency regression no gate will catch. Restated as an
  invariant in `HANDOFF.md` so it is findable without opening the archive.
