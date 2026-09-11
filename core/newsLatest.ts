// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Generated from changelog.yaml by dev/changelog.mts — do not edit.
//
// The newest releases, in the page's own bundle so the /news document says what
// changed without waiting for a fetch. The rest of the list is fetched.

import type { Release } from "./changelog";

export const LATEST_RELEASES: Release[] = [
    {
        date: "2026-09-11",
        label: "evening",
        entries: [
            {
                body: '**A new take in Compose is named in your language.** Its title started as the\nEnglish word "Improvisation" in every language, and that word went on to name the\nMIDI and MusicXML files you download and head the score they open as. It now starts\nin your own language — "Improvisación", "Improvvisazione", "即興演奏" — and you can\nstill rename it.',
                twip: true,
            },
            {
                body: '**A screen reader names the piano\'s keys in your language.** Every key on the\non-screen keyboard, and the wrong-note announcement, was read out in English\nwhatever language Plinky was in, so a German page said "Falsche Note: F sharp 4".\nKeys are now named the way your language names them, "Falsche Note: Fis 4" and H for\nB natural in German, and with your language\'s own word for a sharp everywhere else.',
                twip: true,
            },
            {
                body: "**In German, the circle of fifths calls B natural H.** German reads the letter B as\nB flat, so the Tools page told a German reader that D major's relative minor was\nB-Moll, and named the key of five sharps B. The circle, its signatures, the chord\nsheet you can save, the scale, chord and interval pickers and the Theory lessons now\nuse the German names: h-Moll, Fis · Cis, H for B natural and B for B flat.",
                twip: true,
            },
            {
                body: "**Left hand as chords works on songs with a singer.** With Other parts showing, a\nsong whose singer is written above the piano kept the composer's full left hand when\nyou chose Left hand as chords, and the run still counted as a practice version. The\npiano's left hand now turns into chords under the singer's line, as it does on a\npiece for piano alone.",
                twip: true,
            },
            {
                body: "**Stopping Listen stops the sound.** Press Listen again to stop it, restart it, or\nstop a run you are replaying, and the cursor stopped while the notes already played\nrang on, a pedalled bass for a bar or more, and under the next pass if you started\nagain. Playing a sketch back in Compose did the same after Stop. The notes now fade\nthe moment you stop, and anything you are holding on your own keys keeps sounding. A\npiece that plays to its end still lets its last chord ring.",
                twip: true,
            },
            {
                body: "**Keep up counts a grace note played a hair late.** A beat in Keep up stays open\nfor a moment after the cursor moves on, so a note played just after it still counts.\nA very short beat, such as a grace note or a fast semiquaver, could have that moment\ncut short by the beat before it, and a note played inside it was marked as missed.\nEvery beat now keeps its full moment.",
                twip: true,
            },
            {
                body: "**With Keep going on, a missed note no longer makes the next one look early.** When\nyou skipped a note and played the next one right on its beat, the result timed the\nskipped note as late and the one you played as early, so a single miss cost you\ntwice on timing and put a note you got right on the strip as off the beat. The\nmissed note still counts as missed, and the notes you played are timed as you\nplayed them.",
                twip: true,
            },
            {
                body: "**A run's video shows the piece's own notation after One hand at a time.** Trying\nOne hand at a time from Ways to practise can open a tune written on a single staff.\nYou play it with both hands, but the run was kept as a left-hand run, so its video\ncould not find those notes in the score and drew your playing out as new notation\ninstead. The run is now kept as the both-hands run it was, and its video shows the\npiece as written.",
                twip: true,
            },
            {
                body: "**All time on the Stats page shows your practice.** With the period set to All\ntime, the practice report said there was nothing here yet, however much you had\nlogged, while the week, the month and the year showed it. It now adds up every\nsitting since your first, and its calendar starts on that day.",
                twip: true,
            },
            {
                body: "**An address without a language opens its page, slash or no slash.** Typing\nplinky.fun/music/, or taking the language out of a link you copied, opened the Today\npage, while the same address without the final slash opened Music. Both now open the\npage they name, in your language.",
                twip: true,
            },
        ],
    },
    {
        date: "2026-09-11",
        label: null,
        entries: [
            {
                body: "**A very fast or very slow MIDI file reads cleanly in Compose.** Opening a file played\nfaster than 240 or slower than 40 beats a minute set the tempo to the nearest end of\nthe range while the notes kept their own timing, so a line of plain quarter notes came\nout on the staff as dotted and tied fragments. Compose now halves or doubles such a\ntempo until it fits, so the notes stay on the beat, written at half or twice their\nvalue, and the take sounds exactly as the file did.",
                twip: true,
            },
            {
                body: "**A transposed piece stays in a key you can read.** Moving a piece in F♯ major down a\nsemitone printed E♯ major, with eleven sharps, and a few other moves from a sharp or\nflat key went past seven. The transposition now always lands on the nearer name of the\nnew key, F major there, the way it already did for the moves that had two names to\nchoose from.",
                twip: true,
            },
            {
                body: "**Plinky opens without a connection, from its icon too.** With no network, opening\nPlinky from its icon on your home screen, or opening a page you had never visited on\nthat device, showed your browser's own error page in place of Plinky. Both now open\nPlinky, and the pages you have visited open as they always did.",
                twip: true,
            },
            {
                body: "**Notes you are holding stop when you leave the page.** Hold a chord on the Piano\npage, in Compose, in the keyboard tour or on the home page's keyboard and follow a\nlink away, and those notes rang on through their whole fade on the next page, whether\nyou were holding them on a MIDI piano or on the keys on screen. They now end as you\nleave.",
                twip: true,
            },
            {
                body: "**The microphone hears every note you play, the same one twice included.** With the\nmicrophone listening on the Piano page, in Compose, on the home page's keyboard or in\nKeep up, Plinky played each note back over your piano, and a note you repeated soon\nafter was taken for that echo and never heard, so it went missing from a sketch or a\nrun. Plinky now leaves a piano it hears through the microphone to make its own sound.",
                twip: true,
            },
            {
                body: "**Keep up keeps time through grace notes.** In Keep up, a grace note held on for\nits whole written length before the note it decorates, and a very quick one a little\nlonger still, so every ornament pushed the beat later and the notes you were chasing\ndrifted away from the metronome. Grace notes now take their time from the note they\nlean on, the way Listen plays them, and the beat stays where the score puts it.",
                twip: true,
            },
            {
                body: "**A chord you moved on from reads amber, not green.** With Keep going on, playing\npart of a chord and going straight on to the next note painted the notes you did\nget the same green as a chord read cleanly, and with hidden notes on it was revealed\nas found, even though the grade already counted it as missed. It is now amber, the\ncolour for a note found after a slip, so the score and the grade tell the same\nstory.",
                twip: true,
            },
            {
                body: "**You hear what you play in Compose.** The keys under the sketch, your computer keys\nand a MIDI piano without speakers of its own all wrote notes onto the staff in\ncomplete silence, so the only way to hear a take was to stop and play it back. Every\nnote now sounds as you play it, on the same piano and with the same pedals as the\nrest of Plinky.",
                twip: true,
            },
            {
                body: "**A pedal you are holding keeps working into the next run.** Finish a run with your\nfoot still on the sustain pedal, press Practice again without lifting it, and the\nnotes were cut short as your keys came up, while the take saved from that run played\nback pedalled. The pedal now carries on from where your foot is, and a pedal you\npressed or lifted on another page is right when you get back to the keys. The same\ngoes for the soft and sostenuto pedals.",
                twip: true,
            },
            {
                body: "**The recorded piano comes back after a Listen that started too soon.** Press Listen\nwhile the piece's recordings were still arriving and it plays on the plainer\nsynthesised piano, so that the whole piece sounds like one instrument. That choice\nused to outlast the Listen: every note after it, on every page, stayed on the plainer\npiano until you happened to start another run. It now lasts exactly as long as the\nrun, and the recordings are back as soon as it ends.",
                twip: true,
            },
            {
                body: "**The Piano page makes a sound.** A key pressed there lit up and that was all:\nwhatever you played, on the screen, the computer keys or a MIDI piano without\nspeakers of its own, was silent, and the pedals did nothing. Every note now sounds on\nthe same piano as the rest of Plinky, for as long as you hold it, and all three pedals\nwork. The pedals work on the keyboard on the home page now too.",
                twip: true,
            },
            {
                body: "**A play-along or a sight-read after a finished run starts properly.** Finish a\npiece at your own pace, then switch to Keep up or turn on sight-reading and press\nPractice, and the full screen used to close again straight away, taking the count-in\nor the reading time with it. The finished run now stays finished, and the next one\ngets the stage to itself. It could also be counted a second time and wipe the ghost\nyou race; that has gone too.",
                twip: true,
            },
            {
                body: "**Taking over from Listen on a repeat carries on where it was playing.** Press\nPractice while Listen is on the second time through a repeated passage, and the run\nused to send you back to the first time through, so you played bars you had just\nheard all over again. It now picks up on the same pass, at the next note, and that\nholds for a repeat that starts at the very top of the piece too.",
                twip: true,
            },
            {
                body: "**Bars that vanish behind a sight-read come back when the music goes round again.**\nWith bars vanishing on, a repeat sign or a section loop sends you back to bars that\nhad already disappeared, and they stayed gone, so the second time through had to be\nplayed from memory. They now reappear as the run returns to them, and vanish again\nonce you have moved on.",
                twip: true,
            },
            {
                body: "**A loop over part of a repeat keeps the cursor on the bar you are playing.** Loop\na few bars inside a repeated passage, and after the first time through the cursor\nbox and the scrolling moved on to the bar printed next, while the notes you were\nasked for came from the start of the loop again. The cursor now goes back with you.",
                twip: true,
            },
            {
                body: "**The recorded grand piano you downloaded stays downloaded.** Every time Plinky\nupdated, the recordings kept on your device were thrown away with the old version, so\na piano fetched for a flight could be gone by take-off, and with no network every note\nfell back to the plainer piano. They now stay on your device through updates.",
                twip: true,
            },
            {
                body: "**Plinky opens in the language you picked.** Choose a language in Settings and then\ncome back to plinky.fun, or open Plinky from your home screen, and it opened in your\nbrowser's language instead, every time. It now remembers your choice and opens in it,\nincluding a language you picked before today.",
                twip: true,
            },
            {
                body: "**A repeated note played a touch early counts in Keep up.** Rush the second of two\nsame notes by a hair, as the C C of Twinkle Twinkle invites, and Keep up took it for\nthe first C struck again, then marked the second one missed. It now goes to the beat\nit was meant for, exactly as a note played a touch late always did.",
                twip: true,
            },
            {
                body: '**With "Keep going" on, a note you skipped counts as missed.** Moving on to the next\nnote never stops you, and it still does not. But the note you left behind was scored\nas a right one, played cleanly, so a run with half its notes skipped could earn an A,\nmark the piece learned and take its star. A skipped note now counts against accuracy\nand flow like any other miss, and a run where you play every note grades exactly as\nit would with the switch off.',
                twip: true,
            },
            {
                body: "**Listen keeps time through rolled chords and grace notes.** At a lively tempo every\nrolled chord, every grace note and every very quick trill or tremolo held on a hair\nlonger than written, and the piece fell a little further behind the metronome each\ntime — nearly two seconds by the end of a piece full of them, in Listen, in videos\nyou export and in the clips. They now take exactly their written time.",
                twip: true,
            },
            {
                body: "**Listen plays a transposed piece's tremolos and glissandos in the new key.** Move a\npiece up or down and press Listen, and a tremolo still shook between the chords of the\nkey it was written in, a few notes away from the ones on the page, while a glissando\nswept towards the old arrival note. Both now sound in the key you chose, exactly where\nthe staff shows them.",
                twip: true,
            },
            {
                body: "**Chord symbols move with the music when you transpose.** A piece whose score prints\nits own chord names kept them in the key it was written in, so after moving it up a\ntone the staff said D major while the symbols above it still read C, Am and G7. The\nnames now follow the notes, spelled the way the new key spells them, bass notes\nincluded.",
                twip: true,
            },
            {
                body: "**Chord names and block chords are spelled the way the music is.** In a minor key with\nflats, the chord that leads home borrowed a flat it never has: D minor's A major over\nC sharp was labelled A/D♭, and with block chords on, the left hand was written with\nD♭ and G♭ where the key signature and the right hand said C♯ and F♯. Pieces in F♯\nmajor or C♯ major had their chords named in flats under a key signature full of\nsharps. Every chord is now spelled note by note from its place in the key, so the\nsymbol, the block chord and the rest of the page agree.",
                twip: true,
            },
            {
                body: "**Playing a piece again straight away no longer pushes its review months away.** Once\na piece was learned, every good run counted as a review, so playing it six times in\none sitting scheduled the next review half a year out, and the piece went quiet as\nthough you had kept it for months. A run now moves the review further out only once\nthe review has come due, or nearly. Playing again before then still keeps your best\nscore, and a run that goes badly still brings the review back to tomorrow.",
                twip: true,
            },
            {
                body: "**A star you have earned stays earned.** Put one of the pieces behind a star back on\nthe shelf, or take the learned tick off it, and the star vanished from your badges on\nthe Stats page, although badges are meant to be yours for good. Stars now stay once you\nhave seen them, and so does the badge for learning every ear exercise. A gold star in\nany grade now also counts as the bronze and silver you passed on the way.",
                twip: true,
            },
            {
                body: "**A take you carry over as a MIDI file comes back at the tempo you set.** Download a\ntake composed at 90 beats a minute, open it in Compose, and the tempo box read\n89.9999550000225, a number that then travelled on in every link you shared. It now\nreads 90. A file or a shared link with a tempo the box cannot hold, faster than 240 or\nslower than 40, opens at the nearest one it can, where it used to drive the\nmetronome at whatever the file said.",
                twip: true,
            },
            {
                body: "**A thinned piece prints its rests at the right length.** With Thin the texture set to\nMelody alone or Melody and bass, a dotted note taken out of the other hand became a\nplain rest without its dot, and a triplet taken out lost its bracket and was drawn as\nordinary quavers, so the bar on the page no longer added up. The rest now prints at\nexactly the value the note had, dot and triplet bracket included.",
                twip: true,
            },
            {
                body: "**A video or sound file of a take finishes even when Plinky updates.** A long video\ntakes minutes to make, and if a new version of Plinky arrived meanwhile, switching\ntabs and coming back could reload the page halfway through, so the file never\narrived and nothing said why. Plinky now waits until the file is saved before it\nupdates.",
                twip: true,
            },
            {
                body: "**A score you just added can be backed up straight away.** Add a score on the\nManage tab of Music and the backup section right below it still said you had none,\nwith its download button greyed out until you left the tab and came back. It now\ncounts the new score the moment it is added, and one you remove just as quickly.",
                twip: true,
            },
            {
                body: "**A take saved as MusicXML carries the piece's name.** The file was named after the\npiece, but opened in MuseScore or another notation program every take was headed\n\"Improvisation\". It now shows the piece's title, and your computer recognises the\nfile as sheet music rather than plain XML.",
                twip: true,
            },
            {
                body: "**A backup of your progress restores on a nearly full device.** Restoring made room\nfor the backup's recordings only after writing them, so a phone holding plenty of\nits own takes could refuse a backup that would have fitted easily once they were\nreplaced, and say its storage was full. The device's own values now make way\nfirst, and a backup that still cannot fit leaves everything exactly as it was.",
                twip: true,
            },
            {
                body: "**A theory lesson stops playing when you move to the next one.** Press Hear them on\none lesson, pick another from the list before it finished, and the rest of the first\nlesson went on sounding and lighting its keys on the new lesson's keyboard. Each\nmove between lessons also left an empty space above the example. The old lesson now\nfalls silent as you leave it, and each lesson draws its example once.",
                twip: true,
            },
            {
                body: "**A book of studies keeps its name while its page loads.** Opening a collection's\npage, such as Czerny's eight-bar exercises, blanked its heading and the name in your\nbrowser tab until the list of books arrived, and left both blank for good if it never\ndid. The tab keeps the book's name throughout, and the heading shows the page's\naddress until the name is ready.",
                twip: true,
            },
            {
                body: "**A screen reader names the colour theme in your language.** The button that\nswitches between light, dark and your system's theme read its choice out in English,\nso a German reader heard \"Design: dark\" while the button said Dunkel. It now says the\ntheme's name in the language Plinky speaks to you, and leaves out the picture beside\nit.",
                twip: true,
            },
            {
                body: '**One of something is counted as one.** With a single piece due, the button offered\nto "Review 1 pieces"; a month with one day of playing said "1 days", a best day of\none note said "1 notes", and a date set for tomorrow was "1 days away". Each now\nreads the way you would say it, in every language Plinky speaks, including those\nthat use a third or fourth form for a number, as Polish and Russian do. A date that\nfalls today says "today" rather than "0 days away".',
                twip: true,
            },
            {
                body: '**A single note is one note in your language too.** In German, French, Spanish,\nPolish and most other languages, a day in this week\'s chart with one note played\nshowed "1 Noten", "1 notes" or "1 notas", and a Music search with one match counted\none score as several. Both now use the singular, and Polish, Czech, Russian and the\nother languages with more than two forms get the right one for every count.',
                twip: true,
            },
            {
                body: '**Every count in Plinky agrees with its number.** With one learned piece, the home\npage said "1 pieces on the stand", your very first note was "1 notes played", a\ncomposer with a single piece in the catalogue had "1 pieces to play", Compose\ncounted the first note of a take as "1 notes", and a single report pasted in to\ncollect a class\'s results read "1 reports", a set of a single piece offered to\n"Show the 1 pieces", a month you shared after one day of playing said "1 days", and\na piece one bar long was "1 bars".\nEach now reads the way you would say it, in every language Plinky speaks, with the\nthird and fourth forms Polish, Czech, Russian and their neighbours use for two, five\nor twenty-one. In Portuguese, a search with no matches found "0 partitura", as though\nnothing were one score; zero now takes the plural there, as it does in Portugal.',
                twip: true,
            },
            {
                body: '**Seconds are written with your own decimal comma.** The notes you are slowest to\nread on the Stats page, and the margin you beat or lost to a ghost by, always used a\nfull stop: a German reader saw "1.4s" beside figures that elsewhere read "1,4". Both\nnow follow the language Plinky speaks to you.',
                twip: true,
            },
        ],
    },
];
