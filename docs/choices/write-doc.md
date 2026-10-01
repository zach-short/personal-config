# Help writing documents you can stand behind

## What this is

When the work is not code, the documents are the work: a paper, a report, a proposal, a README.
This question decides whether your agent gets `/write-doc`, a skill for writing them. It is asked
only when you answered that your work is something other than code, and only when you also
answered that the workflow skills are installed. Under **None** for the workflow skills, that
answer promises that nothing is written to `~/.claude/skills/`, and this skill would break the
promise, so the question is skipped.

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

Nothing else changes. No rule is added to `~/.claude/rules/`, so sessions that never write a
document pay nothing for the style, and no hook is added to `~/.claude/settings.json`: the check
runs when the skill's last step runs it, and on nothing else.

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

## How to undo it

Delete the folder `~/.claude/skills/write-doc/`. Nothing else this tool writes reads it.

`personal-config undo` restores files the last run replaced, and leaves files it created in place,
so it does not remove a skill folder that a run added. Running setup again and answering **No**
does not remove it either: that answer plans nothing, and this tool does not delete a file an
earlier run wrote.

To keep your own edited version of `SKILL.md` through later runs, delete the stamp below its
frontmatter. A file with no stamp is refused, not replaced. `style.md` and `check.sh` carry their
own stamps, on their first and second lines, and the same holds for each.
