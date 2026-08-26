// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words that go with a composer's playlist: a YouTube title and description, written
// to playlist.txt in that composer's promo folder, beside the pieces it collects.
//
// The same bargain as the per-piece texts. Twenty-six playlists is more than anybody edits
// by hand twice, and a playlist description that disagrees with the clips under it is worse
// than none — the pieces listed here ARE the pieces rendered into that folder, read from
// the one list both the renderer and the thumbnails read, so they cannot drift apart.
//
// What a description carries, in order of why: what the viewer is looking at, the pieces in
// the playlist so the words match the tiles, a link to that composer on the site, and the
// licence. The link is the point — somebody who has just watched four Chopin waltzes is one
// tap from the forty pieces of his the catalogue actually holds.
//
// Usage: npm run promo:composers [-- --out promo]

import { mkdir, writeFile } from "node:fs/promises";
import { indexedPerson } from "../../core/peopleIndex.ts";
import { canonicalPeople, personSlug } from "../../core/person.ts";
import { folderForComposer, PIECES } from "./pieces.mjs";

const outAt = process.argv.indexOf("--out");
const OUT = (outAt >= 0 ? process.argv[outAt + 1] : undefined) ?? "promo";
const SITE = "https://plinky.fun";

// A tradition is not somebody, so a playlist of traditional tunes is named for what it is
// rather than credited to a person who does not exist.
const TRADITIONAL = /^(traditional|trad|anonymous|anon)$/i;

// Every person a credit names, but only those with a page to link to. The promo list writes
// its own credits — "J. S. Bach", "W. A. Mozart" — so this is where they meet the
// catalogue's spelling, and a name that resolves to nothing simply contributes no link
// rather than a broken one.
function pagesFor(composer) {
    return canonicalPeople(composer)
        .map((name) => ({ name, slug: personSlug(name) }))
        .filter((person) => person.slug !== "" && indexedPerson(person.slug) !== null);
}

function describe(composer, titles) {
    const pages = pagesFor(composer);
    const traditional = TRADITIONAL.test(composer.trim());
    const held = pages.reduce((sum, person) => sum + (indexedPerson(person.slug)?.pieces ?? 0), 0);

    const opening = traditional
        ? "Traditional tunes played in Plinky — the notes falling as they sound, and the keys lighting under them."
        : `${composer} played in Plinky — the notes falling as they sound, and the keys lighting under them.`;

    // Named rather than counted. "Nine pieces" tells a reader nothing they cannot see from
    // the tile count; the titles tell them whether the one they came for is here.
    const list = titles.map((title) => `• ${title}`).join("\n");

    // One line per link. A playlist for two composers — the Ave Maria is Bach's prelude and
    // Gounod's melody — earns a line each rather than a sentence that has to choose.
    const links = pages.map(
        (person) =>
            `${person.name} on Plinky (${indexedPerson(person.slug)?.pieces} pieces to play): ${SITE}/en/person/${person.slug}/`,
    );

    return [
        opening,
        "",
        list,
        "",
        ...(links.length > 0 ? [...links, ""] : []),
        // Fifteen of the twenty-six composers here have a single piece, so the sentence has
        // to count: "every one of them" after a list of one reads as a mistake.
        held > 0 && !traditional
            ? `${titles.length === 1 ? "It opens" : "Every one of them opens"} in the browser, ready to play. Plinky is a free piano practice app — nothing to install, no account. It listens through a MIDI piano or your microphone and tells you how the run actually went, hand by hand.`
            : "Plinky is a free piano practice app that runs in the browser — nothing to install, no account. It listens through a MIDI piano or your microphone and tells you how the run actually went, hand by hand.",
        "",
        SITE,
        "",
        "Every score is Creative Commons, so each piece here is one you are free to play, share and record.",
    ].join("\n");
}

const byComposer = new Map();
for (const piece of PIECES) {
    if (!byComposer.has(piece.composer)) {
        byComposer.set(piece.composer, []);
    }
    byComposer.get(piece.composer).push(piece.title);
}

let written = 0;
let unlinked = 0;
for (const [composer, titles] of byComposer) {
    const dir = `${OUT}/${folderForComposer(composer)}`;
    await mkdir(dir, { recursive: true });
    // The title carries the word a viewer searches for. A composer's name alone competes
    // with every recording ever made; the instrument is what narrows it.
    const title = TRADITIONAL.test(composer.trim())
        ? "Traditional tunes on piano | Plinky"
        : `${composer} — piano | Plinky`;
    await writeFile(`${dir}/playlist.txt`, `${title}\n\n${describe(composer, titles)}\n`);
    written += 1;
    if (pagesFor(composer).length === 0 && !TRADITIONAL.test(composer.trim())) {
        unlinked += 1;
        console.warn(`  ${composer}: no page on the site, so the description carries no link`);
    }
}
console.log(`Wrote ${written} playlist.txt files under ${OUT}/ (${unlinked} without a link).`);
