#!/usr/bin/env bash
# The check /write-doc runs on a saved document: em dashes, contractions, and the banned words and
# phrases that style.md, beside this script, lists.
#
# Usage: check.sh check FILE
#   exit 0  "PASS: FILE" on stdout. Every check ran on text read from FILE and found nothing.
#   exit 1  One line per problem on stdout.
#   exit 2  FILE was not checked. The reason is on stderr, and nothing says PASS.
#
# It fails closed. A check that prints PASS on text it never read is worse than no check, because
# the person trusts the PASS. So a missing tool, a missing or unreadable file, a file type it
# cannot read, a failed extraction and an empty result all exit 2 before any check runs, and a
# tool that fails during a check exits 2 too.
#
# Fenced and inline code are not checked for contractions or banned words; the em dash check reads
# everything. Banned words are not checked in a rule or skill file under `.claude/`, which lists
# them on purpose, and the PASS line says so when that happens.
#
# One limit it cannot close: textutil may parse a damaged Word file only in part and exit 0, and
# then the check runs on the part it was given.
#
# macOS ships bash 3.2, so nothing here uses associative arrays, `${x^^}`, `${x,,}` or `mapfile`.
set -u
# One locale for every tool: grep reads bytes, so the em dash and the curly apostrophe match as
# the byte sequences they are, and no locale turns a document into "binary file matches".
export LC_ALL=C

DASH="$(printf '\342\200\224')"

CONTRACTION="[a-z]n('|’)t\b|[a-z]('|’)(re|ve|ll|m|d)\b|\b(it|that|there|here|what|let|he|she|who|where|how|when|why)('|’)s\b"

BANNED='\b(delv(e|es|ed|ing)|tapestry|pivotal|showcas(e|es|ed|ing)|underscor(e|es|ed|ing)|testament|nestled|meticulous(ly)?|intricate|intricacies|multifaceted|garner(s|ed|ing)?|elucidat(e|es|ed|ing)|bolster(s|ed|ing)?|fostering|crucial|moreover|furthermore|additionally|commendable|beacon|cornerstone|paradigm shift|game-changer|holistic|seamless(ly)?|invaluable|unparalleled|groundbreaking|ever-evolving|ever-changing)\b|in the realm of|stands as a|plays a (pivotal|crucial|vital|key|significant) role|in today.{1,3}s (fast-paced|digital|modern|world)|it is (important|worth) (to )?not(e|ing)|in conclusion|in summary|at the end of the day|i hope this helps|let me know if you|great question|as an ai (language )?model|knowledge cutoff|\bnot (just|only|merely)\b[^.!?]{0,100}\bbut\b'

# fail MESSAGE: the file was not checked. Never prints PASS.
fail() {
  printf 'check.sh: %s\n' "$1" >&2
  exit 2
}

usage() {
  fail "usage: check.sh check FILE"
}

# Every tool a check pipes through. A missing one would empty the pipe, and an empty pipe reads as
# "no problems found", so each is looked for before any text is read.
require_tools() {
  local tool
  for tool in perl grep tr sort head paste cat; do
    command -v "$tool" >/dev/null 2>&1 \
      || fail "$tool was not found on PATH, so nothing was checked. Install $tool and run the check again."
  done
}

lowercase() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

# is_word_format FILE EXT: status 0 when FILE opens with the signature of EXT. textutil reads a
# file it cannot parse as plain text and exits 0 (seen 2026-10-01 on macOS), so without this a
# damaged or misnamed Word file is checked as its raw bytes and can print PASS.
is_word_format() {
  local head
  head="$(perl -e 'read(STDIN, my $b, 5); print unpack("H*", $b)' <"$1")" || return 1
  case "$2" in
    docx | odt) [ "${head#504b0304}" != "$head" ] ;;
    doc) [ "${head#d0cf11e0}" != "$head" ] ;;
    rtf) [ "$head" = "7b5c727466" ] ;;
    *) return 1 ;;
  esac
}

# has_no_nul FILE: status 0 when FILE holds no NUL byte, 1 when it does. Exits 2 when perl fails.
# A NUL marks binary data (a Word file renamed to .md, say): grep -a would scan its bytes, find no
# word, and pass a document whose text it never read. bash also drops NUL bytes from a command
# substitution without a warning, which can join two words into one that no pattern matches.
has_no_nul() {
  local status
  perl -ne 'exit 1 if /\0/' "$1"
  status=$?
  [ "$status" -le 1 ] || fail "perl failed (status $status) while it read $1, so nothing was checked."
  return "$status"
}

# read_text FILE: prints the text of FILE. Exits 2 when it cannot.
read_text() {
  local file="$1" ext
  ext="$(lowercase "${file##*.}")"
  case "$ext" in
    md | mdx | txt | rst | tex | adoc)
      has_no_nul "$file" \
        || fail "$file holds binary data, not text, so it was not checked. Save it as plain text and run the check again."
      cat "$file" || fail "could not read $file, so nothing was checked."
      ;;
    docx | doc | rtf | odt)
      command -v textutil >/dev/null 2>&1 \
        || fail "textutil was not found on PATH, so $file was not checked. It reads Word files and ships with macOS only. Save the document as .md or .txt and check that file."
      is_word_format "$file" "$ext" \
        || fail "$file does not start the way a .$ext file does, so it was not checked. Save it again from the program that made it."
      textutil -convert txt -stdout "$file" || fail "textutil could not read $file, so nothing was checked."
      ;;
    *)
      fail "$file is not a file type this check reads (.md .mdx .txt .rst .tex .adoc .docx .doc .rtf .odt), so nothing was checked."
      ;;
  esac
}

# strip_code TEXT: TEXT without fenced or inline code. Exits 2 when perl fails. A fence counts only
# where it opens and closes a line, so three backticks in a sentence do not pair with a later fence
# and hide the prose between them. A fence that never closes is left in, and checked.
strip_code() {
  printf '%s' "$1" | perl -0pe 's/^[ \t]*```[^\n]*\n.*?^[ \t]*```[^\n]*$//gms; s/`[^`\n]*`//g' \
    || fail "perl failed while it removed code from the text, so the check did not run."
}

# one_line TEXT: TEXT with its line breaks turned to spaces, so a phrase that a wrapped line splits
# ("in" at the end of one line, "summary" at the start of the next) is still found. Exits 2 when tr
# fails.
one_line() {
  printf '%s' "$1" | tr '\n' ' ' || fail "tr failed while it joined the lines, so the check did not run."
}

# skips_banned FILE: status 0 when FILE is a rule or skill file, which lists the banned words on
# purpose. Read from the absolute path, so `.claude/x.md` and `./.claude/x.md` agree. A worktree
# under `<repo>/.claude/worktrees/` is a project checkout, and its documents are checked in full.
skips_banned() {
  local abs="$1"
  case "$abs" in /*) ;; *) abs="$PWD/$abs" ;; esac
  case "$abs" in
    */.claude/worktrees/*) return 1 ;;
    */.claude/rules/* | */.claude/skills/*) return 0 ;;
  esac
  # An empty HOME would make the pattern below "/.claude/*"; an unset one would stop the script.
  [ -n "${HOME:-}" ] || return 1
  case "$abs" in
    "$HOME"/.claude/*) return 0 ;;
    *) return 1 ;;
  esac
}

# matches PATTERN TEXT: status 0 on a match, 1 on none. grep's own failure (status 2 and up) would
# otherwise read as "no match", which is a silent pass, so it exits 2 instead.
matches() {
  local status
  printf '%s' "$2" | grep -Eaiq -- "$1"
  status=$?
  [ "$status" -le 1 ] || fail "grep failed (status $status), so the check did not run."
  return "$status"
}

# banned_hits TEXT: the banned words and phrases in TEXT, lowercased and comma-separated, at most
# eight. Prints nothing when there are none. Exits 2 when a tool in the pipe fails.
banned_hits() {
  local found status joined
  found="$(printf '%s' "$1" | grep -Eaio -- "$BANNED")"
  status=$?
  [ "$status" -le 1 ] || fail "grep failed (status $status), so the check did not run."
  [ -n "$found" ] || return 0
  joined="$(printf '%s\n' "$found" | tr '[:upper:]' '[:lower:]' | sort -u | head -n 8 | paste -sd ',' -)"
  # grep found words, so an empty list here means a tool in the pipe failed, not a clean text.
  [ -n "$joined" ] || fail "the list of banned words could not be built, so the check did not run."
  printf '%s' "${joined//,/, }"
}

check_file() {
  local file="$1" text stripped joined hits bad=0 skipped=0
  # A path that starts with "-" would be read as an option by cat and textutil.
  case "$file" in -*) file="./$file" ;; esac
  [ -f "$file" ] || fail "no such file: $1"
  [ -r "$file" ] || fail "cannot read $1, so nothing was checked."

  text="$(read_text "$file")" || exit 2
  [ -n "$text" ] || fail "no text was read from $1, so nothing was checked."
  stripped="$(strip_code "$text")" || exit 2

  if matches "$DASH" "$text"; then
    echo "Em dash found. Rewrite without the em dash. Use a period, comma, colon or parentheses."
    bad=1
  fi
  if matches "$CONTRACTION" "$stripped"; then
    echo "Contraction found. Rewrite without contractions. Write 'do not', 'it is', 'cannot'."
    bad=1
  fi
  if skips_banned "$file"; then
    skipped=1
  else
    joined="$(one_line "$stripped")" || exit 2
    hits="$(banned_hits "$joined")" || exit 2
    if [ -n "$hits" ]; then
      echo "Banned words or phrases found: $hits. State the fact plainly. See style.md beside this script."
      bad=1
    fi
  fi

  [ "$bad" -eq 0 ] || exit 1
  if [ "$skipped" -eq 1 ]; then
    echo "PASS: $1 (banned words not checked in a rule or skill file under .claude/)"
  else
    echo "PASS: $1"
  fi
  exit 0
}

require_tools
case "${1:-}" in
  check)
    [ "$#" -eq 2 ] || usage
    check_file "$2"
    ;;
  *)
    usage
    ;;
esac
