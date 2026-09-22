#!/usr/bin/env bash
# PreToolUse guard: refuses the delete commands the owner reserved for themselves.
# The commit guard's analogue for work that is not in a repository — a repo's irreversible step
# is a commit, and a folder's is a delete, with no checkout to take it back out of.
# Exit 2 is the code Claude Code treats as "blocked, tell the model why" — stderr reaches the
# model, so the message is the ritual it should follow instead.
#
# Two rules about how this reads a payload, both learned by being wrong on the commit guard and
# copied here rather than relearned:
#   1. The command is parsed out of the JSON, never pattern-matched out of the raw payload. The
#      payload also carries the tool's *description*, so a plain `ls` was blocked whenever its
#      description said "git commit".
#   2. The command's words are walked, not substring-matched. `grep "rm" notes.md` deletes
#      nothing and would be blocked; `sudo rm -rf drafts` deletes and would pass.
#
# macOS ships bash 3.2, so nothing here uses associative arrays or `${x^^}`.
set -euo pipefail

payload="$(cat)"

if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"
else
  # Fail closed. Over-blocking costs one message; a file deleted out of a folder that is not in
  # version control cannot be taken back at all.
  echo "delete guard: jq not found — falling back to matching the whole payload." >&2
  cmd="$payload"
fi

# Wrappers whose own arguments are the real command. `sh`/`bash` are here so `sh -c "rm x"` is
# still caught; the de-quoted second pass below is what makes that reach the word `rm`.
# `xargs` matters more here than it does for a commit: `find … | xargs rm` is the common form.
is_wrapper() {
  case "$1" in
    env | sudo | nohup | time | xargs | sh | bash | zsh | dash | ksh) return 0 ;;
    *) return 1 ;;
  esac
}

# Three verbs and no more (setup-tracks `DESIGN.md` §10.6). `trash`, `find -delete` and
# `git clean` are recorded in `docs/choices/hooks.md` as **not caught**, deliberately: a guard
# that grows by objection becomes the parallel exclusion list D5 refused.
is_blocked() {
  local -a words=()
  read -r -a words <<<"$1" || true
  local n=${#words[@]}
  local i=0

  # Walk past environment assignments, wrappers and their flags to the command itself. Unlike
  # the commit guard there is no subcommand to inspect afterwards: `git` is a program that
  # mostly does harmless things, and `rm` is not.
  while ((i < n)); do
    case "${words[i]}" in
      rm | rmdir | unlink) return 0 ;;
      */rm | */rmdir | */unlink) return 0 ;;
      *=* | -*) i=$((i + 1)) ;;
      *) if is_wrapper "${words[i]}"; then i=$((i + 1)); else return 1; fi ;;
    esac
  done
  return 1
}

# One segment per shell separator, so `ls && rm x` is two commands and both are read.
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
Blocked: deleting the owner's files is the owner's.

Work that is not in a repository has no commit to restore it from, so a deleted file is simply
gone. Move it aside instead of removing it, and say where it went:

  1. mv <path> ~/.Trash/                  — recoverable until the Trash is emptied
  2. mv <path> <path>.$(date +%Y-%m-%d)   — kept beside itself, with the date in its name

Then name in your reply every file you moved and where you put it, so the owner can undo it
without searching. Do not work around this by other means.
MESSAGE
exit 2
