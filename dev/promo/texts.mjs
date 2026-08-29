// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words that go up with each clip: a YouTube title and description, written to
// youtube.txt beside the video it belongs to.
//
// Generated rather than written, for the same reason the thumbnails are. Fifty-three
// pieces is more than anybody edits by hand twice, and a description that drifts from the
// clip it sits under is worse than none — the grade, the tempo and the licence all come
// from the catalogue the video was rendered from, so they cannot disagree with it.
//
// What each description has to carry, in order of why: a sentence saying what the viewer
// is looking at, the piece's own facts, a link that opens THAT piece to play, where to
// follow, and the licence. The link is the point of the whole exercise — a clip that cannot be acted on
// is an advert, and one that opens the piece under the viewer's hands is an invitation.

import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { folderFor, PIECES } from "./pieces.mjs";
import { collectionPieces } from "./collections.mjs";
import { FOLLOW_US } from "../../core/social.ts";
import { FINGER_LEGEND } from "./fingerLegend.mjs";
import { uploadText } from "./uploadText.mjs";

// Absent and present-but-empty both fall back. indexOf answers -1 for absent, and -1 + 1
// is 0 — argv[0] is the node binary, so the naive form writes every file inside whatever
// directory node happens to live in.
const outAt = process.argv.indexOf("--out");
const OUT = (outAt >= 0 ? process.argv[outAt + 1] : undefined) ?? "promo";
// One line per channel, from the single list in core/social.
const FOLLOW_LINES = FOLLOW_US.map((c) => `${c.label}: ${c.href}`);

const SITE = "https://plinky.fun";

const manifest = JSON.parse(await readFile("public/songs/manifest.json", "utf8"));
const items = Array.isArray(manifest) ? manifest : manifest.items;
const byId = new Map(items.map((item) => [item.id, item]));

// What a grade means to somebody reading a video description, who has never seen the
// ladder. The number alone is jargon; this is the sentence it stands for.
function difficulty(grade) {
    if (grade <= 2) return "an early-grades piece — playable in your first months";
    if (grade <= 4) return "around grades 3–4";
    if (grade <= 6) return "around grades 5–6";
    return "an advanced piece";
}

// A credit for a video card: the short form the promo list already chose, since that is
// what is burnt into the frames. Saying something different underneath would read as two
// different attributions of the same recording.
// "Greensleeves by Traditional" reads as a person nobody has met. A tradition is what a
// piece came FROM rather than who wrote it, and the sentence has to say so.
function credit(composer) {
    return /\b(traditional|trad|anonymous|anon)\b/i.test(composer)
        ? ", traditional"
        : ` by ${composer}`;
}

function describe(piece, entry) {
    const grade = entry?.grade;
    const tempo = entry?.tempo;
    const facts = [
        grade ? difficulty(grade) : null,
        tempo ? `written at about ${tempo} beats a minute` : null,
    ].filter(Boolean);

    // One line per paragraph: YouTube wraps a description to the reader's own width, so
    // hard breaks put in here show up as ragged half-lines on a phone.
    return [
        `${piece.title}${credit(piece.composer)}, played in Plinky — the notes falling as they sound, and the keys lighting under them.`,
        "",
        facts.length > 0
            ? `${facts.join(", ")}.`.replace(/^./, (first) => first.toUpperCase())
            : null,
        facts.length > 0 ? "" : null,
        `Play this one yourself: ${SITE}/en/play/${piece.id}/`,
        "",
        // The colours are the one thing on screen a viewer cannot work out for themselves.
        // They are not decoration and they are not the pitch: each names the finger that
        // plays the note, so somebody watching can read a fingering off the video without
        // knowing that is what they are doing. Written out because the mapping is fixed
        // forever (core/videoLook) — a viewer who learns it once has learned it for every
        // clip, and that is only worth anything if it is stated somewhere.
        "The colour of each note is the finger that plays it:",
        ...FINGER_LEGEND,
        "",
        "Plinky is a free piano practice app that runs in the browser — nothing to install, no account. It listens through a MIDI piano or your microphone and tells you how the run actually went, hand by hand.",
        "",
        SITE,
        "",
        // Where somebody who liked the clip goes next. A viewer who watched to the end is
        // the one person most likely to follow, and YouTube gives them nowhere to do it —
        // the description is the only place these can be said.
        "More Plinky:",
        ...FOLLOW_LINES,
        "",
        // No entry means no licence, and a licence is a legal fact about a particular
        // score rather than a default. Guessing CC0 would tell a viewer they may reuse an
        // edition nothing here has checked — and it contradicted the warning printed
        // below, which says the text carries no licence. Every piece in the promo set has
        // one today, so this drops nothing; it is here for the one that arrives without.
        entry?.license
            ? `Score: ${entry.license}. The catalogue is Creative Commons throughout, so every piece here is one you are free to play, share and record.`
            : null,
    ]
        .filter((line) => line !== null)
        .join("\n");
}

// The curated shelf and every piece of every named work. A collection's clips are uploaded
// like any other and need the same words under them — they were the only videos going up
// with an empty description, because this walked the curated list alone.
//
// Deduplicated by where the clip lands rather than by id: a piece can sit in two
// collections and on the shelf besides, and all three want the one file.
const seen = new Set();
const everyPiece = [...PIECES, ...collectionPieces()].filter((piece) => {
    const at = folderFor(piece);
    if (seen.has(at)) {
        return false;
    }
    seen.add(at);
    return true;
});

let written = 0;
for (const piece of everyPiece) {
    const entry = byId.get(piece.id);
    const dir = `${OUT}/${folderFor(piece)}`;
    await mkdir(dir, { recursive: true });
    // The title carries the word a viewer actually searches for. "Gymnopédie No. 1" alone
    // competes with every recording ever made of it; the instrument is what narrows it.
    const title = `${piece.title} — ${piece.composer} | piano`;
    await writeFile(`${dir}/youtube.txt`, uploadText(title, describe(piece, entry)));
    written += 1;
    if (!entry) {
        console.warn(`  ${piece.title}: not in the catalogue, so no grade or licence in its text`);
    }
}
console.log(`Wrote ${written} youtube.txt files under ${OUT}/.`);
