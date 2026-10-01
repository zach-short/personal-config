# How your agent talks to you

## What this is

Every reply your agent sends you in chat has a style, and this question decides whether a rule
sets it. The rule on offer is ASD-STE100 Simplified Technical English, a controlled form of English
that the aerospace industry wrote for maintenance documentation, so that a reader whose first
language is not English reads each sentence one way. Its writing rules ask for short sentences, one
word for one meaning, simple tenses in the active voice, and one instruction in each sentence.

The rule this tool writes adds one line that the standard itself does not have: no irony, no
sarcasm and no litotes. Litotes is saying a thing by denying its opposite, such as "not bad" for
"good". A reader who skims a reply between other tasks can take any of the three at face value.

The answer becomes one file, `~/.claude/rules/language-style.md`. Claude Code reads the rule files
in that folder in every session, so the rule applies to every chat reply in every project. It
covers chat replies only. Code, commit messages and the files the agent writes keep the style rules
of their own project, and papers and other documents are outside it.

## The options

**Short and plain.** *Recommended. Writes the rule.*

*The defense.* Agent replies are read in a hurry, between other work, and often on a small screen.
A short sentence that carries one instruction is one you can act on without reading it twice. One
word for one meaning stops a reply from calling the same file by three names, which a reader can
take for three files. And a reply with no irony says what it means: after a failed run, "that went
well" is read as a fact by anyone who skims it.

*The strongest argument against it.* It costs tokens in every session, and it follows a standard
it does not carry. The rendered rule is 894 bytes, about 220 tokens at four bytes a token, read at
the start of every session in every project, whether that session talks to you much or not.
ASD-STE100 is defined by its dictionary of approved words as much as by its writing rules. The rule
names the standard but does not ship the dictionary, so the agent follows the writing rules and
approximates the words. The standard is also English only: a reply in another language gets the
rule's intent and nothing more. Some readers find the style abrupt, and an explanation that needs
one long sentence becomes several short ones that can lose the link between them.

**However it likes.** *Writes nothing.*

*The defense.* You pay nothing for it in any session, and your agent replies in the style it uses
for everyone. If you already keep a chat style rule of your own, a second one would compete with
it. If you like long explanations that keep their reasoning together in one paragraph, this is the
answer that leaves them alone.

*The strongest argument against it.* With no rule, nothing stops long replies, hedged sentences and
figures of speech, and a reader who skims between tasks pays for each one. The irony line goes as
well: a reply can say the opposite of what it means and rely on you to notice.

## What it writes and where

**Short and plain** writes one file, `~/.claude/rules/language-style.md`, with a `personal-config`
stamp on its first line. It holds the five ASD-STE100 lines (short sentences, at most 20 words for
an instruction and 25 for a description; one word for one meaning; simple tenses and the active
voice; no idioms, slang or unclear phrasal verbs; one instruction in each sentence), the line on
irony, sarcasm and litotes, and a sentence saying that code, commit messages and file contents keep
the rules of their own project. It names no other file, and your own `~/.claude/CLAUDE.md` is not
edited.

If a file already sits at that path with no `personal-config` stamp, this tool did not write it,
and the run refuses to replace it. The preview lists the refusal, and the file stays as it is.

**However it likes** writes nothing.

### A profile saved before this question existed

A profile saved before this question existed has no answer for it, and it reads as the recommended
answer, **Short and plain**. So re-running an old profile adds `language-style.md` to the preview.
That is a cost, taken on purpose. This is the first question in this tool whose recommended answer
adds a file to what an older profile writes; every question before it recommends the answer that
leaves the output as it was. The new file is listed in the preview and confirmed with the rest of
the batch, so nothing is written before you can see it. If you re-run to change one other answer,
look for this file in the preview before you accept.

## How to undo it

Delete `~/.claude/rules/language-style.md`. It is one file, and nothing else this tool writes
reads it.

`personal-config undo` restores files the last run replaced, and leaves files it created in place.
So it brings back an earlier version of the rule if a run replaced one, and it does not remove a
rule that a run added. Running setup again and answering **However it likes** does not remove the
file either: that answer plans nothing, and this tool does not delete a file an earlier run wrote.

To keep your own edited version through later runs, delete the stamp on its first line. A file with
no stamp is refused, not replaced, as above.
