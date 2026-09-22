# Who makes changes to a document

## What this is

A paragraph in your working standard's preferences section — the part that holds your own
policy rather than craft, and the part the standard itself marks as editable — saying what an
agent does when the work it has been given is a change to one of your documents.

It is the counterpart of the question a programmer is asked about who runs `git commit`. In a
repository, the commit is the step that is hard to take back, and there is a whole question
about who takes it. For work that is not in a repository there is no commit, and the step that
is hard to take back is the edit itself: a file changed in place has no earlier version to
return to, and a folder is one deletion from gone.

It is asked only when you have said your work is not code. A programmer already answers the
commit question, and a document inside a repository has its history to fall back on.

## The options

**The agent edits, and names every change.** *Recommended.*

*The defense.* The complaint this whole tool exists to fix is an agent that replies with a plan
instead of doing the work, and the alternative below makes that the rule. Meanwhile the thing
the alternative is really asking for — a look before anything changes — you already have
without writing it down: the agent's own tooling asks before it writes to a file, and refuses
to overwrite a file it has not read in that session. What no setting gives you is the *ritual*
around an edit, and that is what this writes: change the file, then say which files changed
and, for each, which section and what it said before. Never delete a document. Never overwrite
one the session has not read — move the old one aside, dated, and say where it went.

*The strongest argument against it.* Every other recommendation in this tool puts the
irreversible step with you, and this is the one place it does not. Consistency is worth
something, and a rule that says "go ahead and edit" is a rule you have to trust the rest of the
paragraph to make safe. If your documents are records rather than drafts — things whose earlier
wording is the point — the next option is the honest answer and you should take it.

**Show me first — I make the change.**

*The defense.* Nothing changes without you. The agent writes the new wording in chat, in full,
and you put it in; you see every word before it lands, in the only way that cannot fail. It
holds whether or not the work is in version control, because you asked for the step and not for
the history.

*The strongest argument against it.* It is the "replies with a plan instead of doing the work"
failure, written down as policy. On a long document, copying wording out of chat by hand is
slower and more error-prone than the edit would have been, and the step you added to catch
mistakes is itself a place to make them.

**No rule.**

*The defense.* Nothing is written, and the agent behaves the way it would anyway — which, in
the default setup, already means asking before it writes to a file.

*The strongest argument against it.* You get the tooling's protection and none of the ritual:
no record of what changed, and nothing that says an old version is moved aside rather than
overwritten.

## A worked example

*One person's case, recorded here rather than in the question text, because the question is
general and this is not.* Somebody keeping a small set of books asked an agent to correct a
figure in last month's summary. The figure was corrected and three sentences around it were
reworded at the same time, and nothing said so. The correction was right; the rewording lost a
caveat that had been put there deliberately. The recommended answer is written for exactly that:
the change may be made, and the hand-back has to say what the paragraph said before.

## What it writes and where

One paragraph in the preferences section of the working standard written into your project. The
answer is also saved with that project's other answers, so re-running the tool keeps it.

Nothing is written for the third option, and nothing is written on a code track at all — a
programmer is never asked this question, so there is no answer to render.

## How to undo it

Edit the paragraph out of the standard — it is yours, and the section says so — or re-run
`personal-config setup` in that project and give a different answer. `personal-config undo`
restores whatever an accepted run overwrote.
