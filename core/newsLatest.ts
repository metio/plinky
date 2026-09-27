// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Generated from changelog.yaml by dev/changelog.mts — do not edit.
//
// The newest releases, in the page's own bundle so the /news document says what
// changed without waiting for a fetch. The rest of the list is fetched.

import type { Release } from "./changelog";

export const LATEST_RELEASES: Release[] = [
    {
        date: "2026-09-27",
        label: "evening",
        entries: [
            {
                body: "**Settings opens without redrawing itself.** The recorded-piano panel arrived already\ncrediting the instrument and counting 637 recordings — figures that were never this\ndevice's — and the browser threw the page away and drew it again to correct them. It\nnow opens saying nothing has arrived yet, and fills in with what your device holds.",
                twip: true,
            },
        ],
    },
    {
        date: "2026-09-27",
        label: null,
        entries: [
            {
                body: "**Calmer colours, and a black theme.** Plinky wears deep indigo on paper white, with\nsoft forget-me-not blue where it used lilac and gold, and cooler greys so the page\nreads more clearly. If you liked the violet, Settings brings it back under Colours.\nThe theme can also be Black: a true-black page for phone screens at night, in either\nset of colours. The pictures on the help page show the new look, in your language.",
                twip: true,
            },
            {
                body: "**The name at the top of every page keeps its own colours.** The logo is the one you\nknow, and beside it the name is set a little larger, in its own deep ink, with a\nperfectly round pink dot over the i. Both stay exactly as they are whichever colours\nyou pick and whether the page is light or dark.",
                twip: true,
            },
            {
                body: "**The keyboard on the front page is a way into practising.** Each of its seven white\nkeys carries one of the ways a teacher would suggest, with a small drawing on it:\nloop the hard bar, go slowly, one hand at a time, hear it first, mix pieces up, come\nback later, and learn the chords. A key still sounds when you press it, and its way\nto practise opens underneath, with why it works and a piece to try it on. A MIDI\npiano or your computer keys open them too. These keys carry no note names, whatever\nyou have chosen in Settings — the word on a key is the way to practise it opens. The\nlong list of them further down the page is gone, and nothing plays a note any more\nwhen your mouse passes over a list.",
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
];
