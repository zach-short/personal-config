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
# scan of text cannot tell an unfinished edit from a sentence that reads like one. A third
# argument replaces that last line where a false alarm is not the answer.
block() {
  printf 'Blocked: %s\n\n%s\n\n%s\n' \
    "$1" \
    "$2" \
    "${3:-Fix it, or say why this is a false alarm and stop again — this gate is overridden after 8 consecutive blocks.}" >&2
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

# Where `.personal-config.json` is. It is untracked, so a linked worktree has none, and reading
# `./.personal-config.json` there found nothing and ran nothing, silently. The same path in the
# main checkout is the answer, found the way `documentRoot` in `src/lib/git.ts` finds it: the
# common git dir names the main checkout, and git, asked from there, has to agree before it is
# used. Anything that does not round-trip — a bare main, a moved checkout, a git older than
# `--path-format` (2.31) — keeps the current folder, where the file is missing and the log says so.
# A submodule or a nested repository has its git dir as its common dir and is never mapped.
#
# Two more guards, each from a case that resolved to another folder in review. The function runs
# in a `$(...)` subshell, so the `unset` drops git's location overrides for these questions only:
# a `GIT_COMMON_DIR` in the environment named its own repository from any folder. And a git dir
# made by `--separate-git-dir=<x>/.git` round-trips to `<x>`, which holds no checkout, so the
# candidate must hold the files its index tracks: from `<x>` every one of them reads as deleted.
#
# The folder is the nearest one holding the file, climbing from where the stop happened. Until
# 2026-10-18 the answer was that one folder: a stop in `docs/bench` looked for
# `<main>/docs/bench/.personal-config.json`, found nothing and skipped the gate, 83 times in one
# repo's log. In a linked worktree the climb is through the main checkout's tree, since the file
# is untracked and exists only there. The climb stops at the git top level, so a submodule or a
# nested repository never reaches the config of the repository around it, and a folder that is in
# no repository, or whose git cannot be trusted, is not climbed at all.
#
# It prints two lines: the folder to read the config from, and the folder to run the gate in.
# They differ only in a linked worktree, where the config comes from the main checkout and the
# gate runs in the same folder of this worktree, so a root gate (`go test ./...`, a script path
# relative to the root) proves the root wherever the stop happened (gate-contract review,
# 2026-10-18: run from `docs`, `go vet ./...` matched no packages and blocked a green tree).
config_dir() {
  local git_dir common main prefix indexed missing top start found run
  unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR
  git_dir="$(git rev-parse --path-format=absolute --git-dir 2>/dev/null)" || { twice "$(pwd)"; return; }
  common="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || { twice "$(pwd)"; return; }
  case "$git_dir" in /*) ;; *) twice "$(pwd)"; return ;; esac
  case "$common" in /*) ;; *) twice "$(pwd)"; return ;; esac
  # Every answer below that is not the main checkout climbs this checkout's own tree, so a stop
  # that cannot be mapped still finds a config above it in the same checkout, and nothing beyond.
  # The gate runs where that config is, which is inside this checkout.
  top="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [ "$git_dir" = "$common" ]; then twice "$(climb "$top" "$(pwd -P)" "$(pwd)")"; return; fi

  case "$common" in
    */.git) main="${common%/.git}" ;;
    *)
      main="$(git config --file "$common/config" core.worktree 2>/dev/null || true)"
      [ -n "$main" ] && main="$(cd "$common" && cd "$main" 2>/dev/null && pwd -P || true)"
      ;;
  esac
  if [ -z "$main" ] ||
    [ "$(git -C "$main" rev-parse --path-format=absolute --git-dir 2>/dev/null)" != "$common" ] ||
    [ "$(git -C "$main" rev-parse --show-toplevel 2>/dev/null)" != "$main" ]; then
    twice "$(climb "$top" "$(pwd -P)" "$(pwd)")"
    return
  fi
  indexed="$(git -C "$main" ls-files 2>/dev/null | wc -l)"
  missing="$(git -C "$main" ls-files --deleted 2>/dev/null | wc -l)"
  if [ "$indexed" -gt 0 ] && [ "$missing" -ge "$indexed" ]; then
    twice "$(climb "$top" "$(pwd -P)" "$(pwd)")"
    return
  fi
  prefix="$(git rev-parse --show-prefix 2>/dev/null || true)"
  start="$main${prefix:+/${prefix%/}}"
  found="$(climb "$main" "$start" "$start")"
  # The config's folder, moved from the main checkout into this worktree. A folder this worktree
  # does not have (deleted or renamed on its branch) falls back to the worktree's top level, and
  # a top level git did not print as an absolute path falls back to where the stop happened.
  case "$top" in
    /?*)
      run="$top${found#"$main"}"
      [ -d "$run" ] || run="$top"
      ;;
    *) run="$(pwd)" ;;
  esac
  printf '%s\n%s\n' "$found" "$run"
}

# `twice <folder>` answers the same folder for the config and the run: every case but a mapped
# linked worktree.
twice() {
  printf '%s\n%s\n' "$1" "$1"
}

# `climb <top> <start> <none>` prints the nearest folder from `<start>` up to `<top>` that holds
# `.personal-config.json`, and `<none>` when none does, so the log's `looked=` names the folder
# the stop happened in, as it did before the climb. A `<start>` that is not inside `<top>` (an
# empty top, a relative one, a path git spelled differently) is not climbed: `<none>` is checked
# alone, the open direction. `<start>` is physical (`pwd -P`) because git prints the top level
# with its symlinks resolved, and macOS's temporary folders sit behind one.
climb() {
  local top="$1" dir="$2"
  case "$top" in /?*) ;; *) printf '%s\n' "$3"; return ;; esac
  case "$dir" in "$top" | "$top"/*) ;; *) printf '%s\n' "$3"; return ;; esac
  while [ -n "$dir" ]; do
    if [ -f "$dir/.personal-config.json" ]; then printf '%s\n' "$dir"; return; fi
    [ "$dir" != "$top" ] || break
    dir="${dir%/*}"
  done
  printf '%s\n' "$3"
}

# One line per stop that reaches the gate, appended where `personal-config` keeps its own state,
# so "did the gate run in that worktree, and what did it run" has an answer after the fact. A
# Stop hook's output on a pass is shown to nobody, so the file is the record. Kept to its last
# 500 lines; a log that cannot be written is skipped, never a reason to block.
LOG="${HOME:-}/.config/personal-config/completion-gate.log"
log() {
  [ -n "${HOME:-}" ] || return 0
  {
    mkdir -p "$(dirname "$LOG")" &&
      printf '%s cwd=%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$PWD" "$1" >>"$LOG" &&
      if [ "$(wc -l <"$LOG")" -gt 1000 ]; then
        tail -n 500 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
      fi
  } 2>/dev/null || true
}

# The gate command comes from the repo, never from a constant — the same rule `session-banner.sh`
# follows, and for the same reason: one hook has to serve every repo, and `bun test` is one
# repo's answer. Read with `sed` rather than `jq` so a missing `jq` costs nothing here.
# Two lines, read without `read` so a `set -e` exit inside the subshell cannot end the hook: the
# config's folder, then the gate's. A missing second line or folder leaves the gate in `$PWD`.
dirs="$(config_dir)"
config="${dirs%%$'\n'*}/.personal-config.json"
run_dir="${dirs#*$'\n'}"
[ -d "$run_dir" ] || run_dir="$PWD"
raw=""
if [ -f "$config" ]; then
  raw="$(sed -n 's/.*"gateCommand"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' "$config")"
fi
# The first match only. Not `| head -1`: under `pipefail` a second match makes sed write after
# head has gone, the pipeline exits 141, and `set -e` ends the hook unblocked.
raw="${raw%%$'\n'*}"

# The value ends at its first quote. One with a backslash before that — an escaped quote above
# all — is beyond a `sed` read: until 2026-10-16 `"bun test -t \"x\""` was read as
# `bun test -t \`, which ran something else and could pass. So it is refused by name, and
# refusing is the closed direction: the turn does not end on a gate command nobody ran.
gate="${raw%%\"*}"
case "$gate" in
  *\\*)
    log "config=$config gate=unreadable"
    block "this repo's gate command could not be read." "  $config holds a gateCommand with a backslash or a quote in it, which this hook reads with sed and cannot unescape.

Make it one plain command with no quotes, or put the command in a script and name the script."
    ;;
esac

# No gate command configured is not a failure, and must never be treated as one. A repo that has
# not recorded a command has nothing to prove here — that covers every folder target, every
# non-code track, and every repo set up before this key existed. The alternative, blocking until
# somebody configures one, is a hook that refuses eight times in a row on the first run in a repo
# it was never told about; nobody keeps that installed long enough to benefit from it.
if [ -z "$gate" ]; then
  if [ -f "$config" ]; then log "config=$config gate=none"; else log "config=none looked=$config"; fi
  exit 0
fi

# Under the 600-second timeout `settings.json` gives this hook, because a hook the harness kills
# does not block: the turn just ends, which is the open direction. So the hook stops the gate at
# 570 seconds after it started, and running out is a block that says so.
# `PERSONAL_CONFIG_GATE_TIMEOUT` (seconds) moves it. It was 100 until 2026-10-17, when one repo's
# whole suite took 69 to 131 seconds on a green tree, and 537 seconds at a load average of 37 on a
# 10-core machine: every stop there timed out, and after 8 blocks the harness overrides the hook,
# which then checks nothing. A limit a real gate cannot meet is a gate that is switched off.
LIMIT="${PERSONAL_CONFIG_GATE_TIMEOUT:-570}"
# A limit of 0 would block every stop before the gate could finish, so it is read as unset.
case "$LIMIT" in "" | *[!0-9]*) LIMIT=570 ;; esac
[ "$LIMIT" -gt 0 ] || LIMIT=570

# `eval`, because the value is a command line — `bun test`, `make check`, `npm run verify` — and
# it comes from a file in the person's own repo, at the same trust level as the command they
# would have typed. It runs in the folder the config came from, inside the checkout being stopped
# in, which in a worktree is the worktree: the config comes from the main checkout, the work being
# proven does not. A gate is written for the folder that holds it (`go test ./...`,
# `python3 tools/build.py`), so the folder the stop happened in is not where it runs. Output is
# captured so a failure can quote it; a pass prints nothing, because a Stop hook's stdout is
# noise on every successful turn. `set -m` gives the gate its own process group, so a timeout
# stops the whole tree it started and not only the shell around it.
output_file="$(mktemp "${TMPDIR:-/tmp}/completion-gate.XXXXXX")"
trap 'rm -f "$output_file"' EXIT
set -m
(cd "$run_dir" && eval "$gate") </dev/null >"$output_file" 2>&1 &
pid=$!
set +m
# The limit is read from the clock, never counted in sleeps. Each `sleep 0.2` is a process of its
# own, and under load it takes longer: counted ticks let a 300-second limit run 318 seconds on
# 2026-10-17, and a count that drifts with the load can drift past the harness's timeout. `SECONDS`
# is bash's count of whole seconds since this script started, so the scan and the config lookup
# above are inside the limit too, and the margin under the harness is the same at any load.
#
# A gate that ran out has not passed, and its block says so in place of the usual last line. With
# "say why this is a false alarm", a slow machine read as one: the next stop arrives with
# `stop_hook_active` set and goes through, so a red tree under load ended the turn as quietly as a
# green one (board row 129). Asking for the run keeps the verdict in the turn at any limit.
while kill -0 "$pid" 2>/dev/null; do
  if [ "$SECONDS" -ge "$LIMIT" ]; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    log "config=$config gate=$gate result=timeout after ${LIMIT}s ran=$run_dir"
    block "this repo's gate command did not finish in ${LIMIT} seconds, so it has not passed." "  \$ $gate

$(tail -20 "$output_file")" "Run it yourself, in the background if it is slow, and stop again once it passes. A slow machine is not a false alarm: the gate stopped before it could fail."
  fi
  sleep 0.2
done
if wait "$pid"; then status=0; else status=$?; fi

if [ "$status" -ne 0 ]; then
  log "config=$config gate=$gate result=fail exit=$status ran=$run_dir"
  block "this repo's gate command did not pass." "  \$ $gate

$(tail -20 "$output_file")"
fi

log "config=$config gate=$gate result=pass ran=$run_dir"
exit 0
