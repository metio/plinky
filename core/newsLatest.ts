// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Generated from changelog.yaml by dev/changelog.mts — do not edit.
//
// The newest releases, in the page's own bundle so the /news document says what
// changed without waiting for a fetch. The rest of the list is fetched.

import type { Release } from "./changelog";

export const LATEST_RELEASES: Release[] = [
    {
        date: "2026-09-08",
        label: null,
        entries: [
            {
                body: "**What changed, and when, is now a page on the site.** Plinky has no version numbers\nand no release days — everything goes live the moment it is finished — so this list\nis the only record there is, and until now reading it meant leaving for a file on a\ncode-hosting site. It is at [What is new](/news/), linked from the footer of every\npage — and that address sends you to your own language.",
                twip: true,
            },
            {
                body: "**The catalogue has shelves.** Looking for something at your level, or something\nthat sounds like a particular century, meant setting filters on the Music page and\nremembering what you had set. Every grade now has a page of its own — grade 3 is at\n`/music/grade/3` — and so does each of the four periods, from the Baroque to the\nmodern. Each shelf lists its pieces easiest first, links to all the others, and has\nan address you can bookmark or send to somebody.",
                twip: true,
            },
            {
                body: "**The composer pages say who the composer was.** Four hundred of them carried a name\nand a list of pieces and nothing else. Each now opens with a line saying who the\nperson was and when they lived — Polish composer and pianist, 1810 to 1849 — with a\nlink to their Wikipedia article in the language you are reading, for the three\nhundred and forty-five the catalogue could place. The wording comes from Wikidata,\nwhich publishes it for anyone to use.",
                twip: true,
            },
        ],
    },
    {
        date: "2026-09-07",
        label: null,
        entries: [
            {
                body: "**Every piece has a page that says what it is.** Share a link to any of the three\nthousand catalogue pieces and the preview now names the piece and its composer and\nshows its opening bar on a card of its own, where every piece used to unfurl as the\nsite's one picture; a search engine reads the same. And the tab's title names the piece you are playing instead of saying \"Play\" for\nevery piece but the two that come built in.",
                twip: true,
            },
            {
                body: "**The recorded piano no longer changes its colour at a whisper of force.** Each key\nof the recorded grand is sixteen separate recordings, one per band of force, and a\nnote one step over a band's edge played a different recording from the note before\nit — the same note, a different piano. Near an edge both recordings now sound\ntogether, each at its share, so the colour moves with the force instead of jumping.\nAnd the recordings fetched for a piece are now the ones Listen will actually play:\nthe human touch shades each note's force by its place in the phrase, and the fetch\nhad only asked for the written force, so the notes it shaded quieter were covered\nby the built-in voice — which is what made a repeated passage sound muffled the\nsecond time through.",
                twip: true,
            },
            {
                body: "**plinky.fun opens in your language straight away.** The bare address used to load\nan empty page first and only then send you to your language. It is sent on before\nanything loads now, in the language your browser asks for, or English — which is\nalso what a search engine is shown, instead of a blank page.",
                twip: true,
            },
            {
                body: "**One piano for the whole run.** With the recorded grand piano on, its recordings\narrive a note at a time, and a note whose recording landed mid-piece switched from the\nbuilt-in voice to the recording under your hands — a repeated section sounded like a\ndifferent instrument the second time through. A run now decides its instrument when\nit starts and keeps to it; recordings that arrive during a run play from the next one.",
                twip: true,
            },
            {
                body: "**A link to a piece that isn't there says so.** An address for a piece or a\ncomposer the catalogue does not have — an old link from before the catalogue's\npieces were renamed, say — used to load an empty page that claimed to be fine.\nIt answers \"not found\" now, so a browser, a search engine and a bookmark all learn\nthe truth, while every piece and composer that exists opens exactly as before.",
                twip: true,
            },
            {
                body: '**Old links land where the page went.** A link to a page that has since moved —\nthe old You page, the Library, the separate trainers — or a link from before Plinky\nspoke twenty-six languages, with no language in its address, used to answer with\n"not found" until the app had loaded and sent you on. It is sent on straight away\nnow, so a bookmark or a search result still opens the right page.',
                twip: true,
            },
            {
                body: "**Listen's highlight stays on the note that is sounding.** Opening the play surface\nfull screen while Listen played sent its cursor back to the top, so from then on the\nhighlight sat one note behind the music and, at every repeat, the section's last note\nstayed blue on the second pass. The highlight now follows the music wherever the\ncursor has been put, and the blue trail is laid before a repeat wipes the section.",
                twip: true,
            },
            {
                body: "**Chords the way pieces use them.** A chord set now has three more dials on its\npage. *Sevenths* stacks one more third on every chord of the key, so the four-note\nchords a piece is built on get the same practice as the triads. *Open* spreads each\nchord to root, fifth and tenth — the shape where a hand's reach grows, and the grade\nfollows the reach. And *Pattern* plays each chord as a bar of Alberti bass or a\nbroken chord, one tone to a beat, which is how most left hands actually meet a\nchord. Every combination has its own address, so a link opens the same exercise\nfor anyone.",
                twip: true,
            },
            {
                body: "**Keep Plinky on this device.** A new switch in Settings fetches every page of the\napp on each visit — about a megabyte when a new version ships, and nothing when\nit hasn't — so wherever you practise without a connection, every page is there.\nPieces you open are kept as you go, as they always were.",
                twip: true,
            },
            {
                body: "**The ghost no longer recolours a bar a repeat has cleared.** Racing your own\nearlier run, the ghost's marker moves along the staff, and when it left a note you\nhad already played it painted that note green again — even after a repeat had\nsent you back and uncoloured those bars, which is how the last bar before a repeat\nkept its colour. The ghost's marker is now an outline of its own around the note,\ndrawn beside your colours rather than in place of them.",
                twip: true,
            },
            {
                body: "**Listen picks up on the pass it stopped on.** Stopping Listen inside a repeated\nsection and starting it again used to play the section from its first time\nthrough, whatever the blue trail said. It carries on from the pass you stopped on.",
                twip: true,
            },
            {
                body: "**Offline, a page you haven't opened says so.** Every page and piece you have\nopened keeps working without a connection. A page you had never opened on that\ndevice used to reload itself over and over and show nothing; now it says the page\nisn't on this device yet, and offers to try again or head back.",
                twip: true,
            },
        ],
    },
];
