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

# The open item's own file, as " · <path>", so a session opens the one prompt it needs. Empty on a
# board that keeps its prompts below the table, which has no items folder. The folder is
# `itemsDir`, else the board's stem lowercased. The glob keys on "<n>-", so 1 never finds 15-.
item_path() {
  local dir file
  [ -n "$2" ] || return 0
  dir="$(sed -n 's/.*"itemsDir"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$config")"
  [ -n "$dir" ] || dir="$(printf '%s' "${1%.*}" | tr '[:upper:]' '[:lower:]')"
  for file in "$dir/$2"-*.md; do
    if [ -f "$file" ]; then
      printf ' · %s' "$file"
      return 0
    fi
  done
}

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
    echo "Next open: ${num:+$num · }$title$(item_path "$board" "$num")"
  else
    echo "Next open: none"
  fi
fi
