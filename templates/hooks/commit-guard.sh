#!/usr/bin/env bash
# PreToolUse guard: refuses the git commands the owner reserved for themselves, and the ones that
# throw away uncommitted work another session may own.
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

# The commit policy the person answered, written by the wizard into `commit-policy` beside this
# script (board row 78, 2026-10-04). Each line loses a trailing carriage return; then a line
# starting with `#` (the stamp and a note) and a blank line are skipped. Exactly one line must be
# left, and it must be exactly `agent-commits`. Anything else means `print-blocks`: a missing or
# unreadable file, two words, a word split over two lines, a word with spaces around it. The
# guard fails toward blocking, as it did before the file existed (audit of row 78, 2026-10-04:
# joining every line read `agent-\ncommits` as `agent-commits`).
#
# `no-rule` is read as `print-blocks`, so it blocks every commit (the owner's call of 2026-10-04,
# reversing the first build's call to read it as `agent-commits`). The person asked for no
# written rule, and the guard they also asked for keeps its own rule: commits are the owner's.
policy=print-blocks
policy_file="$(dirname "${BASH_SOURCE[0]}")/commit-policy"
if [ -r "$policy_file" ]; then
  kept=0
  word=''
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    case "$line" in '#'*) continue ;; esac
    [ -n "${line//[[:space:]]/}" ] || continue
    kept=$((kept + 1))
    word=$line
  done <"$policy_file" 2>/dev/null || kept=0
  if [ "$kept" -eq 1 ] && [ "$word" = agent-commits ]; then policy=agent-commits; fi
fi

# ---- The one commit `agent-commits` lets through (board row 78, redesigned 2026-10-04) ----
#
# The decision is made on the whole raw command, before anything below splits it. The first
# build split the command at `; & | ( )` and then asked whether one piece was a commit that named
# its files. The shell reads the whole text, not the piece, so every way the two readings differ
# was a commit of more than the named files: `&>/dev/null .` (the split cut at `&`), a
# backslash-newline that joins the next line, a zsh glob group `s(r)c`, a redirect, a `#`. Two
# audits found five such spellings. Patching each one leaves the next.
#
# So the allow decision accepts one shape only and fails closed on anything else: the whole
# command is `git commit`, then words from a small safe alphabet, one space or tab apart, with no
# control character anywhere. Nothing in that shape is something a shell joins, splits, expands,
# redirects or runs. Anything that does not match falls through to the walk below, which blocks
# every commit. The walk is unchanged, so this can only let through less than nothing.

# The characters a word may hold outside quotes. Listed one by one, not as ranges, so no locale
# can widen them. None of them means anything to bash or zsh inside a word.
SAFE_CHARS='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._/@=+,:-'

# The raw command split into words, with what kind each was: `u` unquoted, `q` one quoted string,
# `e` a `--message=` with a quoted value. Filled by `raw_words`.
raw=()
kinds=()

# Reads one quoted string starting at index $2 of $1. Prints the index just past the closing
# quote, or fails. Single quotes may hold anything but a single quote. Double quotes may not hold
# `$`, a backtick, a backslash or `!`, which are the characters bash or zsh still read inside them.
# A newline cannot reach here: the caller has refused every control character.
quoted_end() {
  local s=$1 i=$2 q c
  q=${s:i:1}
  i=$((i + 1))
  while ((i < ${#s})); do
    c=${s:i:1}
    if [ "$c" = "$q" ]; then
      echo $((i + 1))
      return 0
    fi
    if [ "$q" = '"' ]; then
      case "$c" in '$' | '`' | '\' | '!') return 1 ;; esac
    fi
    i=$((i + 1))
  done
  return 1
}

# Splits the raw command at single spaces or tabs into `raw` and `kinds`, or fails. A word is a
# run of safe characters, or one quoted string, or `--message=` followed by one quoted string. A
# quote may not touch any other character, so `'a''b'` and `x'.'` fail. Two separators in a row, a
# leading or trailing one, and a word starting with `=` (zsh expands `=name` to a path) fail.
raw_words() {
  local s=$1 i=0 len=${#1} start c end kind
  raw=()
  kinds=()
  while ((i < len)); do
    start=$i
    kind=u
    c=${s:i:1}
    if [ "$c" = "'" ] || [ "$c" = '"' ]; then
      end="$(quoted_end "$s" "$i")" || return 1
      i=$end
      kind=q
    else
      while ((i < len)); do
        c=${s:i:1}
        case "$c" in ' ' | $'\t' | "'" | '"') break ;; esac
        case "$SAFE_CHARS" in *"$c"*) ;; *) return 1 ;; esac
        i=$((i + 1))
      done
      if ((i < len)) && { [ "$c" = "'" ] || [ "$c" = '"' ]; }; then
        [ "${s:start:i-start}" = --message= ] || return 1
        end="$(quoted_end "$s" "$i")" || return 1
        i=$end
        kind=e
      fi
    fi
    ((i > start)) || return 1
    case "${s:start:1}" in '=') return 1 ;; esac
    raw+=("${s:start:i-start}")
    kinds+=("$kind")
    ((i < len)) || return 0
    c=${s:i:1}
    case "$c" in ' ' | $'\t') ;; *) return 1 ;; esac
    i=$((i + 1))
    ((i < len)) || return 1
  done
  return 1
}

# A word that names one file and nothing more. `.`, `..` and any `..` component name a directory
# (git resolves `..` by text, so `nosuch/../lib` is the whole of `lib/`). A leading `:` is
# pathspec magic (`:/` is the whole tree), a leading `-` is a flag, and a trailing `/` or `/.` is
# a directory. `-d` follows a symlink, so a link to a directory is refused too. The directory test
# reads the guard's own working directory, and so does the question to git below.
names_one_file() {
  case "$1" in
    . | .. | ../* | */../* | */.. | */. | */ | -* | :*) return 1 ;;
  esac
  [ ! -d "$1" ] && git_matches_only "$1"
}

# Whether git, matching the word as `git commit <paths>` does, finds the word itself or nothing,
# and no other path. The guard does not reimplement git's matching; it asks git.
#
# `git commit <paths>` matches each word against the index overlaid with the HEAD tree
# (`list_paths()` in builtin/commit.c), and a word matches every entry below it. Reading only the
# disk missed `rm -r gone` (audit of row 78, round 3); reading only the index missed `git rm -r`,
# `git mv old new` and `git rm -r --cached` (round 4, 2026-10-04): the directory is gone from both,
# is still in HEAD, and the commit records the deletion of every file under it.
# `git ls-files --with-tree=<HEAD>` is that same overlay, read by git's own pathspec code.
#
# The word passes only when git prints nothing (git commit then fails on the word and commits
# nothing) or prints exactly the word, as one line. ls-files prints paths relative to the working
# directory, as the word is written, and the safe alphabet holds nothing git would quote. So
# `./a.ts` and `src//a.ts` are refused: git prints them another way. ls-files is read-only: it takes
# no lock (it answers while another process holds `.git/index.lock`) and never writes the index.
# `git commit --dry-run` was rejected for this reason: it takes `index.lock` for the length of the
# check, so a parallel session's `git add` fails while it runs (measured 2026-10-04).
#
# A new repository has no HEAD, and its first commit is matched against the index alone. That
# branch is taken only when HEAD is a branch that does not exist yet. Any other failure (no git,
# no repository, a HEAD that does not resolve) blocks.
git_matches_only() {
  local out head ref
  command -v git >/dev/null 2>&1 || return 1
  if head="$(git rev-parse -q --verify HEAD 2>/dev/null)"; then
    out="$(git ls-files --with-tree="$head" -- "$1" 2>/dev/null)" || return 1
  else
    ref="$(git symbolic-ref -q HEAD 2>/dev/null)" || return 1
    ! git show-ref -q --verify "$ref" 2>/dev/null || return 1
    out="$(git ls-files -- "$1" 2>/dev/null)" || return 1
  fi
  [ -z "$out" ] || [ "$out" = "$1" ]
}

# The flags `git commit` may carry here, and nothing else. Exact spellings only: git takes any
# unambiguous abbreviation of a long flag, so `--al` is `--all`, and it is refused here because it
# is not on the list. `-a`, `-i`, `-p`, `--amend`, `--allow-empty`, `--pathspec-from-file` and
# every flag not named below fail.
#
# `flag_arity` prints 0 for a flag that takes no value, 1 for one that takes the next word, `m`
# for a message flag that takes the next word and may have it quoted, and nothing for a flag that
# is not allowed. A short cluster such as `-qm` is read letter by letter, as git reads it: a
# letter that takes a value swallows the rest of the cluster, so `-ma` is a message of "a".
flag_arity() {
  case "$1" in
    --only | --quiet | --verbose | --signoff | --no-verify | --no-edit) echo 0 ;;
    --message=* | --file=* | --reuse-message=* | --reedit-message=* | --author=* | --date=* | --trailer=* | --cleanup=* | --template=*) echo 0 ;;
    --message) echo m ;;
    --file | --reuse-message | --reedit-message | --author | --date | --trailer | --cleanup | --template) echo 1 ;;
    --*) ;;
    -?*) short_arity "${1#-}" ;;
  esac
}

short_arity() {
  local w=$1 j=0 c
  while ((j < ${#w})); do
    c=${w:j:1}
    case "$c" in
      o | q | v | s | n) ;;
      m | F | C | c | t)
        if ((j + 1 < ${#w})); then echo 0; elif [ "$c" = m ]; then echo m; else echo 1; fi
        return 0
        ;;
      *) return 0 ;;
    esac
    j=$((j + 1))
  done
  echo 0
}

# Whether the raw words are `git commit`, allowed flags, and at least one named file. A quoted
# word is accepted only as the value of `-m` or `--message`, never as a path, so `'.'` and `""`
# cannot stand in for one. After `--` every word must be a named file.
names_its_files() {
  local i=2 paths=0 rest=no arity
  [ "${raw[0]:-}" = git ] && [ "${kinds[0]:-}" = u ] || return 1
  [ "${raw[1]:-}" = commit ] && [ "${kinds[1]:-}" = u ] || return 1
  while ((i < ${#raw[@]})); do
    case "${kinds[i]}" in
      e) [ "$rest" = no ] || return 1 ;;
      q) return 1 ;;
      *)
        if [ "$rest" = yes ] || [ "${raw[i]}" = - ] || [ "${raw[i]#-}" = "${raw[i]}" ]; then
          names_one_file "${raw[i]}" || return 1
          paths=$((paths + 1))
        elif [ "${raw[i]}" = -- ]; then
          rest=yes
        else
          arity="$(flag_arity "${raw[i]}")"
          case "$arity" in
            0) ;;
            1 | m)
              i=$((i + 1))
              ((i < ${#raw[@]})) || return 1
              [ "${kinds[i]}" = u ] || { [ "$arity" = m ] && [ "${kinds[i]}" = q ]; } || return 1
              ;;
            *) return 1 ;;
          esac
        fi
        ;;
    esac
    i=$((i + 1))
  done
  ((paths > 0))
}

# jq refuses nothing here; it reports whether the command holds a control character other than a
# tab. A newline or carriage return ends a shell command, and a NUL would be dropped by bash when
# it read the command, so the guard would read one text and the shell another.
has_control_char() {
  local answer
  answer="$(printf '%s' "$payload" | jq -r '(.tool_input.command // "") | explode | any(.[]; (. < 32 and . != 9) or . == 127)' 2>/dev/null)" || return 0
  [ "$answer" != false ]
}

# Without jq, `cmd` is the whole JSON payload, which never passes `raw_words`, so a missing jq
# blocks every commit.
if [ "$policy" = agent-commits ] && command -v jq >/dev/null 2>&1 && ! has_control_char &&
  raw_words "$cmd" && names_its_files; then
  exit 0
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

# ---- Commands that throw away uncommitted work (board row 79, 2026-10-04) ----
#
# The rule the wizard writes forbids `git checkout --` and `git stash` to undo an experiment,
# because both reach files another session is working on. This enforces that rule and the other
# spellings of the same act: `checkout .` and `-f`, `restore` of the working tree, `reset --hard`
# and `switch --discard-changes` or `-f`. `stash` is blocked in every form but `list` and `show`,
# because `refs/stash` is shared by every worktree, so `drop`, `clear` and `pop` reach the stash
# of every session. It fires under every commit policy, and in a linked worktree too.
#
# Not blocked, on purpose (the owner's answers of 2026-10-04): `git clean`, which the delete
# guard decided to leave alone; `restore --staged` and a bare `reset`, which unstage and lose no
# content; `stash list` and `stash show`, which only read.

# Whether the shell can turn the word into other words after the guard has read it. The same test
# as `is_literal` below, except that a brace pair is refused only where it expands (it holds a
# comma or `..`), so a reflog name such as `HEAD@{1}` or `@{-1}` still passes.
rewritable() {
  case "$1" in
    *'\'* | *'$'* | *'`'* | *'*'* | *'?'* | *'['*) return 0 ;;
    *'{'*,*'}'* | *'{'*..*'}'*) return 0 ;;
    *) return 1 ;;
  esac
}

# Whether $1 is a long flag git reads as $2. git takes any unambiguous abbreviation, so `--har`
# is `--hard`. $3 is the shortest abbreviation that is unambiguous for this subcommand.
abbreviates() {
  ((${#1} >= $3)) || return 1
  case "$2" in "$1"*) return 0 ;; esac
  return 1
}

# Whether the short cluster $1 holds the letter $2. Letters in $3 take a value, and git reads the
# rest of the cluster as that value, so the scan stops there: in `-bf`, `f` is a branch name.
short_has() {
  local w=${1#-} j=0 c
  case "$1" in --* | -) return 1 ;; -*) ;; *) return 1 ;; esac
  while ((j < ${#w})); do
    c=${w:j:1}
    [ "$c" != "$2" ] || return 0
    case "$3" in *"$c"*) return 1 ;; esac
    j=$((j + 1))
  done
  return 1
}

# `checkout` and `switch` throw away changes with `--` before a path, a whole-tree path, `-f` or
# `--force`, and `--discard-changes`. `-b`, `-B`, `-c` and `-C` take a branch name as a value.
checkout_discards() {
  local i w
  for ((i = $1; i < n; i++)); do
    w=${words[i]}
    case "$w" in -- | . | ./ | :/) return 0 ;; esac
    abbreviates "$w" --force 3 && return 0
    abbreviates "$w" --discard-changes 4 && return 0
    short_has "$w" f bBcC && return 0
  done
  return 1
}

# `restore` writes the working tree unless it is told `--staged` (or `-S`) and not `--worktree`
# (or `-W`). `-s` takes a commit as a value, so `-sS` restores the working tree from `S`.
restore_discards() {
  local i w staged=no
  for ((i = $1; i < n; i++)); do
    w=${words[i]}
    abbreviates "$w" --worktree 3 && return 0
    short_has "$w" W s && return 0
    if [ "$w" = --staged ] || short_has "$w" S s; then staged=yes; fi
  done
  [ "$staged" = no ]
}

reset_discards() {
  local i
  for ((i = $1; i < n; i++)); do
    abbreviates "${words[i]}" --hard 3 && return 0
  done
  return 1
}

# A word the shell can still rewrite blocks, and so does a command reached through `xargs`,
# which adds words the guard cannot see: either could turn `checkout main` into `checkout -f`.
discards_work() {
  local p=$1 s=$2 i
  reached_through_xargs "$p" && return 0
  for ((i = s + 1; i < n; i++)); do
    ! rewritable "${words[i]}" || return 0
  done
  case "${words[s]}" in
    stash) case "${words[s + 1]:-}" in list | show) return 1 ;; esac ;;
    checkout | switch) checkout_discards $((s + 1)) ;;
    restore) restore_discards $((s + 1)) ;;
    reset) reset_discards $((s + 1)) ;;
  esac
}

# Every verb that writes a commit is the owner's, not only `commit` (board row 77, 2026-10-02).
# A form earns a pass only by matching a carve-out exactly; an unknown flag never earns one.
# Every commit blocks here, under every policy. The one commit `agent-commits` lets through has
# already exited 0 above, read on the whole raw command (board row 78).
#
# A subcommand word the shell can still rewrite blocks, whatever it reads as here:
# `git commit${IFS}-am${IFS}x` reaches git as `commit -am x`, and `git {commit,-m,x}` as
# `commit -m x` (the audit of row 78, 2026-10-04, after row 77 left both open).
git_blocks() {
  local p=$1 s=$2
  is_literal "${words[s]:-}" || return 0
  case "${words[s]:-}" in
    commit) return 0 ;;
    push | pull) return 0 ;;
    add) stages_everything $((s + 1)) ;;
    cherry-pick | revert | rebase | am) reached_through_xargs "$p" || ! backs_out $((s + 1)) ;;
    merge) reached_through_xargs "$p" || ! merge_writes_none "$p" "$s" ;;
    stash | checkout | switch | restore | reset) discards_work "$p" "$s" && reason=discard ;;
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

# Which message to print. `git_blocks` sets `discard` when the command throws away uncommitted
# work, because that remedy is `cp`, not the commit ritual.
reason=commit
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

if [ "$reason" = discard ]; then
  cat >&2 <<'MESSAGE'
Blocked: git stash, git checkout -- <path>, git checkout . or -f, git restore, git reset --hard
and git switch --discard-changes reach files another session is working on.

To undo an experiment, copy the file aside with `cp`, then restore it with `cp`.
Do not look for a spelling that passes.
MESSAGE
  exit 2
fi

if [ "$policy" = agent-commits ]; then
  cat >&2 <<'MESSAGE'
Blocked: this command could commit or push work that is not yours.

You may commit, but only the files you name, and only with a commit command that is alone:

  git add <the exact files you changed>
  git commit <the same files> -m "<short message>"

Run each as its own command. Start the commit with `git commit`: no `cd`, no `git -C`, no `env`.
Do not chain it with && or ;. Do not add a pipe, a redirect such as 2>&1, or a # comment.
Name every file. Do not use -a, -i, -p or --amend, and do not put a directory or `.` in place
of files. Put the message in quotes. Inside double quotes, do not put $, a backtick, a
backslash or ! in it. Run `git add -N <file>` first for a new file.

Never push. Never run `git add -A` or `git add .`. Pushing is the owner's.

Cherry-pick, revert, merge, rebase, am and pull write commits that name no files, so they are
the owner's: print the command as one copyable block for the owner to run. To catch up with a
branch, `git fetch` then `git merge --ff-only <branch>` is let through, and so is `--abort`.

Several sessions run in one checkout, and a commit that names no files takes their work too.
Do not work around this by other means.
MESSAGE
  exit 2
fi

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
