# Help writing documents you can stand behind

## What this is

When the work is not code, the documents are the work: a paper, a report, a proposal, a README.
This question decides whether your agent gets `/write-doc`, a skill for writing them. It is asked
only when you answered that your work is something other than code, and only when you also
answered that the workflow skills are installed. Under **None** for the workflow skills, that
answer promises that nothing is written to `~/.claude/skills/`, and this skill would break the
promise, so the question is skipped.

A second question follows a yes when you also allowed hooks: whether the skill's check also runs
on every document your agent saves, or only on what `/write-doc` writes. Both questions share this
page, and the second one has its own section below.

The skill runs ten steps in order. It reads a style file, fixes the brief, plans the argument, and
then labels every claim in the plan by where it comes from: a source it can open, something you
said, or a claim only you can make. A claim of the third kind is a thing you saw, did or measured,
or a view the document states as yours. The skill asks you for every one of those in one message
before it drafts, and it does not fill a gap with a guess or with someone else's description
presented as yours. Then it drafts, reviews the draft against the style file, checks that every
source it used is cited and every citation has a source, saves the file, and runs a check script on
the saved file. It reports back with the file path and which claims came from where.

The style file bans em dashes, contractions, litotes and irony, and lists the words and sentence
shapes that readers now take as signs of machine writing. The word list comes from two sources: the
Wikipedia guide "Signs of AI writing", and the study by Kobak and colleagues of excess vocabulary in
15 million PubMed abstracts.

## The options

**Yes, install /write-doc.** *Recommended. Writes one folder of three files.*

*The defense.* The failure this skill exists for is not bad prose. It is a document under your name
that reports something you did not see, or states a view you do not hold, and reads well enough
that nobody catches it. Better prose cannot fix that, and good prose hides it from the one reader
who could. The provenance step is the part no style rule supplies: it makes the agent ask you
before it writes a first-hand claim. The check script then catches what a reread misses on the
saved file, and it says so when it could not check, rather than reporting a pass. The style file is
read only when the skill runs, so a session that writes no document pays nothing for it.

*The strongest argument against it.* The skill asks questions, and a person who wanted a quick
draft gets a list of claims to confirm first. On a reflection or a personal statement, most of the
document needs you, and the skill asks for your notes before it writes anything. Its description
also fires on ordinary requests: "write a README" or "draft a report" starts the full ten steps,
whether you wanted them or not. The style rules address what a human reader notices, and they do
not lower the score an AI detector gives a draft. One person's worked example, from the author of
this tool: a draft that passed every rule and the check script scored 100% AI on GPTZero, with no
flagged words or patterns. The script itself needs `perl`, and a Word file needs `textutil`, which
ships with macOS only; on another system it refuses a Word file and says why, and the skill then
cannot check it.

**No.** *Writes nothing.*

*The defense.* You write your own documents, or you already have a writing setup you trust, and a
second set of rules would compete with it. Nothing is added to `~/.claude/skills/`, and no request
to write a document starts a ten-step ritual.

*The strongest argument against it.* With no skill, nothing asks you before a first-hand claim goes
into a draft. An agent asked for a reflection will write one, in your voice, about things you never
told it, and the result can read well. Nothing checks the saved file for the marks readers now take
as machine writing.

## What it writes and where

**Yes, install /write-doc** writes one folder, `~/.claude/skills/write-doc/`, with three files:

- `SKILL.md`, the skill. A `personal-config` stamp sits below its frontmatter, because Claude Code
  reads a skill's frontmatter only when `---` is the first line. Its last step reports to you in
  ASD-STE100 when your answer to how your agent talks to you was **Short and plain**, and in plain
  form when it was not.
- `style.md`, the writing rules the skill reads in its first step. It covers written work only.
  Chat replies are outside it.
- `check.sh`, the check script, written executable. Run as `check.sh check <file>`, it checks the
  file for em dashes, contractions, and the banned words and phrases, and ignores fenced and inline
  code for the last two. It prints `PASS` and exits 0 only when all three checks ran on text it
  read from the file. It exits 1 with one line per problem it found. It exits 2, prints the reason
  and never prints `PASS` when it could not check: a tool it needs is missing, the file is missing
  or unreadable, the file type is not one it reads, a Word file does not start the way that format
  does, or nothing was read. It reads `.md`, `.mdx`, `.txt`, `.rst`, `.tex`, `.adoc`, `.docx`,
  `.doc`, `.rtf` and `.odt`. It runs under bash 3.2, the version macOS ships.

No rule is added to `~/.claude/rules/`, so sessions that never write a document pay nothing for
the style. Whether anything is added to `~/.claude/settings.json` is the follow-up question's
answer: under **Only what /write-doc writes** nothing is, and the check runs when the skill's last
step runs it and on nothing else.

If you already keep a `SKILL.md` of your own at that path with no `personal-config` stamp, the run
refuses to replace it, and the preview lists the refusal. The other two files are new paths and are
written beside it. The preview shows the refusal and the two new files together, and the confirm
covers the whole batch, so look for this before you accept.

**No** writes nothing.

### When the question is not asked

The skill is rendered only for non-code work with the workflow skills installed, whatever answer is
saved. An answer of **Yes** saved on a run for non-code work stays in your saved answers; a later
run that answers that the work is code renders no skill folder, and neither does a later run that
answers **None** for the workflow skills.

### A profile saved before this question existed

A profile saved on a non-code run before this question existed has no answer for it, and it reads
as the recommended answer, **Yes, install /write-doc**. So re-running such a profile adds the
skill folder to the preview. That is a cost, taken on purpose: on this track the documents are the
work, and recommending **No** on the only track that sees the question would argue against asking
it. The three files are listed in the preview and confirmed with the rest of the batch, so nothing
is written before you can see it. None of the profiles this tool ships is for non-code work, so
none of them changes.

## The follow-up: when the check runs

**Should your agent check every document it saves, or only what /write-doc writes?** It is asked
after a yes to the skill, and only when your answer to the hooks question was not **No hooks**,
because that answer promises that nothing is added to `~/.claude/settings.json`.

**Only what /write-doc writes.** *Recommended. Adds nothing.*

*The defense.* The skill's last step already runs the check on what the skill writes, so the
documents you asked to be written with care are checked. Nothing in `~/.claude/settings.json`
changes, and nothing follows the saves you did not ask to be styled: a scratch note, a quotation
that keeps its source's punctuation, a file written in another house style.

*The strongest argument against it.* A document the agent writes without the skill is never
checked. That is most of what an agent saves in a working day: a step added to a ledger, a README
changed as a quick fix, notes taken partway through a task. And even under the skill, the check
runs only when the agent reaches the last step and runs it.

**Every document it saves.** *Adds one hook entry.*

*The defense.* The check stops depending on the skill, or on the agent remembering its last step.
Every time the agent saves a `.md`, `.mdx`, `.txt`, `.rst`, `.tex` or `.adoc` file with Write or
Edit, Claude Code runs `check.sh hook` on the text it just saved, and shows the agent each problem
it finds in the same turn, while the text is still in front of it. The hook is a shell script, so
it costs a session no context until it has something to report.

*The strongest argument against it.* It fires on every prose file the agent saves, including the
ones where an em dash or a contraction is right: a quotation, dialogue, a file kept in someone
else's style. The agent will try to rewrite them, and the only files skipped are the ones this tool
generated. It cannot stop a save, because Claude Code runs it after the file is written; it can
only tell the agent, who then has to edit the file again. It reads only the text just saved, so an
edit that leaves an old em dash elsewhere in the file passes. It does not read Word files. And it
edits `~/.claude/settings.json`, a file you own, in a way a later run cannot take back: see the
undo below.

### What the follow-up writes

**Only what /write-doc writes** writes nothing beyond the skill folder.

**Every document it saves** merges one entry into `~/.claude/settings.json`, beside any you
already have:

```json
"PostToolUse": [
  { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "<home>/.claude/skills/write-doc/check.sh hook" }] }
]
```

`<home>` is your home directory, written out in full. The merge is previewed, confirmed and backed
up like every other change to that file, and a second run adds no second entry. The entry runs the
same `check.sh` the skill runs, in its `hook` mode:

- It reads which file was saved, and the new text, from what Claude Code sends the hook: the whole
  text of a Write, or the replacement text of an Edit. It checks only the six types above and
  ignores every other file.
- It skips a file that carries a `personal-config` stamp on the line where this tool puts one. That
  is how the ledger, the router and the short standard this tool generates, which use em dashes,
  stay out of its way. A stamp quoted anywhere else in a file does not count.
- When it finds a problem it exits 2 with the problems on its error output, which is the one
  answer Claude Code shows the agent after a save. It never prints `PASS`.
- It needs `jq` to read what Claude Code sends. Without `jq` it cannot tell which file was saved,
  so after every Write and Edit, of any file, it tells the agent that nothing was checked, until
  `jq` is installed or the entry is removed. `check.sh check FILE` needs no `jq` and still works.

### When the follow-up is not asked

It is not asked for code work, after a **No** to the skill, under **No hooks**, or under **None**
for the workflow skills. The entry follows the same conditions on every run, whatever answer is
saved: an answer of **Every document it saves** from an earlier run adds no entry on a run where
the skill folder is not planned or hooks are off, because the entry runs a script inside that
folder. A profile saved before the question existed reads **Only what /write-doc writes**, which
adds nothing.

## How to undo it

If you answered **Every document it saves**, remove the hook entry first. Open
`~/.claude/settings.json`, find the entry under `PostToolUse` whose `matcher` is `Write|Edit` and
whose `command` ends in `write-doc/check.sh hook`, and delete that entry alone. Then delete the
folder `~/.claude/skills/write-doc/`. The order matters: with the folder gone and the entry left in
place, Claude Code fails to run the hook after every Write and Edit, and your transcript shows a
hook error each time. Under **Only what /write-doc writes** there is no entry, and deleting the
folder is the whole undo. Nothing else this tool writes reads the folder.

`personal-config undo` restores files the last run replaced, and leaves files it created in place.
So it removes the entry only when the run that added it was your last one and `settings.json`
existed before it, and then it also takes back anything else that run merged into the file. It
never removes the skill folder. Running setup again does not undo either one: an answer of **No**,
or of **Only what /write-doc writes**, plans nothing to remove, and this tool does not delete a file
or an entry an earlier run wrote.

To keep your own edited version of `SKILL.md` through later runs, delete the stamp below its
frontmatter. A file with no stamp is refused, not replaced. `style.md` and `check.sh` carry their
own stamps, on their first and second lines, and the same holds for each.
