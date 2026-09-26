#!/usr/bin/env bash
# SessionStart banner: prints where work is written down here, and the top open board row.
# Reads .personal-config.json in the repo — never a constant, so one banner serves every repo.
set -euo pipefail

config=".personal-config.json"
[ -f "$config" ] || exit 0

ledger="$(sed -n 's/.*"ledgerFile"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$config")"
board="$(sed -n 's/.*"boardFile"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$config")"
standard="$(sed -n 's/.*"standardPath"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$config")"
ceiling="$(sed -n 's/.*"tierCeiling"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$config")"

[ -n "$standard" ] && echo "Standard: $standard — read it in full before writing code."
[ -n "$ledger" ] && [ -f "$ledger" ] && echo "Ledger: $ledger — what is true. Read first."
[ -n "$ceiling" ] && [ "$ceiling" != "deep" ] && echo "Tier ceiling: $ceiling — work above this tier is delegated."

if [ -n "$board" ] && [ -f "$board" ]; then
  # A table row, not the first line containing the word. Unanchored, this matched the status
  # vocabulary sentence every rendered board carries, and announced it as the next open item.
  row="$(grep -m1 '^|.*`OPEN`' "$board" || true)"
  if [ -n "$row" ]; then
    echo "Board: $board — next open item:"
    echo "  $(printf '%s' "$row" | sed 's/^[[:space:]]*//')"
  else
    echo "Board: $board — no OPEN rows."
  fi
fi
