// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ExerciseConfig } from "./exerciseGen";
import type { Reach } from "./reach";
import type { ScoreKind } from "./scoreKind";

// The rows of the two shipped manifests — public/songs/manifest.json and
// public/exercises/manifest.json — as the app reads them and the tooling writes them.
// Here rather than in the stores because the bake, import and promo scripts write these
// files and may only reach into core: one description of a row, so a field the manifest
// gains is a field every script sees rather than one each re-describes without.

export type SongMeta = {
    id: string;
    title: string;
    composer: string;
    grade: number;
    // The raw fingering-cost the grade was binned from; lets a grade's songs be
    // ordered easiest-first and a syllabus draw the gentlest of a grade.
    cost: number;
    license: string;
    // Where the piece was sourced from; defaults to PDMX (the whole shipped
    // catalogue) when a manifest entry omits it.
    source?: string;
    credit?: string;
    tempo: number;
    beatsPerBar: number;
    // How many bars the piece runs to. The app reads it nowhere — it is the catalogue
    // pipeline's own tie-break when two transcriptions of one work collapse into one row
    // (dev/dedup-songs prefers the shorter), and the manifest is where that lives. Kept
    // deliberately, so an audit that spots "written, never read" finds the reason here.
    bars: number;
    // The piece's opening bars, baked by dev/bake-incipits so a list can draw the mark
    // that names a piece without fetching its notation. Absent on a piece whose opening
    // would not read, and on any manifest written before it was baked.
    incipit?: string;
    // What the piece is written for (core/scoreKind). Two thirds of the catalogue is a
    // song with a piano part or a choral setting reduced to a grand staff; both are
    // playable and neither is what a grade ladder should offer a beginner, so this is what
    // lets the ladder ask for piano writing while the library keeps everything.
    scoreKind?: ScoreKind;
    // The grades this piece comes out at with its inner notes taken away — baked by
    // npm run songs:cost, absent where nothing can be taken out. A piece two grades above
    // somebody reads as "not yet" and nothing more, when the truth is usually that the tune
    // is within reach and the filling is not; this is what lets a list say so.
    reach?: Reach;
};

// A named work the catalogue holds enough of to work through as one thing — an opus, a
// book of studies, a suite — resolved to its piece ids by `npm run songs:bake`. The app
// turns each into a built-in assignment, so a set is nothing a player has to learn about:
// it is an assignment that was already there.
export type BuiltinAssignment = {
    id: string;
    // A composer and a work. A proper noun, so it is catalogue data rather than a
    // translated string.
    name: string;
    // The pieces, gentlest first, so working through a set is working up through it.
    items: string[];
};

export type ExerciseMeta = {
    id: string;
    title: string;
    grade: number;
    // The raw fingering-cost the grade was binned from; orders a grade's items
    // easiest-first and feeds the skill rating uniformly across songs and exercises.
    cost: number;
    kind: "scale-arpeggio" | "study";
    // A generated scale/arpeggio carries its config so it can be regenerated from the id
    // (the id is a content fingerprint now, not a parseable "scale-c-major" slug).
    config?: ExerciseConfig;
    composer?: string;
    // Curated studies are public-domain transcriptions from PDMX (CC0); generated
    // scales/arpeggios are our own and carry no external licence.
    license?: string;
    // The opening bars, encoded — baked by dev/bake-exercise-incipits.mts so a shelf can
    // draw a scale's shape without generating it.
    incipit?: string;
    tempo: number;
    beatsPerBar: number;
};
