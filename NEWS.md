<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: 0BSD
-->

# What's new

Plinky has no version numbers and no release days — every change goes live the moment
it's ready. This is what's changed, newest first, in plain terms.

## 2 August 2026

**Help items with a stray space now appear.** A help item is filed under the page it
belongs to. If that page name was typed with a leading or trailing space, the item was
published but shown on no page at all — and nothing anywhere reported it missing. The
name is tidied up as it's saved, so an item written that way turns up where it should.

**A run can't start after you've stopped it.** Sight-reading gives you a moment to take
the piece in before the run begins. Leaving the page during that pause could let the
run start anyway, a moment after you'd gone. The pause is now cancelled along with
everything else when you leave.

## 1 August 2026

**A corrupt MIDI file can no longer freeze the tab.** A malformed `.mid` could send the
reader into a loop it never came out of, and the page would simply stop — no error, no
way back except closing it. Lengths inside the file are now bounded, so a file like
that is rejected and the app keeps going.

**Imports and share links are checked for size, not just shape.** A shared run, an
imported score and a restored backup all arrive from outside Plinky. Each was checked
for being well-formed, which says nothing about how much memory the next step will ask
for. Each is now sized first.

**An unknown licence reads as unknown.** A handful of unusual licence names resolved to
an empty answer that still looked like a real one, so a piece could show a credit badge
with no text and no link — and an exported video could burn that credit into the
picture. An unrecognised licence is now treated as unrecognised, and says so.

**Exercise names match the exercise.** The dials on a generated exercise aren't all
independent: an inversion means nothing to a scale, a double stop nothing to an
arpeggio. Those settings were ignored when the music was generated but still went into
its name, so the same exercise could exist under two names with two separate mastery
records — and the title could advertise thirds the score doesn't contain. A name now
carries only the settings that shaped it.

**Marks sheets can't run what a student wrote.** A report exported for a teacher is
built from data a student's device produced. Spreadsheets treat a cell starting with
`=`, `+`, `-` or `@` as a formula, so that text could have been executed on opening.
Those cells are now neutralised.

## 31 July 2026

**The first six things about a piano.** Everything else in Plinky assumes you already
know that the black keys come in twos and threes, that the white ones repeat, and that
a dot on a staff means one particular key under your hand. None of that is obvious, and
none of it was written down. `/basics` is that missing first hour, cut to the six facts
you can't play a note without — and it's the first thing on the Getting started
checklist, the only step needing no piano, no cable and no reading.

Each step ends in a press, because reading about a keyboard teaches nobody. The first
four need no notation at all, so you're four steps in before meeting a staff; the fifth
is the leap most people find hardest, that a printed dot is a key. A tapped on-screen
key, a computer key and a real MIDI piano all satisfy a step identically.

Press a key that isn't the one asked for and it still sounds, still lights, and simply
doesn't count. No reset, no penalty, no tally of mistakes — wandering along the keys is
how a keyboard gets learned.

**A calmer panel before your first run.** The setup panel carries 28 controls across
five sections, which is a wall rather than a set of choices if you've never played. At
the starter level it now shows the skill picker, what the piece will ask you to read,
and which hand — everything else folds behind one **More options** door, and the space
that frees says the thing worth saying before a first run: play it as slowly as you
like, the notes wait for you. Nothing is hidden; one press opens all of it, and the
full panel returns the moment you move down the ladder.

**A brand-new device starts as a starter.** The shipped settings didn't match any rung
of the skill ladder, so a device that had changed nothing was labelled "Custom" — and
the beginner layout above never reached the people it was built for. A fresh device now
reads as Starter without choosing anything. That turns the notes highway on by default:
if you've never read music you can't start at the staff, and the ladder sheds the
highway as soon as you move down a rung.

Finishing the keyboard tour also sets your level, since working out where middle C is
says plainly where you are. Only the reading aids move — every other preference is left
alone.

**No more "reload to update".** Every change goes live as it lands, so a newer build was
nearly always waiting and the banner asking you to reload was close to permanent. A
waiting build is now taken at the next natural boundary — moving to another page, or
coming back to a tab you'd left — where the app is loading something anyway. A build is
never taken mid-run: if you're playing, it waits until you're not.

**The keyboard tour points the right way.** The waiting line under the keyboard said the
keys were below it, which stopped being true when the layout moved. It names no
direction now. Dropping the phrase also drops a gendered word ending that half of
readers saw in the wrong form in several languages.

**Help keeps a door to the keyboard tour.** The tour and the basics page were reachable
only through the Getting started checklist, which disappears once you dismiss it or
finish its last step — taking the only way back with it. Both now have a permanent link
from Help.

---

Older changes aren't listed here; this file starts at 31 July 2026.
