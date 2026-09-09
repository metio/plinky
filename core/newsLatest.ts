// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Generated from changelog.yaml by dev/changelog.mts — do not edit.
//
// The newest releases, in the page's own bundle so the /news document says what
// changed without waiting for a fetch. The rest of the list is fetched.

import type { Release } from "./changelog";

export const LATEST_RELEASES: Release[] = [
    {
        date: "2026-09-09",
        label: null,
        entries: [
            {
                body: "**A piece page shows its grade once.** It had started saying it twice, a few pixels\napart — once beside the title and once beside the piece's other numbers. The one\nthat stays is the one that takes you to everything else at that level.",
                twip: true,
            },
            {
                body: "**One more page that was not a composer, and a piece that was not called what it\nsaid.** An archive's note for an unknown author had become a composer with a page of\nits own, and its single piece carried the archive's cataloguing line as its title.\nThe piece is called \"Kupffer Schmitt\", which is what its own score calls it.",
                twip: true,
            },
        ],
    },
    {
        date: "2026-09-08",
        label: null,
        entries: [
            {
                body: "**The books of studies have pages of their own.** Bach's two-part inventions,\nCzerny's op. 821, the Goldberg variations and twenty more: each is now a page listing\nevery piece of it the catalogue holds, in the order you would work through them. They\nare linked from the foot of the Music page and from every shelf.",
                twip: true,
            },
            {
                body: "**A piece page says what the piece is.** Under the title you now get its grade, how\nmany bars it runs to, how it is counted and how fast it goes — and the grade is a\nlink to everything else at that level, so finding another piece your size is one tap\nrather than a trip back through the filters.",
                twip: true,
            },
            {
                body: '**Each theory lesson has its own address.** "What is an octave" was a paragraph two\nthirds of the way down a page of fourteen lessons. Each is now a page you can link\nto, and the course still reads top to bottom where it always did.',
                twip: true,
            },
            {
                body: "**A composer's link shows the composer.** Sharing a composer page used to unfurl as\nthe site's own picture; each of the four hundred now has a card with their name, who\nthey were and how much of theirs there is to play.",
                twip: true,
            },
            {
                body: '**The composer directory stopped listing things that are not composers.** Now that\nevery credited name has a page of its own, the odd ones in the harvested scores\nbecame visible: a page for "Public Domain", one for "a breeze", one for the choir\nthat recorded a carol. Those are gone. Credits naming two people at once are two\npeople again, so Bellini and Chopin each keep their own page; a catalogue number\nleft on the end of a name no longer makes a second Bartók; and initials that meant\nsomebody already in the catalogue now lead to them, so Rachmaninoff\'s pieces are all\nin one place.',
                twip: true,
            },
            {
                body: '**Links without a language in them work again.** An address like `plinky.fun/about`\n— the shape a link takes when it is copied out of somewhere that dropped the\nlanguage — had quietly stopped working for a dozen pages, including Help, the\nglossary and the two legal pages, and answered "page not found" instead of sending\nyou to your own language. All of them are back.',
                twip: true,
            },
            {
                body: "**Text stops jumping on Greek, Russian, Ukrainian and Serbian pages.** Every page\nfetches the slice of its typeface that covers the script it is written in, and those\nfour were waiting for the stylesheet to be read before asking for theirs. The page\npainted in a stand-in font and then re-laid itself out when the real one arrived,\nwhich on a long page moved everything you were reading. Each language now asks for\nits own slice straight away.",
                twip: true,
            },
            {
                body: "**A shared link lands, whatever shape it is in.** An address without a language in\nit — the shape a link takes when it is copied out of somewhere that stripped it —\nnow finds the page for the shelves, the composers and the glossary marks too, rather\nthan showing a page that could not be found.",
                twip: true,
            },
            {
                body: "**Every mark in the glossary has a page of its own.** Tapping a symbol used to change\nwhat was on screen and nothing else, so there was no way to send somebody the answer\n— or to come back to it. Each mark now has its own address, and picking one from the\nlist writes it there: a fermata is at `/glossary/fermata`, with its engraving, its\nkeyboard and both readings of the phrase, exactly as before.",
                twip: true,
            },
            {
                body: '**What changed, and when, is now a page on the site.** Plinky has no version numbers\nand no release days — everything goes live the moment it is finished — so this list\nis the only record there is, and until now reading it meant leaving for a file on a\ncode-hosting site. It is the "What is new" link at the foot of every page.',
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
];
