# How files and folders are named

## What this is

A rule in `docs/conventions-<lang>.md` — the per-language code standard an agent reads in full
before writing any code, and the file a reviewer checks a diff against — saying how files and
folders are named. It is the first rule a new file meets, and the one a reviewer can check
without opening it.

## The options

**Whatever the language's ecosystem does.** *Recommended.* kebab-case in TypeScript,
lowercase-with-underscores in Go, snake_case in Python, PascalCase in Swift named for the
primary type.

*The defense.* Every one of those is what the language's own tooling, standard library and
community already do. Matching them means a newcomer to your repo is not also learning your
personal convention, and it means generated files already comply.

*The strongest argument against it.* In a polyglot repo you now have three conventions, and
someone moving between them gets it wrong regularly — which is exactly the kind of low-value
review comment that wastes everyone's time.

**kebab-case everywhere it is legal.**

*The defense.* One rule, no thinking, consistent in a file tree you read across languages.

*The strongest argument against it.* It fights the toolchain. Go's own convention is
underscores; Swift files are conventionally named for the type they hold and the compiler's
diagnostics read that way.

## The acronym half of the rule

Acronyms are words, not shouts: `userId`, `apiUrl`, `HttpClient`. **Except in Go**, where
initialisms keep uniform case: `userID`, `apiURL`, `HTTPClient` — that is the language's own
convention and its linters enforce it. This is a deliberate contradiction between two of your
conventions files, and both of them say so, because a contradiction that is documented is a
decision and an undocumented one is a bug.

## What it writes and where

Rule `F1` in each `docs/conventions-<lang>.md`, tagged *review*.

## How to undo it

Delete the rule, or re-run `setup`.
