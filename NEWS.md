<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: 0BSD
-->

# What's new

Plinky has no version numbers and no release days — every change goes live the moment
it's ready. This is what's changed, newest first, in plain terms.

## 2 August 2026

**Colours read the same in both themes.** Every colour in Plinky is now named for the
job it does — the muted grey of a hint, the green of a right answer, the indigo of the
next note to play — instead of being written out twice, once for the light theme and
once for dark. The two had quietly drifted apart in places, and pulling them back
together fixed three things you can see:

- In the ear trainer, a correct answer used to sit below the contrast floor in dark
  mode — white text on a green too pale to carry it. Both the right answer and the
  missed one are now legible in either theme.
- The little tab pickers dotted through Settings and the run panel had grey labels on a
  grey track. The unselected labels are darker, so a choice you haven't made yet is
  still readable.
- The arcade's play button had lost its hover entirely and drew its text too faintly.
  It responds again.

A few tinted panels also sit on a slightly deeper outline in dark mode, so a card edge
reads as an edge rather than fading into the page.

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

## 30 July 2026

**A glossary of the marks in a score.** Meet a curved line over two notes and there
was nowhere to ask what it is — and you can't look up "slur" when not knowing the
word is the problem. `/glossary` answers that for twelve symbols, grouped by what
each one controls: how long a note lasts, how you touch it, how loud it is, and where
on the page you are. Notation is instructions for sound, so every entry can be heard.

The setup panel before a run now lists the marks the piece in front of you actually
uses, each a link straight into its entry — so the explanation arrives at the moment
you meet the thing, rather than waiting in a reference you'd have to know to open.

**One panel breaking no longer takes the page with it.** The home and You pages are
built from panels that each read their own store. A stumble in one used to reach the
whole document's error boundary and replace every pane on screen, including all the
parts that were working. A panel now fails on its own and leaves the rest of the page
standing.

## 29 July 2026

**A placement test that finds your level by reading.** Most apps ask a newcomer to
pick beginner, intermediate or advanced and take them at their word, which is how
people land somewhere that bores or drowns them. Plinky asked nothing and started
everyone at the bottom. The test walks a ladder instead: read a short drill, and the
next one is harder or easier depending on how that went.

**Your best of each part, not just your best run.** A grade describes one run — play
the opening beautifully and fumble the coda, and it reads the same as the week you
fumbled the opening instead. A finished run now also folds into a record of the best
each of the piece's six parts has ever been, totalled under the result, so real
improvement in one stretch is visible even when the run as a whole isn't your best.

**The score shows where a run hesitated.** A cleared note went green whether you read
it at sight or found it on the fourth guess. A note that cost a wrong key now paints
amber instead, so a finished piece shows where the run actually hesitated rather than
a uniform green that forgets.

**The notes you're slowest to find.** Every run has always timed each note; nothing
added it up. Read the treble staff fluently but stall on every ledger line below
middle C and the grade folded both into one number. The You page now names the notes
that take you longest, so a hunch becomes something you can practise.

**Do, re, mi where that's what the notes are called.** Plinky speaks 26 languages and
had been labelling its keys C, D, E in all of them. For roughly half that isn't the
note's name — in French, Italian, Spanish, Portuguese, Romanian, Russian, Ukrainian,
Serbian, Greek and much of Asia a musician says "sol" the way an English one says
"G". The keys can now carry the names you actually use.

**Plinky can light up your piano.** The MIDI connection only ever listened, so a
piano with lit keys — which is most of the affordable ones — was told nothing. Listen
can now echo each note it sounds, so a piece can be watched on the instrument as well
as heard. Off by default, behind a switch in Settings.

**Shape the daily drill.** The generated phrase drew one note per beat from a
five-finger box in one of four keys — a first week of reading and nothing after it. A
drill is now described rather than fixed: any of the fifteen key signatures or all
twelve notes, any span of the 88 keys, one or two hands, up to four notes struck
together, quarters or eighths or a mix, a cap on the biggest jump, and a pull toward
keeping the next note near the last.

**Read just the bars you're drilling.** With a loop set, the looped stretch can be
re-engraved on its own — key and time signature restated, drawn big, with nowhere
else for the eye to go. On a phone it's the difference between practising four bars
and hunting for them.

**A student can hand the list back.** An assignment ran one way: a teacher built a
list, shared it by link, and then found out how it went by asking, because progress
lives on the student's device. Each assignment now offers a report — type a name and
the device turns what it knows into one code to paste into a message.

Two fixes alongside: the MIDI echo no longer cuts notes short or strands a lit key
on, and the placement test no longer counts toward your per-note reading times.

## 28 July 2026

**Read a piece cold, once, with nothing to lean on.** Practice is repetition until a
piece is learned; sight-reading is the opposite discipline, and Plinky couldn't tell
them apart — a first cold read and the twentieth rehearsal of the same bars counted
the same. Sight-read mode sits in the setup panel's extra-challenge group, and what
it records is kept apart from your practice best.

**Take your whole progress to another device.** Everything Plinky remembers lived in
one browser and nowhere else. Only scores had an export, so mastery, the review
schedule, takes, ghosts, fingerings, preferences, favourites and achievements had no
way off the device — a new phone started from zero, and a browser clearing its
storage took the lot. Settings → Your progress now downloads all of it as one bundle,
and restores it on the other side.

## 25 July 2026

**The anonymous usage analysis covers more of the app.** If you've turned it on — it
stays off until you do, and nothing loads unless you agree — Plinky now also counts
which buttons, links and switches get used, how far the onboarding steps get, and
whether features like importing a score, sharing a run or the daily challenge are
actually reached.

What it records is counts and the page you were on: a run reports its mode and the
grade letter it earned, not the notes you played, and nothing you write or record
ever leaves the device. Pressing keys is never tracked, so playing a piece can't
flood it. You can switch it back off in Settings at any time.

---

Older changes aren't listed here; this file starts at 25 July 2026.
