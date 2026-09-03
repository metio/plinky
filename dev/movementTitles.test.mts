// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { movementCandidates } from "./movementTitles.mts";

// The credit blocks here are transcribed from scores the catalogue actually holds. A rule
// that reads well against invented input and drops the one line that mattered on a real
// engraving is the failure this guards against.

const lines = (raw: readonly string[], title: string, composer: string) =>
    movementCandidates(raw, title, composer).map((candidate) => candidate.line);

describe("the movement a score prints about itself", () => {
    it("keeps the numbered study and drops the work title and the composer", () => {
        expect(
            lines(
                [
                    "Czerny - The Art Of Finger Dexterity",
                    "1. Action Of The Fingers, the Hand quiet.",
                    "C.Czerny, Op. 740, Book 1",
                    "--",
                ],
                "Czerny - The Art Of Finger Dexterity",
                "C.Czerny, Op. 740, Book 1",
            ),
        ).toEqual(["1. Action Of The Fingers, the Hand quiet."]);
    });

    it("reads a roman movement number", () => {
        expect(
            lines(
                ["III. Clair de Lune", "Claude-Achille Debussy"],
                "Suite bergamasque",
                "DebussyC",
            ),
        ).toEqual(["III. Clair de Lune"]);
    });

    it("reads a catalogue number", () => {
        expect(
            lines(["Sonata", "K. 35", "Domenico Scarlatti"], "Sonata", "Domenico Scarlatti"),
        ).toEqual(["K. 35"]);
    });

    it("puts the numbered line first, ahead of a tempo marking", () => {
        expect(
            lines(["Andantino", "Op. 28 No. 7", "Frédéric Chopin"], "Prelude", "Frédéric Chopin"),
        ).toEqual(["Op. 28 No. 7", "Andantino"]);
    });

    it("drops a life span printed under the composer", () => {
        expect(
            lines(
                ["Etude 11, Op 176", "Jean-Baptiste Duvernoy", "c. 1802 – c. 1880"],
                "Elementary Studies (op 176)",
                "Jean-Baptiste Duvernoy c. 1802 c. 1880",
            ),
        ).toEqual(["Etude 11, Op 176"]);
    });

    it("drops an arranger's credit, which names the wrong person", () => {
        expect(
            lines(
                [
                    "Holberg Suite",
                    "Edvard Grieg, Op. 40",
                    "Arr. for piano 4 hands by",
                    "Theodor Kirchner",
                ],
                "Holberg Suite",
                "Edvard Grieg, Op. 40",
            ),
        ).toEqual(["Theodor Kirchner"]);
    });

    it("says nothing where the score prints nothing", () => {
        expect(lines([], "French Suite no. 5 in G major", "J. S. Bach")).toEqual([]);
    });

    it("matches the title through punctuation and case", () => {
        expect(lines(["Suite Bergamasque"], "Suite bergamasque", "Claude Debussy")).toEqual([]);
    });

    it("matches the composer through the spellings the alias table knows", () => {
        expect(lines(["ChopinFF", "F. Chopin"], "Prelude", "Frédéric Chopin")).toEqual([]);
    });
});
