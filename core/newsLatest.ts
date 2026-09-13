// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Generated from changelog.yaml by dev/changelog.mts — do not edit.
//
// The newest releases, in the page's own bundle so the /news document says what
// changed without waiting for a fetch. The rest of the list is fetched.

import type { Release } from "./changelog";

export const LATEST_RELEASES: Release[] = [
    {
        date: "2026-09-13",
        label: "evening",
        entries: [
            {
                body: "**Calmer colours, and a black theme.** Plinky wears deep indigo on paper white, with\nsoft forget-me-not blue where it used lilac and gold, and cooler greys so the page\nreads more clearly. If you liked the violet, Settings brings it back under Colours.\nThe theme can also be Black: a true-black page for phone screens at night, in either\nset of colours. The pictures on the help page show the new look, in your language.",
                twip: true,
            },
            {
                body: "**A new logo.** Three keys on an indigo circle, with a note falling down the middle\none to strike it. It sits beside the name at the top of every page and is the icon in\nyour browser tab, and it keeps its own colours whichever ones you pick.",
                twip: true,
            },
            {
                body: "**The keyboard on the front page is a way into practising.** Each of its seven white\nkeys carries one of the ways a teacher would suggest, with a small drawing on it:\nloop the hard bar, go slowly, one hand at a time, hear it first, mix pieces up, come\nback later, and learn the chords. A key still sounds when you press it, and its way\nto practise opens underneath, with why it works and a piece to try it on. A MIDI\npiano or your computer keys open them too. The long list of them further down the\npage is gone, and nothing plays a note any more when your mouse passes over a list.",
                twip: true,
            },
            {
                body: "**Lists without boxes.** Lessons, tools, settings, your stats and the result of a run\nare no longer drawn as cards. Each is a row with an icon, a drawing or a number at\nits left edge, its name, and a line about it, with a thin rule between one row and\nthe next, like the contents page of a music book. On the Stats page every number\nsits at the start of its row, so the figures line up down the page, and the eight\ngrades of the ladder fit in a shorter list.",
                twip: true,
            },
            {
                body: "**Small drawings beside what you can learn.** Everything under Learn and Teach, and\neach of the little tools, now starts with a drawing of a thing a pianist keeps\nnearby: a stave, a tuning fork, a pencil, a stopwatch, a stack of graded books. They\nare drawn in the same hand as the ones on the front page's keys, and take on your\ncolours, light or dark.",
                twip: true,
            },
            {
                body: "**Stats says what is missing when it has counted your notes.** When a period has\nnotes played but no time logged, as after you remove a sitting, the practice diary\nsays the notes are counted and no time was logged. It used to say there was nothing\nhere yet, right under the notes it had just counted.",
                twip: true,
            },
        ],
    },
    {
        date: "2026-09-13",
        label: null,
        entries: [
            {
                body: "**A chord written for both hands is graded the way you play it.** Where one staff\nholds more notes than a hand can span, like the crossing thirds in Mozart's A major\nsonata or the tenor and bass of a hymn written on one line, the grade read them as a\nsingle impossible stretch. When your other hand is free to take those notes, the grade\nnow counts them as shared between your hands. Seventy-five pieces sit a grade or two\neasier for it, and no piece's own grade went up. The easier ways into a piece, like\nthe melody alone, are measured afresh too, so a few pieces now start a grade higher\nor lower, and none offers a way in that is no easier than the piece itself.",
                twip: true,
            },
            {
                body: "**A slide that lands on a chord goes on from it.** Where a slide arrives on one note\nof a chord and the next sets off from another note of the same chord, Listen could\ndrop the second slide and simply strike its notes. Both slides now sound, one\narriving and the next leaving, whichever way round the chord is written.",
                twip: true,
            },
            {
                body: "**A note written twice in a chord takes one finger.** Where two voices share a note,\nas they often do in hymns and part-songs, the suggested fingering counted it as two\nkeys and could stretch your hand for a key it had already taken: an octave with its\ntop note doubled came out as 3-1-4. Both copies now share one finger, and the rest of\nthe chord is fingered the way your hand actually plays it.",
                twip: true,
            },
        ],
    },
];
