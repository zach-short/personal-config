# Who picks the words a user reads

## What this is

A paragraph in Part 11 of your repo's copy of the working standard — the part that holds your
own policy rather than craft, and the part the standard itself marks as editable — saying who
decides the words a user sees on screen. The agent reads it before proposing any user-facing
text.

## The options

**You do — the agent offers 2–3 variations in different registers.** *Recommended.* Plain,
warm, terse. For example: *"Couldn't save"* / *"That didn't go through — try again"* /
*"Save failed"*.

*The defense.* Copy is a product decision wearing code's clothes. It is the part of the work
users actually read, it is cheap to decide and expensive to notice later, and an agent
genuinely cannot know your product's voice. Showing registers rather than a single suggestion
makes the decision take five seconds instead of prompting a rewrite.

*The strongest argument against it.* Three variations for every string is a lot of
interruptions, and most strings do not deserve one — nobody needs to deliberate over the label
on a Cancel button.

**The agent picks and tells you what it chose.**

*The defense.* The work does not stop, and the copy is right there in the diff where you can
change it in one edit.

*The strongest argument against it.* Copy that is already written gets reviewed as *acceptable*
rather than *chosen*, and acceptable copy is how a product ends up sounding like nothing.

## The qualifier both options carry

**Check first whether it is already settled.** Re-opening decided copy wastes your time and is
a common way for an agent to relitigate something you already answered.

## What it writes and where

A paragraph in Part 11 of the standard copy — the part the standard itself marks as editable
preference.

## How to undo it

Edit Part 11, or re-run `setup`.
