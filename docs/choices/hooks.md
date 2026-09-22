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
keep none of their work in git (setup-tracks `DESIGN.md` D21, D25). In a repo those three are
still exactly what is blocked, and the hook prints the two-block ritual. For work that is not
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

**Not caught:** a commit a script makes when you run the script, since the hook sees
`./deploy.sh` and nothing more; a commit written into a heredoc or a file and executed later;
and any git wrapper of your own under a different name. It is a guard against a session
reaching for a commit, not against a determined one.

It needs `jq` on your `PATH`. Without it the hook says so and falls back to matching the raw
payload, which over-blocks — a `grep` for the phrase gets refused. That is the deliberate
direction to fail in: over-blocking costs one message, and a commit you did not make cannot be
taken back out of a checkout your other sessions are working in.

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
`completion-gate.sh` — whichever of the four this run installs — plus a **merge** into
`~/.claude/settings.json` giving each one a `PreToolUse`, `SessionStart` or `Stop` entry. Never
an overwrite: existing hooks are preserved, and duplicate entries are not added. The merge is
shown as a diff, confirmed on its own, and the previous file is backed up.

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

The commit guard goes when you keep nothing in git because it guards `git commit`, `git push`
and `git add -A` and nothing else: on a setup with no git in it, it is a hook that can never fire
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
