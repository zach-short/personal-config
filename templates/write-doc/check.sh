#!/usr/bin/env bash
# The check /write-doc runs on a saved document: em dashes, contractions, and the banned words and
# phrases that style.md, beside this script, lists.
#
# Usage: check.sh check FILE
#   exit 0  "PASS: FILE" on stdout. Every check ran on text read from FILE and found nothing.
#   exit 1  One line per problem on stdout.
#   exit 2  FILE was not checked. The reason is on stderr, and nothing says PASS.
#
# Usage: check.sh hook
#   The PostToolUse hook on Write|Edit that setup installs when the person answers "Every document
#   it saves". It reads the hook's JSON payload on stdin and checks the new text, a Write's
#   `content` or an Edit's `new_string`, saved to a .md .mdx .txt .rst .tex or .adoc file. It
#   never prints PASS.
#   exit 0  Nothing to report: the new text is clean or empty, the file is not one of those types,
#           or the file carries a personal-config stamp where a renderer puts one.
#   exit 2  The problems, or the reason nothing was checked, on stderr. A PostToolUse hook cannot
#           undo the save. Exit 2 is the one code whose stderr Claude Code shows the agent; any
#           other non-zero code puts one line in the person's transcript, where the agent never
#           sees it. So a missing jq exits 2 as well, after every save of any file, because with
#           no jq the script cannot tell which file was saved.
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

# The stamp a personal-config renderer writes, as personal-config's src/lib/stamp.ts reads it
# (STAMP_PATTERN). In Perl, on bytes: \xc2\xb7 is the middle dot, and the lookahead stands for the
# end of a line the way JavaScript's multiline `$` does, which also ends a line at a carriage
# return or at U+2028 and U+2029.
STAMP='personal-config v\S+ \xc2\xb7 [0-9]{4}-[0-9]{2}-[0-9]{2} \xc2\xb7 config [0-9a-f]{8} \xc2\xb7 standard v\S+?( \xc2\xb7 adapted)?\s*(?:-->)?(?=\r|\xe2\x80[\xa8\xa9]|\z)'

# fail MESSAGE: the file was not checked. Never prints PASS.
fail() {
  printf 'check.sh: %s\n' "$1" >&2
  exit 2
}

usage() {
  fail "usage: check.sh check FILE, or check.sh hook with a hook payload on stdin"
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

# run_checks FILE TEXT: the three checks on TEXT, one line per problem on stdout. Status 0 when
# there are none and 1 when there are; exits 2 when a tool fails, so a caller that reads this in a
# command substitution tells "problems" (1) from "not checked" (2). FILE decides only whether the
# banned words are checked.
run_checks() {
  local file="$1" text="$2" stripped joined hits bad=0
  stripped="$(strip_code "$text")" || exit 2
  if matches "$DASH" "$text"; then
    echo "Em dash found. Rewrite without the em dash. Use a period, comma, colon or parentheses."
    bad=1
  fi
  if matches "$CONTRACTION" "$stripped"; then
    echo "Contraction found. Rewrite without contractions. Write 'do not', 'it is', 'cannot'."
    bad=1
  fi
  if ! skips_banned "$file"; then
    joined="$(one_line "$stripped")" || exit 2
    hits="$(banned_hits "$joined")" || exit 2
    if [ -n "$hits" ]; then
      echo "Banned words or phrases found: $hits. State the fact plainly. See style.md beside this script."
      bad=1
    fi
  fi
  return "$bad"
}

check_file() {
  local file="$1" text found status
  # A path that starts with "-" would be read as an option by cat and textutil.
  case "$file" in -*) file="./$file" ;; esac
  [ -f "$file" ] || fail "no such file: $1"
  [ -r "$file" ] || fail "cannot read $1, so nothing was checked."

  text="$(read_text "$file")" || exit 2
  [ -n "$text" ] || fail "no text was read from $1, so nothing was checked."

  found="$(run_checks "$file" "$text")"
  status=$?
  [ "$status" -le 1 ] || exit 2
  if [ "$status" -eq 1 ]; then
    printf '%s\n' "$found"
    exit 1
  fi
  if skips_banned "$file"; then
    echo "PASS: $1 (banned words not checked in a rule or skill file under .claude/)"
  else
    echo "PASS: $1"
  fi
  exit 0
}

# stamped FILE: status 0 when FILE carries a personal-config stamp on the one line a renderer puts
# one, and 1 when it does not. Exits 2 when perl fails. A port of stampIndex in personal-config's
# src/lib/stamp.ts: line 1; line 2 below a #! line; the first non-blank line after a frontmatter
# block that closes; and no line at all when the frontmatter never closes. A stamp quoted anywhere
# else is prose, so its file is checked. The tests run one set of files through both the
# TypeScript and this port, because nothing else keeps the two in step.
stamped() {
  local status
  STAMP="$STAMP" perl -e '
    open(my $fh, "<", $ARGV[0]) or exit 3;
    my $text = do { local $/; <$fh> };
    $text = "" unless defined $text;
    my @lines = split /\n/, $text, -1;
    my $first = @lines ? $lines[0] : "";
    $first =~ s/\s+\z//;
    my $at;
    if (substr($first, 0, 2) eq "#!") { $at = 1 }
    elsif ($first ne "---") { $at = 0 }
    else {
      my ($close) = grep { (my $l = $lines[$_]) =~ s/\s+\z//; $l eq "---" } 1 .. $#lines;
      exit 1 unless defined $close;
      ($at) = grep { $lines[$_] =~ /\S/ } $close + 1 .. $#lines;
      exit 1 unless defined $at;
    }
    exit 1 unless defined $lines[$at];
    exit($lines[$at] =~ /$ENV{STAMP}/ ? 0 : 1);
  ' "$1"
  status=$?
  [ "$status" -le 1 ] || fail "perl failed (status $status) while it read the stamp of $1, so nothing was checked."
  return "$status"
}

# A jq filter for the new text of a save: a Write's content, else an Edit's new_string. It stops
# with an error, never an empty string, when the payload carries neither, when the value is not a
# string, or when it holds a NUL byte, which bash would drop without a warning.
NEW_TEXT='.tool_input
  | if has("content") then .content elif has("new_string") then .new_string
    else error("the payload carries no new text") end
  | if type != "string" then error("the new text is not a string")
    elif (explode | any(. == 0)) then error("the new text holds a NUL byte")
    else . end'

# from_payload PAYLOAD FILTER: jq's raw output for FILTER. Exits 2 when jq fails, so a payload it
# cannot read is never taken for an empty one.
from_payload() {
  local out status
  out="$(printf '%s' "$1" | jq -r "$2")"
  status=$?
  [ "$status" -eq 0 ] || fail "jq could not read the hook payload (status $status), so the saved file was not checked."
  printf '%s' "$out"
}

check_hook() {
  local payload file ext text found status
  command -v jq >/dev/null 2>&1 \
    || fail "jq was not found on PATH, so the file just saved was not checked. Install jq, or run $0 check FILE on each document by hand."
  # A terminal on stdin is a person, not Claude Code, and cat would wait for them.
  [ ! -t 0 ] || usage
  payload="$(cat)" || fail "could not read the hook payload, so the saved file was not checked."
  [ -n "$payload" ] || fail "the hook payload on stdin was empty, so nothing was checked."

  file="$(from_payload "$payload" '.tool_input.file_path | if type == "string" then . else error("the payload names no file") end')" || exit 2
  [ -n "$file" ] || fail "the hook payload names no file, so nothing was checked."
  ext="$(lowercase "${file##*.}")"
  case "$ext" in
    md | mdx | txt | rst | tex | adoc) ;;
    *) exit 0 ;;
  esac

  # The stamp is read from the file on disk, because an Edit's new_string does not carry it. The
  # files setup generates are stamped, and some of them use em dashes on purpose.
  [ -f "$file" ] || fail "no such file: $file, so the text just saved was not checked."
  [ -r "$file" ] || fail "cannot read $file, so the text just saved was not checked."
  if stamped "$file"; then exit 0; fi

  text="$(from_payload "$payload" "$NEW_TEXT")" || exit 2
  [ -n "$text" ] || exit 0

  found="$(run_checks "$file" "$text")"
  status=$?
  [ "$status" -le 1 ] || exit 2
  [ "$status" -eq 1 ] || exit 0
  {
    printf 'check.sh found problems in the text just saved to %s:\n' "$file"
    printf '%s\n' "$found"
    printf 'The file is saved as it is. Fix these in it; this check runs again on the next save.\n'
  } >&2
  exit 2
}

require_tools
case "${1:-}" in
  check)
    [ "$#" -eq 2 ] || usage
    check_file "$2"
    ;;
  hook)
    [ "$#" -eq 1 ] || usage
    check_hook
    ;;
  *)
    usage
    ;;
esac
