// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Generated from changelog.yaml by dev/changelog.mts — do not edit.
//
// The newest releases, in the page's own bundle so the /news document says what
// changed without waiting for a fetch. The rest of the list is fetched.

import type { Release } from "./changelog";

export const LATEST_RELEASES: Release[] = [
    {
        date: "2026-09-12",
        label: "evening",
        entries: [
            {
                body: "**Compose shows the time a loaded piece is really in.** Opening a file with five,\nseven or twelve beats to the bar wrote its bars out that way, while the Time menu\nread 2/4 — and picking 2/4 from it did nothing. The menu now lists the piece's own\ntime beside the usual four, and choosing any of them changes it.",
                twip: true,
            },
            {
                body: "**Grades line up with the teaching books again.** Each grade is measured against\nwell-known teaching collections — Anna Magdalena, Burgmüller, the two-part inventions\nand more. Once chords were fingered the right way up, those books measured a little\ndifferently, so the grades were re-cut to match them. Around four hundred pieces move\nup a grade and a few move down; nothing about how you play them changes.",
                twip: true,
            },
            {
                body: "**A missing page speaks your language.** Following a stale or mistyped link, or\nlanding on a page that stopped working, used to show a page in English whatever\nlanguage the rest of the site was in. It now speaks yours, with a way home and the\nsame way to report the problem.",
                twip: true,
            },
            {
                body: "**The first link on every page is named in your language.** A screen reader\nannounced the logo's link home in English on every page, in the middle of a\nFrench or Japanese one. It now reads in the language of the page.",
                twip: true,
            },
            {
                body: "**A glossary link without a language opens the glossary.** An address like\nplinky.fun/glossary/piano/, typed by hand or copied without its language, opened\nthe free-play keyboard instead of the entry for the piano mark. It now opens the\nentry, in your language.",
                twip: true,
            },
            {
                body: "**Scale names follow your note names everywhere.** Switching how notes are named\nin Settings, H or B, do re mi or letters, renamed the scales on the keys and in\nMusic, while Today, Stats and the review session kept the old names until you\nreloaded. They now change with the rest.",
                twip: true,
            },
            {
                body: "**Slurs in songs land on the right hand again.** In a song for voice and piano, the\nsinger's line is left off the page, and every slur the piano's music carries was\nmoving one staff down: the tune under a slur played detached, while a staccato bass\nunder it was held long, in Listen and in what a run asked of you. Each slur now\nstays on the staff it is drawn on, with the singer on the page or off it.",
                twip: true,
            },
            {
                body: "**A tremolo shakes only its own note.** When a piano's right hand had a tremolo and\nthe other hand, or a singer, had a note at the same moment, Listen shook that note\ntoo, over and over, even a singer's note that wasn't on the page. Now the other\nnote sounds once while the tremolo shakes. A glissando also ends where its own part\nsays, never on a note the singer slides to.",
                twip: true,
            },
            {
                body: "**The piano follows its own dynamics in a song.** Where the singer was marked\nquieter or louder than the piano, or had a crescendo the piano didn't, Listen\nplayed the piano at the singer's level, and a run asked you for it too. The piano\nnow keeps to the dynamics and pedalling written for it.",
                twip: true,
            },
            {
                body: "**Stopping a duet stops the other hand.** While Plinky played the other hand for\nyou, pressing Stop, leaving full screen or starting Listen left the notes it had\nlined up still playing, one after another, on a page where nothing was running,\nand under Listen they came out of step with it. Stopping now silences the other\nhand at once. Play a run to its end and the other hand still finishes the piece.",
                twip: true,
            },
            {
                body: "**Stop means stop in a play-along too.** Pressing Stop while keeping up with the\nbeat left the guide notes and the other hand ringing for their whole length, so a\nslow chord could carry on over the next count-in. They now fade the moment you stop,\nwhile a run you play to its end still lets its last notes ring.",
                twip: true,
            },
            {
                body: "**The notes you take longest to find are timed honestly after Keep going.** When\nyou couldn't find a note and played the next one to move on, that next note was\nfiled as found in no time at all, so the notes you stumble around most looked like\nyour quickest. It now counts the whole time you spent getting there.",
                twip: true,
            },
            {
                body: "**Find your level reads every note.** With Thin the texture set in Settings, the\nplacement test was thinned too: the melody alone, or just the melody and bass. You\ncould climb past drills you couldn't yet read as written, and the level it saved came\nout too high. The test now always sets each drill in full.",
                twip: true,
            },
            {
                body: "**Finger numbers sit the right way up on every chord.** Some scores write a chord's\nnotes from the top down, and on those the suggested fingering came out upside down:\nthe thumb printed on the top note of a right-hand chord and the little finger on the\nbottom, in the score and in the finger-position editor. A chord is now fingered by its\npitches, whichever order they were written in. About a hundred pieces sit at a new\ngrade because of it — most by one step — along with pieces printed as a separate line\nfor each hand, which are now graded on both hands rather than one.",
                twip: true,
            },
        ],
    },
    {
        date: "2026-09-12",
        label: null,
        entries: [
            {
                body: "**Ear training answers from your number keys.** On a scale-degree question, typing 3\nanswers \"3\" just as clicking it does, and in melodic dictation each number you type\nfills the next note. Chord progressions take the number of the chord's degree, so 4\nis IV and 5 is V; with a keyboard to press them on, each chord button shows its\nnumber in the corner. A number the\nquestion doesn't offer is left alone. The number pad works too, and so does the\nnumber row on a French keyboard, with or without Shift. With a screen reader, you\nhear each note or chord as you fill it in, and which of the slots it went into.",
                twip: true,
            },
            {
                body: "**Ear training fits a small phone again.** A long melody or a chord progression\ndrew more listening dots than a narrow screen holds in a row, and five answer boxes\nwere wider than it too, so the page zoomed out and the undo button was cut off at\nthe edge. The dots now wrap onto a second row, and the boxes narrow to fit.",
                twip: true,
            },
        ],
    },
];
