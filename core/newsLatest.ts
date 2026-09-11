// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Generated from changelog.yaml by dev/changelog.mts — do not edit.
//
// The newest releases, in the page's own bundle so the /news document says what
// changed without waiting for a fetch. The rest of the list is fetched.

import type { Release } from "./changelog";

export const LATEST_RELEASES: Release[] = [
    {
        date: "2026-09-10",
        label: null,
        entries: [
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
                body: "**Taking over from Listen on a repeat carries on where it was playing.** Press\nPractice while Listen is on the second time through a repeated passage, and the run\nused to send you back to the first time through, so you played bars you had just\nheard all over again. It now picks up on the same pass, at the next note.",
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
        ],
    },
    {
        date: "2026-09-09",
        label: "night",
        entries: [
            {
                body: "**The theory course opens on a lesson, and every lesson is a link.** The list down\nthe side used to jump you around one very long page. Each of the fourteen lessons\nnow has a page of its own and the list points straight at it, so you can open one in\na new tab, send it to somebody, or find it by searching for the question it answers.\nOpening the course lands on the first lesson rather than on all of them at once, the\nway the glossary has always opened on the first mark — and the glossary's list is\nmade of real links now too.",
                twip: true,
            },
        ],
    },
];
