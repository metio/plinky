// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words that go with a composer's playlist: a YouTube title and description, written
// to playlist.txt in that composer's promo folder, beside the pieces it collects.
//
// It does not name the videos. A playlist shows them itself, with a thumbnail each, so a
// list in the description is the same information twice and only one copy is kept current.
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
import { FOLLOW_US } from "../../core/social.ts";
import { indexedPerson } from "../../core/peopleIndex.ts";
import { canonicalPeople, personSlug } from "../../core/person.ts";
import { folderForComposer, PIECES } from "./pieces.mjs";

const outAt = process.argv.indexOf("--out");
const OUT = (outAt >= 0 ? process.argv[outAt + 1] : undefined) ?? "promo";
// One line per channel, from the single list in core/social.
const FOLLOW_LINES = FOLLOW_US.map((c) => `${c.label}: ${c.href}`);

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

function describe(composer) {
    const pages = pagesFor(composer);
    const traditional = TRADITIONAL.test(composer.trim());
    const held = pages.reduce((sum, person) => sum + (indexedPerson(person.slug)?.pieces ?? 0), 0);

    const opening = traditional
        ? "Traditional tunes played in Plinky — the notes falling as they sound, and the keys lighting under them."
        : `${composer} played in Plinky — the notes falling as they sound, and the keys lighting under them.`;

    // One line per link. A playlist for two composers — the Ave Maria is Bach's prelude and
    // Gounod's melody — earns a line each rather than a sentence that has to choose.
    const links = pages.map(
        (person) =>
            `${person.name} on Plinky (${indexedPerson(person.slug)?.pieces} pieces to play): ${SITE}/en/person/${person.slug}/`,
    );

    return [
        opening,
        "",
        // No list of titles. A playlist page already shows every video in it, above the
        // description and with a thumbnail each, so naming them again says nothing a
        // reader cannot see — and it goes stale the moment a clip is added.
        ...(links.length > 0 ? [...links, ""] : []),
        // What the sentence refers to is the line above it — the pieces on the composer's
        // page, not the videos in the playlist. It used to count the videos, which was right
        // while their titles were listed here and became a dangling "It opens" the moment
        // they were not.
        held > 0 && !traditional
            ? `${held === 1 ? "It opens" : "Every one of them opens"} in the browser, ready to play. Plinky is a free piano practice app — nothing to install, no account. It listens through a MIDI piano or your microphone and tells you how the run actually went, hand by hand.`
            : "Plinky is a free piano practice app that runs in the browser — nothing to install, no account. It listens through a MIDI piano or your microphone and tells you how the run actually went, hand by hand.",
        "",
        SITE,
        "",
        // Where somebody who liked the playlist goes next, the same three the clips carry.
        "More Plinky:",
        ...FOLLOW_LINES,
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
for (const composer of byComposer.keys()) {
    const dir = `${OUT}/${folderForComposer(composer)}`;
    await mkdir(dir, { recursive: true });
    // The title carries the word a viewer searches for. A composer's name alone competes
    // with every recording ever made; the instrument is what narrows it.
    const title = TRADITIONAL.test(composer.trim())
        ? "Traditional tunes on piano | Plinky"
        : `${composer} — piano | Plinky`;
    await writeFile(`${dir}/playlist.txt`, `${title}\n\n${describe(composer)}\n`);
    written += 1;
    if (pagesFor(composer).length === 0 && !TRADITIONAL.test(composer.trim())) {
        unlinked += 1;
        console.warn(`  ${composer}: no page on the site, so the description carries no link`);
    }
}
// A composer dropped from the list leaves a playlist behind, describing videos that are
// no longer being made. Three of them survived a filter that removed their only piece —
// found by grepping the output, which is not a way to find things.
const { readdirSync, rmSync, statSync } = await import("node:fs");
const wanted = new Set([...byComposer.keys()].map(folderForComposer));
let cleared = 0;
for (const entry of readdirSync(OUT)) {
    const dir = `${OUT}/${entry}`;
    if (wanted.has(entry) || !statSync(dir).isDirectory()) {
        continue;
    }
    const left = readdirSync(dir);
    if (left.length === 1 && left[0] === "playlist.txt") {
        // Nothing but the playlist: the composer is gone, so the folder goes with it.
        rmSync(dir, { recursive: true });
        cleared += 1;
    } else if (left.includes("playlist.txt")) {
        // Clips are still here for some reason; drop only the description.
        rmSync(`${dir}/playlist.txt`);
        cleared += 1;
    }
}

console.log(
    `Wrote ${written} playlist.txt files under ${OUT}/ (${unlinked} without a link` +
        `${cleared > 0 ? `, ${cleared} stale one(s) removed` : ""}).`,
);
