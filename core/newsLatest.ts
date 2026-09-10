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
