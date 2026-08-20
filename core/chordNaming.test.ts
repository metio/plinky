// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type HeldSound, nameHeldNotes } from "./chordNaming";
import { chordPitches } from "./theory";

// Middle C is 60, so these read as they would on a keyboard.
const C4 = 60;
const E4 = 64;
const G4 = 67;
const B4 = 71;
const C5 = 72;

const chord = (sound: HeldSound | null) => (sound?.kind === "chord" ? sound : null);

describe("nameHeldNotes", () => {
    it("says nothing when nothing is held", () => {
        expect(nameHeldNotes([])).toBeNull();
    });

    it("names one note", () => {
        expect(nameHeldNotes([C4])).toEqual({ kind: "note", pitchClass: 0 });
    });

    it("names two notes as an interval rather than a chord with something missing", () => {
        // Calling C+G "C major without its third" would tell a beginner something false
        // about what they are hearing.
        expect(nameHeldNotes([C4, G4])).toEqual({ kind: "interval", interval: "perfect-fifth", lower: 0 });
    });

    it("measures the interval up from the lowest note", () => {
        expect(nameHeldNotes([G4, C5])).toEqual({ kind: "interval", interval: "perfect-fourth", lower: 7 });
    });

    it("names a triad", () => {
        expect(chord(nameHeldNotes([C4, E4, G4]))).toMatchObject({
            root: 0,
            quality: "major",
            inversion: 0,
        });
    });

    it("names a seventh chord", () => {
        expect(chord(nameHeldNotes([C4, E4, G4, B4]))).toMatchObject({
            root: 0,
            quality: "major-seventh",
        });
    });

    it("hears through octaves and doublings", () => {
        // A chord spread across two hands with the root doubled is the same chord as the
        // one under three fingers; a reader is asking what it is, not how many of it.
        expect(chord(nameHeldNotes([C4 - 12, C4, E4, G4, C5]))).toMatchObject({
            root: 0,
            quality: "major",
            inversion: 0,
        });
    });

    it("says which inversion, because the same three notes are a different thing to play", () => {
        expect(chord(nameHeldNotes([E4, G4, C5]))?.inversion).toBe(1);
        expect(chord(nameHeldNotes([G4, C5, E4 + 12]))?.inversion).toBe(2);
    });

    it("keeps the root when an inversion moves the bass, and names the bass", () => {
        // The bass is carried rather than worked back out of the root and the inversion:
        // that arithmetic needs the quality's own stack, and getting it wrong names the
        // wrong note after the slash on every chord but the one it was tested on.
        expect(chord(nameHeldNotes([E4, G4, C5]))).toMatchObject({ root: 0, bass: 4 });
        expect(chord(nameHeldNotes([G4, C5, E4 + 12]))).toMatchObject({ root: 0, bass: 7 });
        expect(chord(nameHeldNotes([69, 72, 76]))).toMatchObject({ quality: "minor", bass: 9 });
    });

    it("gives a symmetrical chord the name its bass note asks for", () => {
        // A diminished seventh is four minor thirds, so every rotation is the same set of
        // notes and nothing inside them settles which is the root — only the music around
        // them does. The lowest note gets the name, which is how a player reading their
        // own hands would say it.
        const onC = chord(nameHeldNotes([C4, C4 + 3, C4 + 6, C4 + 9]));
        expect(onC).toMatchObject({ root: 0, quality: "diminished-seventh", inversion: 0 });
        const onA = chord(nameHeldNotes([C4 - 3, C4, C4 + 3, C4 + 6]));
        expect(onA).toMatchObject({ root: 9, quality: "diminished-seventh", inversion: 0 });
    });

    it("does the same for an augmented triad", () => {
        expect(chord(nameHeldNotes([C4, E4, C4 + 8]))).toMatchObject({
            root: 0,
            quality: "augmented",
        });
        expect(chord(nameHeldNotes([E4, C4 + 8, C4 + 12]))).toMatchObject({
            root: 4,
            quality: "augmented",
        });
    });

    it("says nothing for a handful of notes that is not a chord it teaches", () => {
        // A cluster has a name in some theory somewhere, but not one worth showing to
        // somebody learning what a triad is.
        expect(nameHeldNotes([C4, C4 + 1, C4 + 2])).toBeNull();
    });

    it("names every quality it teaches, from any root", () => {
        // The property that matters: build a chord from the app's own definition and the
        // spotter reads back the same thing, whatever key it is in.
        for (const root of [0, 1, 5, 7, 11]) {
            for (const quality of [
                "major",
                "minor",
                "diminished",
                "dominant-seventh",
                "major-seventh",
                "minor-seventh",
                "half-diminished-seventh",
                "minor-major-seventh",
                "suspended-fourth",
                "added-ninth",
                "dominant-ninth",
                "major-ninth",
                "minor-ninth",
            ] as const) {
                const named = chord(nameHeldNotes(chordPitches(60 + root, quality)));
                expect(named).toMatchObject({ root, quality, inversion: 0 });
            }
        }
    });
    it("lets the bass settle a chord two names have an equal claim to", () => {
        // A sixth and the seventh a third below it are the very same four notes: C E G A
        // is C6 and A minor 7 at once, and a set of pitch classes cannot say which. The
        // lowest sounding note decides, which is how a player reading their own hands
        // would say it — so the same notes name themselves differently depending on what
        // the left hand is holding, and that is correct rather than a tie badly broken.
        expect(chord(nameHeldNotes([C4, C4 + 4, C4 + 7, C4 + 9]))).toMatchObject({
            root: 0,
            quality: "major-sixth",
        });
        expect(chord(nameHeldNotes([C4 - 3, C4, C4 + 4, C4 + 7]))).toMatchObject({
            root: 9,
            quality: "minor-seventh",
        });
    });

    it("tells a suspended second from the suspended fourth under it", () => {
        // Csus2 and Gsus4 are one set of notes rotated, so this is the same tie as the
        // sixth above and the bass breaks it the same way.
        expect(chord(nameHeldNotes([C4, C4 + 2, C4 + 7]))).toMatchObject({
            root: 0,
            quality: "suspended-second",
        });
        expect(chord(nameHeldNotes([C4 - 5, C4, C4 + 2]))).toMatchObject({
            root: 7,
            quality: "suspended-fourth",
        });
    });
});
