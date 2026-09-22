# What the agent must not read or copy

## What this is

One line naming anything in this project an agent should keep out of — a folder, a file, a kind
of document. It is asked once for each project you set up, because the answer is a property of
the work and not of you, and leaving it empty is a complete answer.

It is the only question here about harm to somebody other than you. A folder of non-code work
is far likelier than a code repository to hold other people's material: client records, someone
else's figures, a file you were sent rather than one you wrote. Until this question existed,
nothing in this tool asked.

It is asked only when you have said your work is not code. A code repository already has
conventions for this — `.gitignore`, `.env`, files that are not checked in — and a line
restating them would add nothing.

## What makes a good answer

Name a place, not a category. *"the client-records folder"* is something an agent can act on;
*"anything confidential"* is a judgement it will have to make on your behalf, which is the thing
you were trying to avoid. A path, a folder name, or a filename pattern is best.

One answer, one place. If there are two, name the one that would matter most — and consider
whether the material should be in this folder at all, which is a better fix than a rule.

## The defense

An agent asked to work in a folder will look around it. The document it reads first is the
router this tool writes, and the line goes in the section that tells it what never to do — so
it is read before the folder is touched, which is the only moment at which a rule like this can
work. One named place is more than the nothing you get from a question never asked.

## The strongest argument against it

**A rule is not a guard, and this is the boundary where that matters most.** A single search
across the folder reads the material before any rule is consulted, and nothing here stops it. A
path named once, at setup, leaves the next sensitive file unnamed — and a blank text box is
the screen most people skip.

All three are true. What can be said for it is that the alternative on offer is nothing at all,
that the rule is read early rather than late, and that there is a real enforcement mechanism
this can grow into: an agent's settings can refuse to read a path outright, and this answer is
the input that would need. That is deliberately not built yet — it means writing to a second
file in your project, with its own preview and its own undo — and it is not worth wiring until
the question has shown that people answer it.

Treat the line as a statement of intent that an agent will honour, not as a lock. If the
material must not be readable, move it out of the folder.

## What it writes and where

Two things, and only when you name something:

- a line in the project's router under *Never do this*, beside the rule about commits;
- a row in the project's ledger, in the table of facts about the project, under the row saying
  what proves work here is sound.

Left empty it writes nothing at all — no line, no row, and no sentence saying nothing was
named. That is different from the proof-line question, whose empty answer leaves a note saying
it is not yet written: writing a proof line is a job somebody still has to do, and having
nothing off limits is not a job.

The answer is saved with that project's other answers and covered by the stamp on its generated
files, so changing it and re-running the tool re-renders them.

## How to undo it

Re-run `personal-config setup` in that project and give a different line, or an empty one to
remove it; the line and the row disappear together. Nothing else depends on the wording, so
there is no other file to clean up. `personal-config undo` restores anything an accepted run
overwrote.
