#!/usr/bin/env bash
# PreToolUse guard: refuses the git commands the owner reserved for themselves.
# Exit 2 is the code Claude Code treats as "blocked, tell the model why" — stderr reaches the
# model, so the message is the ritual it should follow instead.
#
# Two rules about how this reads a payload, both learned by being wrong:
#   1. The command is parsed out of the JSON, never pattern-matched out of the raw payload. The
#      payload also carries the tool's *description*, so a plain `ls` was blocked whenever its
#      description said "git commit".
#   2. The command's words are walked, not substring-matched. `grep "git commit" PASSOFF.md`
#      writes nothing and was blocked; `git -C . commit -m x` writes a commit and passed.
#
# macOS ships bash 3.2, so nothing here uses associative arrays or `${x^^}`.
set -euo pipefail

payload="$(cat)"

if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"
else
  # Fail closed. Over-blocking costs one message; a commit the owner did not make cannot be
  # taken back from a shared checkout.
  echo "commit guard: jq not found — falling back to matching the whole payload." >&2
  cmd="$payload"
fi

# Wrappers whose own arguments are the real command. `sh`/`bash` are here so `sh -c "git push"`
# is still caught; the de-quoted second pass below is what makes that reach the word `git`.
is_wrapper() {
  case "$1" in
    env | sudo | nohup | time | xargs | sh | bash | zsh | dash | ksh) return 0 ;;
    *) return 1 ;;
  esac
}

# The segment being read, one word per element. Global because bash 3.2 cannot return an array
# from a function: `is_blocked` fills it and every helper below reads it.
words=()
n=0

# Walk past environment assignments, wrappers and their flags to the command itself. Prints the
# index of the first `git` or `gh`, or $n when the segment runs neither.
program_index() {
  local i=0
  while ((i < n)); do
    case "${words[i]}" in
      git | */git | gh | */gh) break ;;
      *=* | -*) i=$((i + 1)) ;;
      *) if is_wrapper "${words[i]}"; then i=$((i + 1)); else i=$n; fi ;;
    esac
  done
  echo "$i"
}

# Past git's own global options. `-C`, `-c` and the three path flags take a separate argument,
# which is exactly what `git -C . commit` hid behind.
subcommand_index() {
  local i=$(($1 + 1))
  while ((i < n)); do
    case "${words[i]}" in
      -C | -c | --git-dir | --work-tree | --namespace) i=$((i + 2)) ;;
      -*) i=$((i + 1)) ;;
      *) break ;;
    esac
  done
  echo "$i"
}

# `git add <path>` is the ritual. Only the stage-everything forms are refused.
stages_everything() {
  local i
  for ((i = $1; i < n; i++)); do
    case "${words[i]}" in
      --all | --no-ignore-removal | . | :/) return 0 ;;
      --*) ;;
      -*) if [[ ${words[i]} == *A* ]]; then return 0; fi ;;
    esac
  done
  return 1
}

# A carve-out reads a word as the shell will hand it to git, and a backslash, `$` or backtick
# means it will not: `\--no-ff` and `$(echo --no-ff)` both reach git as a flag the guard did not
# see (found by the Fable review of row 77, 2026-10-04). Brace expansion and a glob do the same
# after the guard has read the words: `{--no-ff,main}` is two words, and `*` is `--no-ff` in a
# directory holding a file of that name (the audit of row 77, 2026-10-04). A ref name cannot
# hold `*`, `?` or `[`, so refusing them costs a real branch nothing.
is_literal() {
  case "$1" in
    *'\'* | *'$'* | *'`'* | *'{'* | *'}'* | *'*'* | *'?'* | *'['*) return 1 ;;
    *) return 0 ;;
  esac
}

# `xargs` appends words read from its input after the ones the guard can see, so
# `echo --no-ff | xargs git merge --ff-only main` is a merge commit. No carve-out holds through
# it. The other wrappers add no word: `env`, `sudo`, `nohup` and `time` run the words they are
# given, and `sh -c` or `bash -c` hand their extra words to `$0` and `$@`, which only a `$` in
# the command reads, and `is_literal` refuses a `$`.
reached_through_xargs() {
  local i
  for ((i = 0; i < $1; i++)); do
    case "${words[i]}" in xargs) return 0 ;; esac
  done
  return 1
}

# `--abort` and `--quit` end an operation without writing a commit. Every flag has to be one of
# them, because a flag's argument is a word too: `git merge -m --abort main` is a merge whose
# message is "--abort".
backs_out() {
  local i found=no
  for ((i = $1; i < n; i++)); do
    is_literal "${words[i]}" || return 1
    case "${words[i]}" in
      --abort | --quit) found=yes ;;
      -*) return 1 ;;
    esac
  done
  [ "$found" = yes ]
}

# A fast-forward writes no commit, but only while `--ff-only` is the flag git obeys. git lets a
# later `--ff` or `--no-ff` override it and takes any unambiguous abbreviation of `--autostash`,
# so beside it only the flags that take no argument and change nothing else are let through.
fast_forward_only() {
  local i found=no
  for ((i = $1; i < n; i++)); do
    is_literal "${words[i]}" || return 1
    case "${words[i]}" in
      --ff-only) found=yes ;;
      -q | --quiet | -v | --verbose) ;;
      -*) return 1 ;;
    esac
  done
  [ "$found" = yes ]
}

# `GIT_CONFIG_COUNT`, `GIT_CONFIG_PARAMETERS` and their kin set config from the environment,
# where `merge.autoStash` can hide from the word walk.
sets_git_environment() {
  local i
  for ((i = 0; i < $1; i++)); do
    case "${words[i]}" in GIT_*=*) return 0 ;; esac
  done
  return 1
}

# An autostash stashes the whole working tree, other sessions' edits included, and git reads it
# from config as readily as from `--autostash`. So ask git, in the repo the command names with
# `-C`. A failure other than "not set" counts as set: the guard fails toward blocking.
autostash_configured() {
  local out status=0
  out="$(git "$@" config --bool merge.autoStash 2>/dev/null)" || status=$?
  [ "$status" -gt 1 ] || [ "$out" = true ]
}

# The refresh carve-out reads git's config, so it is let through only where that read is
# faithful: no global option but `-C <dir>`, which it repeats, and no `GIT_*` assignment.
refresh_without_autostash() {
  local p=$1 s=$2 i
  local -a dirs=()
  ! sets_git_environment "$p" || return 1
  for ((i = p + 1; i < s; i += 2)); do
    [ "${words[i]}" = -C ] || return 1
    dirs+=(-C "${words[i + 1]:-}")
  done
  ! autostash_configured ${dirs[@]+"${dirs[@]}"}
}

# The two forms a session needs and that write no commit: backing out of a conflict, and the
# `git merge --ff-only <branch>` that refreshes a stale worktree.
merge_writes_none() {
  local p=$1 s=$2
  backs_out $((s + 1)) && return 0
  fast_forward_only $((s + 1)) && refresh_without_autostash "$p" "$s"
}

# Every verb that writes a commit is the owner's, not only `commit` (board row 77, 2026-10-02).
# A form earns a pass only by matching a carve-out exactly; an unknown flag never earns one.
git_blocks() {
  local p=$1 s=$2
  case "${words[s]:-}" in
    commit | push | pull) return 0 ;;
    add) stages_everything $((s + 1)) ;;
    cherry-pick | revert | rebase | am) reached_through_xargs "$p" || ! backs_out $((s + 1)) ;;
    merge) reached_through_xargs "$p" || ! merge_writes_none "$p" "$s" ;;
    *) return 1 ;;
  esac
}

# `gh pr merge` writes a commit on the remote's branch, so it is a push. Any `merge` after `pr`
# counts, so a flag and its argument between the two cannot hide it.
gh_blocks() {
  local i seen_pr=no
  for ((i = $1 + 1; i < n; i++)); do
    case "${words[i]}" in
      pr) seen_pr=yes ;;
      merge) if [ "$seen_pr" = yes ]; then return 0; fi ;;
    esac
  done
  return 1
}

is_blocked() {
  words=()
  read -r -a words <<<"$1" || true
  n=${#words[@]}
  local p
  p="$(program_index)"
  ((p < n)) || return 1
  case "${words[p]}" in
    gh | */gh) gh_blocks "$p" ;;
    *) git_blocks "$p" "$(subcommand_index "$p")" ;;
  esac
}

# One segment per shell separator, so `ls && git commit` is two commands and both are read.
segments="${cmd//[;|&()]/$'\n'}"

blocked=no
while IFS= read -r segment; do
  [ -n "$segment" ] || continue
  dequoted="${segment//\"/}"
  dequoted="${dequoted//\'/}"
  if is_blocked "$segment" || is_blocked "$dequoted"; then
    blocked=yes
    break
  fi
done <<<"$segments"

[ "$blocked" = yes ] || exit 0

cat >&2 <<'MESSAGE'
Blocked: commits and pushes are the owner's.

Run `git status --short`, then print exactly two copyable bash blocks, one command each:

  1. git add <the exact files this session touched>   — never -A, never .
  2. git commit <the same files> -m "<short, all lowercase>"   — paths imply --only

Cherry-pick, revert, merge, rebase, am and pull write commits too, so they are the owner's
as well: print the command as one copyable block for the owner to run. To catch up with a
branch, `git fetch` then `git merge --ff-only <branch>` is let through, and so is `--abort`.

Several sessions run in one checkout and only the owner knows which uncommitted file belongs
to which. Do not work around this by other means.
MESSAGE
exit 2
