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

is_blocked() {
  local -a words=()
  read -r -a words <<<"$1" || true
  local n=${#words[@]}
  local i=0

  # Walk past environment assignments, wrappers and their flags to the command itself.
  while ((i < n)); do
    case "${words[i]}" in
      git | */git) break ;;
      *=* | -*) i=$((i + 1)) ;;
      *) if is_wrapper "${words[i]}"; then i=$((i + 1)); else return 1; fi ;;
    esac
  done
  ((i < n)) || return 1

  # Past git's own global options. `-C`, `-c` and the three path flags take a separate argument,
  # which is exactly what `git -C . commit` hid behind.
  i=$((i + 1))
  while ((i < n)); do
    case "${words[i]}" in
      -C | -c | --git-dir | --work-tree | --namespace) i=$((i + 2)) ;;
      -*) i=$((i + 1)) ;;
      *) break ;;
    esac
  done

  case "${words[i]:-}" in
    commit | push) return 0 ;;
    add) ;;
    *) return 1 ;;
  esac

  # `git add <path>` is the ritual. Only the stage-everything forms are refused.
  i=$((i + 1))
  while ((i < n)); do
    case "${words[i]}" in
      --all | --no-ignore-removal | . | :/) return 0 ;;
      --*) ;;
      -*) if [[ ${words[i]} == *A* ]]; then return 0; fi ;;
    esac
    i=$((i + 1))
  done
  return 1
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

Several sessions run in one checkout and only the owner knows which uncommitted file belongs
to which. Do not work around this by other means.
MESSAGE
exit 2
