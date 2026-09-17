#!/usr/bin/env bash
# Stop hook: refuses to end a turn on work that is visibly unfinished.
#
# Two checks, cheapest first. It scans the source files this working tree has changed for the
# markers an agent leaves when it hands back a sketch instead of the work, and then runs the
# repo's own gate command. Exit 2 is the code Claude Code reads as "blocked, tell the model
# why" — stderr reaches the model, which is why each message names the check that failed and
# the file or command that failed it, rather than saying the work is incomplete.
#
# A Stop hook may also block by printing `{"decision":"block","reason":"…"}` on stdout. Exit 2
# is used instead because `commit-guard.sh` already blocks that way, one house pattern is
# cheaper to hold than two, and a reason built in bash reaches the model without having to be
# JSON-escaped first.
#
# Three properties of Stop hooks, all documented, all load-bearing here:
#   1. The payload carries `stop_hook_active`, true when the turn is *already* continuing
#      because a Stop hook blocked it. Blocking again on that is how a hook loops against
#      itself, so this exits 0 before doing anything else.
#   2. Claude Code overrides a Stop hook after **8 consecutive blocks** and ends the turn with a
#      warning. This is a nudge with a ceiling, not a wall — which is also the escape hatch when
#      a block is wrong. `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` raises the ceiling.
#   3. Anything it cannot check, it does not block on. A gate that refuses every stop because it
#      could not find a command to run is worse than no gate: it gets switched off, and the
#      checks that did work go with it.
#
# macOS ships bash 3.2, so nothing here uses associative arrays or `${x^^}`.
set -euo pipefail

payload="$(cat)"

# `jq` first for an exact read, a grep on the raw payload when it is missing. This is the
# opposite direction from `commit-guard.sh`, which fails *closed* without jq, and deliberately:
# over-blocking a commit costs one message, while over-blocking a stop costs the turn and can
# only be escaped by exhausting the 8-block cap. The payload here is the harness's own small
# object — session id, transcript path, cwd, event name, this flag — with no user text in it,
# so a substring match on it cannot be fooled by something the model wrote.
active=no
if command -v jq >/dev/null 2>&1; then
  if [ "$(printf '%s' "$payload" | jq -r '.stop_hook_active // false')" = "true" ]; then
    active=yes
  fi
elif printf '%s' "$payload" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  active=yes
fi

if [ "$active" = yes ]; then exit 0; fi

# Blocking is one function so every reason has the same shape: what failed, the evidence, and
# what to do about it — including the fact that saying so and stopping again is allowed, since a
# scan of text cannot tell an unfinished edit from a sentence that reads like one.
block() {
  printf 'Blocked: %s\n\n%s\n\n%s\n' \
    "$1" \
    "$2" \
    "Fix it, or say why this is a false alarm and stop again — this gate is overridden after 8 consecutive blocks." >&2
  exit 2
}

# The markers, and why each is here. The set is small on purpose: a marker that fires on
# legitimate text teaches its user to ignore the hook, and a hook people ignore is worse than
# one that never fired.
#
#   1. `rest of the file|code|implementation|…` — the canonical elision, in every spelling of
#      it. This is the broadest of the four and the one most likely to catch a comment that
#      meant it literally.
#   2. `... existing code ...` — the marker for a file that was summarised rather than edited.
#   3. `… for brevity` — the same thing, said politely.
#   4. `your code here` / `code goes here` — a scaffold handed back with the hole still in it.
#
# Deliberately **not** in the set: `TODO: implement`, because a deferred task is not an
# unfinished turn and this scan cannot tell them apart; and `not implemented`, because throwing
# it is a legitimate idiom for an abstract method. Both would fire on work that is finished.
MARKERS='(rest|remainder) of (the )?(file|code|implementation|function|method|class)|\.\.\. existing code \.\.\.|(unchanged|omitted|elided|truncated) for brevity|your code here|(code|implementation) goes here'

# Source files only, and never one under a `hooks/` directory. Both halves are deliberate:
# these are *code* markers, and prose legitimately says "the rest of the file", so scanning
# `.md` would flag documents for being documents — including this tool's own long form, which
# has to quote the markers to explain them. The `hooks/` skip is the same problem one level in:
# a repo that ships a hook like this one contains the marker list as data, and a gate that
# blocks on its own source is a gate that gets uninstalled on the first run.
is_scannable() {
  case "$1" in
    hooks/* | */hooks/*) return 1 ;;
    *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs | *.py | *.go | *.rs | *.rb | *.java) return 0 ;;
    *.kt | *.swift | *.c | *.h | *.cc | *.cpp | *.cs | *.php | *.sh | *.sql) return 0 ;;
    *.css | *.scss | *.vue | *.svelte) return 0 ;;
    *) return 1 ;;
  esac
}

# What to scan. Under git it is what this tree has changed, which is the closest a shell script
# gets to "what this session touched" — an old marker in a file nobody opened is not this turn's
# problem, and blocking on one would be unfixable noise. `git status --porcelain` is used rather
# than `git diff HEAD` because it carries untracked files in the same pass and works in a repo
# with no commits yet. A path containing a newline is not handled and is simply not scanned:
# fail-open is the right direction for every "cannot tell" in this file.
#
# Without git there is nothing recording what changed, so it walks the directory instead,
# skipping dot-directories and the usual vendored trees. That is the non-code and folder case
# (setup-tracks DESIGN.md D4/D5), where the trees are small; MAX_FILES stops it becoming a
# minute of disk on a repo that is not.
MAX_FILES=400

candidates() {
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git status --porcelain 2>/dev/null | sed -e 's/^...//' -e 's/.* -> //'
  else
    find . -type f \
      -not -path '*/.*' \
      -not -path '*/node_modules/*' \
      -not -path '*/vendor/*' \
      -not -path '*/dist/*' \
      -not -path '*/build/*' \
      -not -path '*/target/*' 2>/dev/null
  fi
}

scanned=0
while IFS= read -r file; do
  [ -n "$file" ] || continue
  [ -f "$file" ] || continue
  is_scannable "$file" || continue

  scanned=$((scanned + 1))
  if [ "$scanned" -gt "$MAX_FILES" ]; then break; fi

  hit="$(grep -n -i -E "$MARKERS" "$file" 2>/dev/null | head -1 || true)"
  if [ -n "$hit" ]; then
    block "this turn left a placeholder behind, so the work is not finished." "  $file:$hit"
  fi
done <<<"$(candidates)"

# The gate command comes from the repo, never from a constant — the same rule `session-banner.sh`
# follows, and for the same reason: one hook has to serve every repo, and `bun test` is one
# repo's answer. Read with `sed` rather than `jq` so a missing `jq` costs nothing here; a command
# containing an escaped quote is beyond that and would be read short, which is why the long form
# says to keep it to a single plain command.
config=".personal-config.json"
gate=""
if [ -f "$config" ]; then
  gate="$(sed -n 's/.*"gateCommand"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$config")"
fi

# No gate command configured is not a failure, and must never be treated as one. A repo that has
# not recorded a command has nothing to prove here — that covers every folder target, every
# non-code track, and every repo set up before this key existed. The alternative, blocking until
# somebody configures one, is a hook that refuses eight times in a row on the first run in a repo
# it was never told about; nobody keeps that installed long enough to benefit from it.
if [ -z "$gate" ]; then exit 0; fi

# `eval`, because the value is a command line — `bun test`, `make check`, `npm run verify` — and
# it comes from a file in the person's own repo, at the same trust level as the command they
# would have typed. Output is captured so a failure can quote it; a pass prints nothing, because
# a Stop hook's stdout is noise on every successful turn.
if ! output="$(eval "$gate" 2>&1)"; then
  block "this repo's gate command did not pass." "  \$ $gate

$(printf '%s' "$output" | tail -20)"
fi

exit 0
