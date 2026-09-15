# How code reaches the network or the database

## What this is

A rule in `docs/conventions-<lang>.md` — the per-language code standard an agent reads in full
before writing any code, and the file a reviewer checks a diff against — saying how application
code is allowed to reach the network or the database. It decides where a new API call goes on
the day it is written.

## The options

**One typed client; raw calls banned in app code.** *Recommended.*

*The defense.* One place to add auth, one place to handle a 401, one place where the response
shape is asserted. When the API changes, the typechecker tells you every call site. A bare
`fetch` in a component is an untyped boundary in the middle of the UI, and it is where the
`undefined is not an object` errors come from.

*The strongest argument against it.* It is a layer, and layers get in the way: one endpoint used
once now needs a client method, a type and a test. For a small app the wrapper can be more code
than the calls it wraps.

**A single agreed library, called directly.**

*The defense.* You get consistency — one caching model, one retry story — without maintaining a
wrapper.

*The strongest argument against it.* Response shapes stay unasserted, and every call site
repeats the error handling.

## The environment-variable half

Environment variables are read and validated **once at startup** and passed down — never read
inline in app code. A missing value read inline surfaces as a runtime `undefined` three layers
away from its cause; validated at startup it is one clear error before anything runs.

## What it writes and where

Rule `D1` in `docs/conventions-typescript.md`, `-go.md` and `-python.md`, tagged *review*.

## How to undo it

Delete the rule, or re-run `setup`.
