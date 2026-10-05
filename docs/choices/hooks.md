# Enforcing a rule with a hook

## What this is

A rule is text in the agent's context; a hook is a script the harness runs whether the agent
agrees or not. This decides whether the commit policy gets teeth, and whether every session
opens with a short reminder of where work is written down.

## The options

**Yes — block the commands that can't be undone.** *Recommended.* A `PreToolUse` hook reads the
command the agent is about to run, refuses it, and prints what to do instead.

**Which commands those are follows your other answers**, which is why the option no longer names
them. Until 2026-09-22 it read *"Yes — block `git commit`, `git push` and `git add -A`"* — the
recommended answer, naming three git commands, shown to a person who had just answered that they
keep none of their work in git (setup-tracks `DESIGN.md` D21, D25). In a repo the hook blocks
those three and every other git verb that writes a commit, which the guard's own section below
lists, and prints the two-block ritual. For work that is not
code, the blocked commands are `rm`, `rmdir` and `unlink`, and the hook asks for the file to be
moved aside rather than removed. If you keep both kinds of work you get both guards — the table
further down says exactly who gets which.

*The defense.* This is the one rule whose violation is hard to undo, and both halves are the
same rule wearing different clothes: a commit you did not make cannot be taken back out of a
checkout your other sessions are working in, and a file deleted out of a folder that is not in
version control has no commit to be restored from. A rule in prose is a rule a session can
reason its way past — under time pressure, or because the task "obviously" wants a commit, or
because a later instruction claimed to supersede it. The hook does not reason. It is also the
difference between a setup that works for you and one that works for someone who has never read
the rule they are relying on.

*The strongest argument against it.* It edits `~/.claude/settings.json`, a file you own and
probably already have hooks in, and a bad merge there breaks every session until you fix it.
That is why the merge is previewed, confirmed, and backed up, and why declining prints the
snippet instead. It also blocks you when *you* asked for the commit, or the delete, which is
annoying the first time and then permanently.

**That, plus a session-start banner.** A `SessionStart` hook reads the repo's
`.personal-config.json` and prints your ledger, your standard and the top `OPEN` board row.

*The defense.* The files only help if sessions read them, and a session that does not know they
exist will not. Three lines at startup is the cheapest way to make the habit automatic.

*The strongest argument against it.* It is three lines of noise at the top of every session,
including the ones where you just want to ask a question. And a banner people learn to skip is
worse than no banner, because it looks like the problem is solved.

**No hooks.** No hook is added to `settings.json`. (The output-style question writes to the same
file, and answering "Act" there still adds its one key — see `output-style.md`.)

## The completion gate, which comes with either option

Both answers above also install a **`Stop` hook**: a script that runs when your agent tries to
end its turn, and refuses the ending if the work looks unfinished. It is not a third option
because it is not a third kind of decision — if you want hooks at all, this is the one that
addresses the complaint people actually have.

*The defense.* The documented failure here is not laziness, it is that **"looks done" is the
only signal an agent has when nothing checks**. A gate is that check. It costs nothing to run —
a shell script spends no context, which is why it is installed on the lighter setup too, where
every other hook is cut for exactly that reason.

*The strongest argument against it.* **A grep-and-run-the-gates script cannot judge intent, only
run checks.** It will not catch work that is shallow rather than visibly unfinished — a function
that is written, compiles, passes, and does the wrong thing sails straight through. And it runs
your gate command on *every* stop, so a repo whose suite is red for a reason you already know
about will argue with you until the cap below ends the turn.

**The cap matters, and it is the reason this is safe to install.** Claude Code overrides a
`Stop` hook after **8 consecutive blocks** and ends the turn with a warning. So the worst case
is an argument, not a lock-out. `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` raises that ceiling if you
want a stricter gate; nothing lowers it, so if 8 rounds of a wrong block is too many, remove the
hook rather than tuning it. The script also reads `stop_hook_active` and stands down when a turn
is already continuing because of it, so it never argues with itself.

## What the gate checks, and what it cannot

**Placeholder markers**, in the source files your working tree has changed — under git that is
what `git status` reports, and in a plain folder it is the directory, minus the usual vendored
trees. Four patterns, chosen small on purpose, because a marker that fires on ordinary text
teaches you to ignore the hook:

| Matched | Why |
|---|---|
| `rest of the file` / `code` / `implementation` / `function` / `method` / `class` | The canonical elision, in each spelling. The broadest of the four. |
| `... existing code ...` | A file summarised instead of edited. |
| `unchanged` / `omitted` / `elided` / `truncated` **for brevity** | The same thing, said politely. |
| `your code here`, `code goes here`, `implementation goes here` | A scaffold handed back with the hole still in it. |

**Deliberately not matched:** `TODO: implement`, because a deferred task is not an unfinished
turn and a line-by-line scan cannot tell them apart; and `not implemented`, because throwing it
is a legitimate idiom for an abstract method.

**Only code files are scanned**, and never one under a `hooks/` directory. These are code
markers, and prose legitimately says "the rest of the file is unchanged" — so scanning `.md`
would flag documents for being documents, including this page.

**Your gate command**, read from `gateCommand` in the repo's own `.personal-config.json` — never
a constant, because one hook has to serve every repo and `bun test` is one repo's answer. It is
written **empty**, because no question knows what proves a change in your repo; Part 0's
adaptation session finds the gates by running them, and writes the one that proves the whole
repo into that key. **An empty value means the gate runs nothing** and never blocks on it. That
is the deliberate direction: a hook that refused every stop because it could not find a command
is a hook you would uninstall before it ever caught anything.

Keep it to one plain command with no quotes inside it — it is read with `sed`, not a JSON
parser. And a suite slower than the hook's 120-second timeout never blocks at all: a killed hook
is a failed hook, not a refusal.

## What the guard catches, and what it does not

It parses the command out of the tool call with `jq` and walks its words, so it is exact about
both halves of the question. **Caught:** `git commit` and `git push` in any form, including
behind git's own options (`git -C . commit`, `git -c user.name=x commit`), after another
command (`ls && git commit`), on a later line, and inside a shell wrapper (`sh -c "git push"`).
`git add -A`, `--all`, `-Av` and `git add .` are caught; `git add <named files>` is not,
because that is the ritual.

Since 2026-10-04 (board row 77) it also catches the six other git verbs that write a commit:
`cherry-pick`, `revert`, `merge`, `rebase`, `am` and `pull`, in all the same forms. Every flag
on them is caught, `-n`, `--continue`, `--skip` and `pull --ff-only` included. Two forms are let
through, because they write no commit and a session needs them. The first is backing out of an
operation: `--abort` or `--quit` on any of the five that take one, while `pull` is always
blocked. The second is the refresh of a stale worktree, `git merge --ff-only <branch>` after a
`git fetch`. `git pull --ff-only` does the same job and is blocked, so the refresh has one
spelling. `gh pr merge` is caught as a push, because it writes a commit on the remote's branch.
`gh` is recognised by name or by full path, and any `merge` after `pr` counts.

The two carve-outs are exact, because a carve-out is where a commit can pass without a sound. A
flag's argument is a word too, so `git merge -m --abort main`, a merge whose message is
"--abort", is caught: every flag beside `--abort` or `--quit` has to be one of them. Beside
`--ff-only` only `-q`, `--quiet`, `-v` and `--verbose` are let through, because git obeys a
later `--no-ff` over `--ff-only` and accepts any unambiguous abbreviation of `--autostash`. An
autostash stashes the whole working tree, other sessions' edits included, and git reads it from
config as readily as from the flag. So before it lets the refresh through, the hook asks git
(`git config --bool merge.autoStash`, in the repo the command names with `-C`) and blocks when it
is set. For the same reason it blocks the refresh behind any of git's global options except
`-C`, which catches `git -c merge.autoStash=true`, and behind a `GIT_*` assignment in the same
command, which can set config from the environment. That check reads only the command in front
of it and the config git finds from the hook's own environment, so the "Not caught" list below
names the ways around it.

A carve-out also has to read each word as git will receive it. The shell can turn one word
into another after the hook has read it: `\--no-ff`, `$(echo --no-ff)`, `{--no-ff,main}`, and a
`*` in a folder that holds a file named `--no-ff` all reach git as the flag that makes a merge
commit. So a word beside `--ff-only`, `--abort` or `--quit` that holds a backslash, `$`, a
backtick, `{`, `}`, `*`, `?` or `[` is blocked. A branch name cannot hold `*`, `?` or `[`, so
`feature/x` and `origin/main` still pass. Neither carve-out holds behind `xargs`, because it adds
the words it reads from its input after the ones the hook can see. `env`, `sudo`, `nohup` and
`time` add none, and `sh -c` hands its extra words only to a `$`, which is already refused.

**Why this guard grew when the delete guard does not.** The delete guard refuses new verbs on
purpose, as its section below says: a list that grows every time someone thinks of a verb is a
list nobody can read. The commit guard's six are not new acts. Each one writes a commit, the one
act this guard exists to keep the owner's, and its message already said "commits and pushes are
the owner's" while it passed them. On 2026-10-01 a session ran `git cherry-pick` on `main`
through the installed guard and made a commit there. The decision is Zach's, of 2026-10-02
(board row 77, option B).

*The strongest argument against it.* The parser grew a check per verb, on bash 3.2, and every
carve-out is a place where a commit could pass without a sound, which is the silent failure this
guard exists to prevent. The guard is also still incomplete, as the next paragraph lists, so
"commits are the owner's" stays a claim about the common cases.

**Not caught:** a commit a script makes when you run the script, since the hook sees
`./deploy.sh` and nothing more; a commit written into a heredoc or a file and executed later;
and any git wrapper of your own under a different name. Three more are pinned passing in
`tests/commit-guard-verbs.test.ts` or named here, so that catching one later is a deliberate
change: `git commit-tree`, plumbing that writes a commit object; `gh api`, which reaches the same
merge endpoint as `gh pr merge`; and a `gh` alias of your own for `pr merge`. Nor does the hook
see a `merge.autoStash` it does not read: one in a repo the command reaches with `cd` rather than
`-C`, since `cd other && git merge --ff-only main` is read as two commands and the config is
asked in the hook's own directory; one exported in an earlier command, as in
`export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=merge.autoStash GIT_CONFIG_VALUE_0=true; git merge
--ff-only main`, or an `export GIT_CONFIG_GLOBAL=<file>` before it; and one in another config
file reached with `HOME=` or `XDG_CONFIG_HOME=` in front of the merge, since only `GIT_*`
assignments are read. The last four are pinned passing. The word walk itself has gaps that pass
plain `git commit` as well, and which the hook did not catch before row 77 either:
`echo commit -m x | xargs git`, `xargs -n 1 git ...`, `xargs` or `sudo` spelled with a path or
given an option that takes an argument (`sudo -u me git rebase main`), a `-C` argument quoted
around a space (`git -C "a b" merge ...`), and `gh${IFS}pr merge 1`. The audit of row 78
(2026-10-04) found two more of the same kind, each of which passes under every commit policy:
`git -c alias.x=commit x -a -m x`, a commit under an alias the command defines for itself, and
`env -u FOO git commit -a -m x`, where an `env` option that takes an argument hides `git` from
the walk. They are open, not settled. Two that were open are caught since row 78: a git
subcommand word holding a backslash, `$`, a backtick, `{`, `}`, `*`, `?` or `[` blocks, so
`git {commit,-m,x}` and `git commit${IFS}-am${IFS}x src/a.ts` are refused. It is a guard against
a session reaching for a commit, not against a determined one.

**Over-blocked:** `gh pr list --search merge`, and anything else with `merge` somewhere after
`pr`. That is the direction to err in, for the reason in the next paragraph.

It needs `jq` on your `PATH`. Without it the hook says so and falls back to matching the raw
payload, which over-blocks — a `grep` for the phrase gets refused. That is the deliberate
direction to fail in: over-blocking costs one message, and a commit you did not make cannot be
taken back out of a checkout your other sessions are working in.

## The commit guard follows your commit policy

Since 2026-10-04 (board row 78) the guard reads your answer to the `commit-policy` question, so
the guard and `~/.claude/rules/commits.md` say the same thing. Before that, a person who let the
agent commit and took this question's recommendation got a rule telling the agent to commit each
slice and a guard that refused every commit. The tool contradicted itself on the question it most
wants to get right.

The answer reaches the guard in a file beside it, `~/.claude/hooks/personal-config/commit-policy`,
which holds one word: `print-blocks`, `agent-commits` or `no-rule`. It is written whenever the
guard is.

- **`print-blocks`** (only you commit): the guard behaves as the sections above describe. Every
  commit is blocked, and the message asks for the two printed blocks.
- **`agent-commits`** (the agent may commit, never push): one plain commit command is let
  through, described below. Every other commit is blocked, and so is everything row 77 blocks.
  The message is different: it tells the agent how to write the one command that passes, never
  to push, and never to run `git add -A`.
- **`no-rule`** (no commit rule): the guard blocks every commit, exactly as it does under
  `print-blocks`, with the same message. The file still says `no-rule`, so your answer is on
  record, and the guard reads that word as `print-blocks`.

*Why `no-rule` blocks every commit.* That answer writes no commit rule, but the person also took
the commit guard, and the guard's own rule is that commits are the owner's. Letting commits
through under `no-rule` would be a commit rule nobody chose. If you want the agent to commit,
answer `agent-commits`. The first build of row 78 read `no-rule` as `agent-commits`; Zach reversed
that on 2026-10-04.

*Why the verbs row 77 added stay blocked under `agent-commits`.* A cherry-pick, a revert, a
merge, a rebase, `am` and `pull` each write a commit that names no file, which is the commit the
`agent-commits` rule itself forbids.

**A missing file means `print-blocks`,** and so does a file the guard cannot read, an empty one,
or one holding any other word. That is the guard's behaviour before the file existed, and it is
the direction to fail in. The guard reads the file by one rule. It drops a trailing carriage
return from each line, so a file saved with Windows line endings still reads. It skips lines
starting with `#`, which is where the stamp sits, and blank lines. Exactly one line must be left,
and commits pass only when that line is exactly `agent-commits`, with nothing around it. Two
words on two lines, a word split across lines, an extra word or spaces around the word all read
as `print-blocks`.

**The one commit `agent-commits` lets through.** The guard decides on the whole command as the
agent wrote it, before it splits anything, and lets it through only when every one of these
holds:

- It starts with the word `git` and then the word `commit`. Nothing comes before `git`: no
  `cd x &&`, no `env`, no variable assignment, no `sh -c`. Nothing comes between the two: no
  `-C <dir>`, no `-c <key>=<value>`, no `--git-dir`.
- Its words are separated by one space or one tab. Two separators in a row, one at the start or
  the end, a newline, a carriage return and every other control character block.
- Outside quotes a word holds only letters, digits and `. _ / @ = + , : -`, and does not start
  with `=`. So `& | ; ( ) < > \ $ # ~ * ? [ ] { } !`, a backtick and an unpaired quote block
  wherever they stand outside a quoted message. That rules out chaining, a pipe, a redirect, a
  comment, any expansion and any glob.
- A quoted string is one whole word, and it is allowed only as the value of `-m` or
  `--message`, as the next word or after `--message=`. Single quotes may hold anything but a
  single quote. Double quotes may not hold `$`, a backtick, a backslash or `!`. Inside quotes the
  shell reads `; & | ( ) < > #` and spaces as text, so a message may hold them.
- Every flag is on this list, spelled exactly: `-o` or `--only`, `-q` or `--quiet`, `-v` or
  `--verbose`, `-s` or `--signoff`, `-n` or `--no-verify`, and `--no-edit`; and, with a value,
  `-m` or `--message`, `-F` or `--file`, `-C` or `--reuse-message`, `-c` or `--reedit-message`,
  `-t` or `--template`, `--author`, `--date`, `--trailer` and `--cleanup`. Short flags combine as
  git combines them (`-qm "fix x"`), a long flag's value may follow `=` or come as the next word,
  and `--` may stand before the files. git takes any unambiguous abbreviation of a long flag, so
  `--al` is `--all`; the guard takes none, so `--al` blocks. `-a`, `--all`, `-i`, `--include`,
  `-p`, `--patch`, `--interactive`, `--amend`, `--allow-empty`, `--pathspec-from-file`,
  `--fixup`, `--squash`, `-e`, `-u`, `-S` and every other flag block.
- At least one file is named, and every word that is neither a flag nor a flag's value names
  one file.

`-C <commit>` and `-c <commit>` stay on the list. They reuse that commit's message and its
author, and stage only the files named, so they cannot commit more than those files; a commit
made with them can carry another person's name as author. git's own `-C <dir>` and
`-c <key>=<value>`, which come before `commit`, are a different pair and always block here.

**What counts as naming a file.** An unquoted word that is not `.` or `..`, has no `..`
component, does not start with `-` or `:`, does not end in `/` or `/.`, and is not a directory,
or a symbolic link to one, in the directory the guard runs in. `.` takes every changed file
below the current directory and `:/` is the whole tree. git resolves `..` by text, so
`nosuch/../lib` and `src/a.ts/../../lib` are both the whole of `lib/`, though no directory
exists at either spelling for a test to find. A word is also refused when git would take more
than the named path for it, counting the index and the last commit (HEAD) as well as the disk.
`git commit <paths>` matches each word against the index with HEAD laid over it, and a word
matches every entry below it. So a directory removed with `rm -r`, `git rm -r`, `git mv` or
`git rm -r --cached` cannot be named: the disk, the index or both no longer show it, HEAD still
does, and the commit would record the deletion of every file under it. To decide, the guard runs
`git ls-files --with-tree=<HEAD> -- <word>` in the directory it runs in, which is that same
overlay read by git's own matching code, and lets the word through only when git prints the word
itself or nothing. A new repository has no HEAD yet, so its first commit is checked against the
index alone. The command is read-only: it takes no lock, works while another process holds the
index lock, and does not write the index. `git commit --dry-run` would answer the same question
more directly, and was not used because it takes the index lock while it runs, so another
session's `git add` in the same checkout fails during that time. A word git prints another way,
such as `./a.ts`, is refused, and so is any word when git cannot answer, as outside a
repository. A deleted file named by its own path, such as `gone/d.ts`, is still allowed, because
it matches exactly one entry. A quoted word is never a file here, so `'.'` and `""` cannot stand
in for one.

*Why the decision reads the whole command.* The first build split the command at `; & | ( )`
and asked whether one piece was a commit that named its files. The shell reads the whole text,
not the piece, and two audits found commands where the two readings differ and git stages more
than the named files: a redirect or a `#` that removes the file word, a `..` path,
`&>/dev/null` followed by `.` or `:/` or `--amend`, a backslash at the end of a line that joins
the next line, and the zsh glob group `s(r)c`. Patching each one would leave the next. So the
allow decision is now made on the entire text, and it accepts one plain shape. Anything a shell
could join, split, expand, redirect or run fails the shape, falls through to the word walk above,
and is blocked, because the walk blocks every commit. An unquoted glob fails the shape, so
neither bash nor zsh can expand a file word into other names.

*The strongest argument against it.* It refuses commands that are safe, so the agent has to
rewrite them: `cd repo && git commit src/a.ts -m "fix x"`, `git -C repo commit ...`, a commit
with `2>&1` on the end, a file name with a space or a character outside the list, a message
holding `$`, and two spaces between words all block. The check of each word holds only at the
moment the guard runs, in the guard's directory. And the guard reads a file on every Bash call,
which is a second file to stamp, preview and undo, and it runs git for each commit command it
might allow: one `git rev-parse` and one `git ls-files` for each named file, and a
`git symbolic-ref` and a `git show-ref` in a repository with no commit yet. That cost is
accepted because only a commit command that already has the allowed shape gets this far, every
other Bash call runs no git at all, and the alternative is a copy of git's path matching inside
the guard, which two audits showed misses cases git does not.

**Not caught under `agent-commits`:** a directory the shell reaches but the guard does not see,
because an earlier command ran `cd` or created the directory after the guard looked, since git
then commits everything below it; a file that holds another session's edits as well as yours,
since naming it commits both; a `git` alias or shell function of your own named `git`; and the
word walk's own gaps listed above, which pass under every policy. The `settings.json` entry does
not change, so an existing install gets all of this from a re-run: the script and the policy file
are rewritten, and the merge adds nothing.

## The commit guard also blocks throwing work away

The commit rule has always said never to `git checkout --` or `git stash` to undo an experiment,
because both reach files another session is working on. Until 2026-10-04 (board row 79) nothing
enforced it, and the guard passed both, and `git reset --hard` with them. It now blocks the rule's
two verbs and the other spellings of the same act, under every commit policy:

- `git stash` in every form but `list` and `show`: `push`, `save`, `pop`, `apply`, `drop`,
  `clear` and a bare `git stash`. Every worktree of a repository shares one stash, so `drop`,
  `clear` and `pop` in one worktree reach the stash another session made in another. For that
  reason the guard fires in a linked worktree too, not only in the main checkout.
- `git checkout -- <path>`, `git checkout <rev> -- <path>`, `git checkout .`, `git checkout :/`
  and `git checkout -f`.
- `git restore <path>`, which writes the working tree. `git restore --staged <path>` passes,
  unless `--worktree` or `-W` is beside it.
- `git reset --hard`.
- `git switch --discard-changes` and `git switch -f`.

A long flag is caught in any abbreviation git accepts (`--har`, `--disc`), and `-f` inside a
short cluster is caught unless a letter before it takes a value, so `git checkout -bf x` makes a
branch named `f` and passes. As with the commit carve-outs, a word the shell can still rewrite
blocks (a backslash, `$`, a backtick, a glob character, or a brace pair holding a comma or `..`),
and so does a command reached through `xargs`. A reflog name such as `HEAD@{1}` or `@{-1}` holds
no comma and passes. The message is its own, because the remedy is not the commit ritual: copy
the file aside with `cp`, then restore it with `cp`.

**Let through, on purpose:** `git stash list` and `git stash show`, which only read; `git restore
--staged` and a bare `git reset`, which unstage and lose no content; and `git clean`, which is
the delete guard's decision, below, and stays its own.

**Why this grew when the delete guard does not.** The list is not new verbs found by objection.
It is the two verbs a written rule already forbids, and the other spellings of the same command,
which is the lesson in the guard's own history: `git -C . commit` passed while `git commit` was
blocked. The decision is Zach's, of 2026-10-04 (board row 79, option A).

*The strongest argument against it.* The delete guard said no to growing for a reason, and
`reset --hard`, `restore` and `switch -f` are not on the rule's list, so "bounded by the rule" is
a line this decision drew and the rule did not. It also makes the commit guard a guard for more
than commits, and it blocks a session's undo of its own experiment, which is safe when the
session is alone in the checkout.

**Not caught:** `git checkout <path>` and `git checkout <rev> <path>` without `--`, since the
guard cannot tell a path from a branch without asking git; `git reset --merge` and `--keep`;
plumbing such as `git read-tree -u` and `git apply -R`; a git alias of your own for any of the
above; and an editor or a redirect that writes over a file.

## What the delete guard catches, and what it does not

If your work is not code, the same hook mechanism guards the step that is irreversible for you.
A repo's dangerous command is a commit; a folder's is a delete, because there is no checkout to
take the file back out of.

**Caught:** `rm`, `rmdir` and `unlink`, in every form the commit guard sees `git commit` in —
behind `sudo`, after another command (`ls && rm notes.md`), on a later line, inside a shell
wrapper (`sh -c "rm notes.md"`), with the binary spelled out (`/bin/rm`), behind an environment
assignment, and fed through `xargs`, which is the common shape (`find . -name '*.tmp' | xargs
rm`). It is the same parser, copied rather than rewritten, so what one guard sees the other sees.

**Not caught:** `find -delete`, `git clean`, a redirect that truncates a file (`> notes.md`),
`mv` over a path that already exists, and any script that deletes when you run it — the hook
sees `./tidy.sh` and nothing more. **This is a decision and not an oversight.** A guard that
grows a new verb every time someone thinks of one becomes a list nobody can read or trust, and
the three verbs above are the ones a session actually reaches for. The tests assert that these
pass, so adding one later is a change someone makes deliberately against a red test.

**Over-blocked, and you should know about it:** a newline separates commands as far as the
parser is concerned, so a heredoc whose *body* happens to contain the word `rm` — writing a
document that talks about deleting something, say — is refused along with the real thing. That
direction is deliberate: a guard that errs is one you notice, and the alternative is a parser
that can be talked past by quoting.

So: it is a guard against a session reaching for a delete, not against a determined one, and it
is worth exactly that. What it buys is that the common case now costs the agent a refusal and a
sentence telling it to move the file aside — into the Trash, or beside itself with the date in
its name — and to say where it put it, so you can undo it without searching.

**It does not guard against a file being overwritten**, only against one being removed. If that
matters to you, the thing to know is that it is not covered here and not covered by your harness
either — a check of this on 2026-09-22 found that an agent could overwrite a file it had never
read. Keep anything you cannot lose in git, or in a backup you control.

## What it writes and where

`~/.claude/hooks/personal-config/commit-guard.sh`, `delete-guard.sh`, `session-banner.sh` and
`completion-gate.sh` (whichever of the four this run installs) and, beside the commit guard,
`commit-policy`, the one word the guard reads (see "The commit guard follows your commit
policy" above). Plus a **merge** into
`~/.claude/settings.json` giving each one a `PreToolUse`, `SessionStart` or `Stop` entry. Never
an overwrite: existing hooks are preserved, and duplicate entries are not added. The merge is
shown as a diff, confirmed on its own, and the previous file is backed up.

One more entry can come from a later question, for work that is not code: the answer **Every
document it saves** to the `write-doc-check` question adds a `PostToolUse` entry that runs the
`/write-doc` check script on every save. `write-doc.md` describes it, and how to remove it.

**Your answer here is not the only input.** Two earlier answers also decide — what kind of work
you do, and whether you keep it in git — because the guards protect things you may have already
said you do not have:

| What you work on | Your setup | What is installed |
|---|---|---|
| Code, kept in git | The fuller one | Exactly what you picked, plus the completion gate. |
| Code, kept **nothing** in git | The fuller one | The commit guard is **not** installed, whichever option you picked. A banner still is, if you picked one, and the completion gate always is. |
| Work that is not code | The fuller one | The **delete guard**, plus the completion gate, plus a banner if you picked one — and the commit guard as well if you keep some of your work in git. |
| Code | The lighter one | The completion gate **only** — no guard, no banner — whichever option you picked. |
| Work that is not code | The lighter one | The **delete guard** and the completion gate. No commit guard, no banner. |
| Anything | Either, "No hooks" | Nothing. No script, no entry. |

The commit guard goes when you keep nothing in git because it guards only the commands that
write or push a commit and `git add -A`, and nothing else. Each git command among them needs a
repository. `gh pr merge` does not, since `gh pr merge 26 -R owner/repo` names its repository on
GitHub, but it merges a pull request, and a setup with no git in it has none to merge. So there
it is a hook that will not fire
and a `settings.json` entry you would have to read the script to explain. The completion gate
stays on every setup, because what it checks — unfinished markers and your own proof command —
has nothing to do with git; where there is no repository to ask, it walks your project folder
instead.

**The delete guard is keyed on the kind of work, not on git, and that is deliberate.**
`settings.json` is one file for all your sessions, so the guards have to be right for everything
you do at once. If you keep documents in a folder *and* code in repos, you get the delete guard
for the folder and the commit guard for the repo — both are yours. Keying it on the git question
instead would take it away from exactly the person who has both.

**It is the one guard the lighter setup gets.** The lighter setup drops the commit guard because
that guard is specific to git, and this one is not; the argument that cut the others — that they
cost you context — does not apply to a shell script, which costs none. So the smallest setup
this tool writes still refuses a delete.

> **Changed on 2026-09-22, and the old sentence kept here rather than deleted (R5).** This
> section used to say that **nothing is installed in the commit guard's place** — that a setup
> with no git in it had ways to lose work this tool did not guard, and that what such a guard
> should stop was an open question. That was true when it was written and is the gap the delete
> guard now fills. The slot is no longer empty, and the question is no longer open.

> **Wrong until 2026-09-22, kept here rather than deleted (R5).** This section used to say the
> scripts were "whichever of the three your answer installs", and named the git question only in
> passing, as the *lighter* setup's reason for dropping the guard. Both halves misled: the answer
> to this question was not the only input even then, and the git answer — the one the sentence
> pointed at — was the input the code never read. A person who answered that they keep no work in
> git and then took this question's recommendation, because it is the recommendation, had a
> `PreToolUse` hook installed over a tool they do not use. Corrected in the code and here on
> 2026-09-22 (board item 55); `tests/hooks.test.ts` pins every row of the table above.

> **Wrong from 2026-10-04, kept here rather than deleted (R5).** Two sentences on this page named
> the commit guard's whole list, and board row 77 made both short. The option's paragraph said
> "In a repo those three are still exactly what is blocked", meaning `git commit`, `git push` and
> `git add -A`. This section said the commit guard goes on a setup with no git "because it guards
> `git commit`, `git push` and `git add -A` and nothing else". From 2026-10-04 the guard also
> blocks `cherry-pick`, `revert`, `merge`, `rebase`, `am`, `pull` and `gh pr merge`, on Zach's
> answer of 2026-10-02. Both sentences are corrected in place. The reason the guard leaves a
> setup with no git is unchanged: every git command it blocks still needs a repository, and
> `gh pr merge`, which does not (`-R owner/repo` names one on GitHub), merges a pull request that
> a setup with no git does not have.

## How to undo it

`personal-config undo` restores the previous `settings.json`. Or remove the entries by hand and
delete the scripts: `SessionStart` is the banner, `Stop` the completion gate, and **`PreToolUse`
is the guards — there may be two of them**, both matching `Bash`, and the `command` line of each
names the script it runs, so read that to tell the commit guard from the delete guard. Removing
one leaves the other working. Removing just the `Stop` entry leaves the guards working, which is
the one to reach for if the gate argues with you about a repo whose gates you already know are
red.

**Undo only what you were given.** The table above decides which of the four entries exist, so on
a setup that keeps nothing in git there is no commit-guard entry, and on a code setup there is no
delete-guard entry — an absent entry is this run's doing, not a failed install.
Going the other way is a two-line edit rather than a re-run: copy the script you want into
`~/.claude/hooks/personal-config/`, `chmod +x` it, and add a `PreToolUse` entry matching `Bash`
that runs it, beside any entry already there rather than inside it. Answering the earlier
questions differently and re-running `setup` does the same thing, and changes every other
document too.

To keep the gate but stop it running your suite, clear `gateCommand` in that repo's
`.personal-config.json`: the placeholder scan still runs, and nothing else does.

To make the commit guard block every commit again whatever your commit policy, delete
`~/.claude/hooks/personal-config/commit-policy`, or make `print-blocks` or `no-rule` the one
line in it that is neither blank nor a `#` comment. A re-run of `setup` writes your answer back,
so change the answer too if you want it to stay. `personal-config undo` restores the file, or
removes it, as it was before the run.
