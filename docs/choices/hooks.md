# Enforcing a rule with a hook

## What this is

A rule is text in the agent's context; a hook is a script the harness runs whether the agent
agrees or not. This decides whether the commit policy gets teeth, and whether every session
opens with a short reminder of where work is written down.

## The options

**Block `git commit`, `git push` and `git add -A`.** *Recommended.* A `PreToolUse` hook reads
the command the agent is about to run, and refuses those, printing the two-block ritual to the
agent instead.

*The defense.* This is the one rule whose violation is hard to undo. A rule in prose is a rule a
session can reason its way past — under time pressure, or because the task "obviously" wants a
commit, or because a later instruction claimed to supersede it. The hook does not reason. It is
also the difference between a setup that works for you and one that works for someone who has
never read the rule they are relying on.

*The strongest argument against it.* It edits `~/.claude/settings.json`, a file you own and
probably already have hooks in, and a bad merge there breaks every session until you fix it.
That is why the merge is previewed, confirmed, and backed up, and why declining prints the
snippet instead. It also blocks you when *you* asked for a commit, which is annoying the first
time and then permanently.

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

## What it writes and where

`~/.claude/hooks/personal-config/commit-guard.sh`, `session-banner.sh` and
`completion-gate.sh` — whichever of the three your answer installs — plus a **merge** into
`~/.claude/settings.json` giving each one a `PreToolUse`, `SessionStart` or `Stop` entry. Never
an overwrite: existing hooks are preserved, and duplicate entries are not added. The merge is
shown as a diff, confirmed on its own, and the previous file is backed up.

The lighter setup installs the completion gate **only** — no commit guard, because that one is
git-specific and whether you use git is its own question, and no banner.

## How to undo it

`personal-config undo` restores the previous `settings.json`. Or remove the entries by hand and
delete the scripts: the `PreToolUse` entry is the commit guard, `SessionStart` the banner, and
`Stop` the completion gate. Removing just the `Stop` entry leaves the other two working, which
is the one to reach for if the gate argues with you about a repo whose gates you already know
are red.

To keep the gate but stop it running your suite, clear `gateCommand` in that repo's
`.personal-config.json`: the placeholder scan still runs, and nothing else does.
