---
name: scope
description: Open a piece of work the right way — ground truth first, then a scope document that makes the owner's decisions cheap. Use when the user says "let's build X", "I want to add X", or asks to plan a feature, before any code is written.
---

# /scope

When the owner says "let's build X": **say nothing back until ground truth is done.** No
clarifying questions first — the audit answers most of them, and the rest are asked in one
batch at the gate.

## 1 — Read first

The code standard in full, the router file, and any existing doc that overlaps — **including
the archive index**. That last one is what stops a project re-deciding something already
settled.

## 2 — Ground truth, before proposing anything

Read the tree and the live data. Output is a table — claim, verified state, citation — dated
absolutely. Every claim carries a `file:line`, a query, or a commit. **Grep before recording
an absence**: "nothing does X" is the most expensive kind of wrong claim, because everything
downstream is built on it. This stage routinely finds the work is not the shape the request
assumed.

## 3 — The scope document

Its job is to make the owner's decisions cheap. **It proposes and decides nothing.**

1. **What exists, verified `<date>`** — the ground-truth table, first, because every
   option is only meaningful against it.
2. **What this is / what this is not** — the non-scope list is as load-bearing as the scope
   list and gets skipped constantly; without it every parked item is relitigated mid-build.
3. **Options** — each with a real defense **including the strongest argument against it**,
   which is what stops that argument coming back in three weeks as a new objection.
4. **Dials** — every number the design leaves open, each with a recommended default, destined
   for config rather than a constant hardcoded twice.
5. **Hazards this work walks into.**
6. **Open questions** — the batch for the gate.

## 4 — The gate

Stop. Ask in **one batched question, in chat, in the same turn** the scope doc is finished.
Every option carries a marked recommendation — never present a survey with no opinion. For
user-facing copy, offer 2–3 real variations in different registers. Record every answer with
its date, in the doc, the same turn it is given.
