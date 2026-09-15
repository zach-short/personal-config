# How long a function may get

## What this is

A rule in `docs/conventions-<lang>.md` — the per-language code standard an agent reads in full
before writing any code, and the file a reviewer checks a diff against — saying how long a
function may grow before it is split. Nothing enforces it but the person reading the diff.

## The options

**Roughly 6–15 lines; extract helpers.** *Recommended.*

*The defense.* A function that fits on a screen is reviewed at a glance and tested alone. The
number is not the point — the habit of noticing is. Most functions that grow past this are doing
two things, and naming the second one is usually the whole fix.

*The strongest argument against it.* A line count is a proxy, and proxies get gamed: you get
four helpers called once each, in an order you now have to reconstruct to read the original
logic. Extraction that does not name a *concept* makes code worse while satisfying the rule.

**5–20 typical, 40 a hard ceiling.** Looser; a 35-line reducer is fine.

*The defense.* It leaves room for the genuinely linear function — a parser, a reducer, a switch
over nine cases — where splitting is pure loss.

*The strongest argument against it.* A 40-line ceiling is high enough that almost nothing hits
it, so in practice it is no rule at all.

**No rule.** Length is left to review.

## The qualifier both options carry

Extract for a **concept**, not to relocate lines. A helper that needs three parameters to
explain itself was the wrong cut. Markup and view bodies are exempt from the count — JSX and
SwiftUI bodies are declarative and long by nature.

## What it writes and where

Rule `L1` in each `docs/conventions-<lang>.md`, tagged *review*.

## How to undo it

Delete the rule, or re-run `setup`.
