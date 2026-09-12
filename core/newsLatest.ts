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
