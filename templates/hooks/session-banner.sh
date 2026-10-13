#!/usr/bin/env bash
# SessionStart banner: at most three short pointer lines. Each names a file and the question it
# answers, so a session opens the part it needs. It never orders a full read: those orders made
# every new chat start at 92k-130k tokens, because each one was obeyed on turn one.
# Reads .personal-config.json in the repo, never a constant, so one banner serves every repo.
set -euo pipefail

config=".personal-config.json"
[ -f "$config" ] || exit 0

ledger="$(sed -n 's/.*"ledgerFile"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$config")"
board="$(sed -n 's/.*"boardFile"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$config")"
standard="$(sed -n 's/.*"standardPath"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$config")"

pointers=""
[ -n "$ledger" ] && [ -f "$ledger" ] && pointers="$ledger: what is true here (search it)"
if [ -n "$board" ] && [ -f "$board" ]; then
  pointers="${pointers:+$pointers · }$board: what is next"
fi
[ -n "$pointers" ] && echo "$pointers"
[ -n "$standard" ] && echo "$standard: how work flows (open the heading you need)"

if [ -n "$board" ] && [ -f "$board" ]; then
  # A table row, not the first line containing the word. Unanchored, this matched the status
  # vocabulary sentence every rendered board carries, and announced it as the next open item.
  row="$(grep -m1 '^|.*`OPEN`' "$board" || true)"
  if [ -n "$row" ]; then
    # The title cell only: the full row carries the prompt's file list and dependencies, which
    # is the board's job to hold and not the banner's to repeat on every session start.
    num="$(printf '%s' "$row" | awk -F'|' '{gsub(/^ +| +$/, "", $2); print $2}')"
    title="$(printf '%s' "$row" | awk -F'|' '{gsub(/^ +| +$/, "", $3); print $3}')"
    echo "Next open: ${num:+$num · }$title"
  else
    echo "Next open: none"
  fi
fi
