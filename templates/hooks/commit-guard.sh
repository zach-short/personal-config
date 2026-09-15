#!/usr/bin/env bash
# PreToolUse guard: refuses the git commands the owner reserved for themselves.
# Exit 2 is the code Claude Code treats as "blocked, tell the model why" — stderr reaches the
# model, so the message is the ritual it should follow instead.
set -euo pipefail

payload="$(cat)"
command="$(printf '%s' "$payload" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p')"

case "$command" in
  *"git commit"*|*"git push"*|*"git add -A"*|*"git add ."*|*"git add --all"*)
    cat >&2 <<'MESSAGE'
Blocked: commits and pushes are the owner's.

Run `git status --short`, then print exactly two copyable bash blocks, one command each:

  1. git add <the exact files this session touched>   — never -A, never .
  2. git commit -m "<short, all lowercase>"

Several sessions run in one checkout and only the owner knows which uncommitted file belongs
to which. Do not work around this by other means.
MESSAGE
    exit 2
    ;;
esac
exit 0
