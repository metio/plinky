// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { sameWork, workTitle } from "./workTitle";

const same = (one: string, other: string) => sameWork(workTitle(one), workTitle(other));

describe("sameWork", () => {
    it("reads the three Für Elise spellings as one work", () => {
        // The case that exposed this: the catalogue shipped all three as separate rows, and
        // a reader who finds three of one piece concludes the library is broken.
        expect(same("Für Elise", "Fur Elise")).toBe(true);
        expect(same("Für Elise", "Für Elise WoO 59")).toBe(true);
        expect(same("Fur Elise", "Für Elise WoO 59")).toBe(true);
    });

    it("folds an accent, because a transcriber types with the keyboard they have", () => {
        expect(same("Étude", "Etude")).toBe(true);
        expect(same("Sérénade", "Serenade")).toBe(true);
    });

    it("lets a title with no catalogue mark agree with one that has it", () => {
        expect(same("Clair de lune", "Clair de lune L. 32")).toBe(true);
        expect(same("Air on the G String", "Air on the G String BWV 1068")).toBe(true);
    });

    it("never merges two works that carry DIFFERENT catalogue marks", () => {
        // The half that cannot simply be dropped. These are different sets of pieces that
        // happen to share a name, and collapsing them would delete one of them.
        expect(same("Nocturnes Op.27", "Nocturnes Op.9")).toBe(false);
        expect(same("Preludes Op.28", "Preludes Op.23")).toBe(false);
        expect(same("Sonata Hob. XVI:34", "Sonata Hob. XVI:35")).toBe(false);
    });

    it("keeps genuinely different names apart", () => {
        expect(same("Prelude in C", "Prelude in D")).toBe(false);
        expect(same("Gymnopédie No. 1", "Gymnopédie No. 2")).toBe(false);
        expect(same("Hungarian Dance No. 5", "Hungarian Rhapsody No. 5")).toBe(false);
    });

    it("reads one punctuation of a number as another", () => {
        expect(same("Nocturne No.2", "Nocturne No. 2")).toBe(true);
        expect(same("Prelude  in   C", "Prelude in C")).toBe(true);
    });

    it("does not mistake an ordinary word for a catalogue letter", () => {
        // "D", "S", "B" and "L" are catalogue prefixes AND ordinary words. Only a letter
        // followed by a number is a mark.
        expect(workTitle("Song of the Birds").catalogue).toBeNull();
        expect(workTitle("D'un vieux jardin").catalogue).toBeNull();
        expect(workTitle("Le Mère l'Oye").catalogue).toBeNull();
    });

    it("pulls the mark out where there is one", () => {
        expect(workTitle("Für Elise WoO 59").catalogue).toBe("woo 59");
        expect(workTitle("Die Forelle D.550").catalogue).toBe("d 550");
        expect(workTitle("Sonata Hob. XVI:34").catalogue).toBe("hob xvi34");
    });

    it("matches nothing to a title that is nothing at all", () => {
        // An empty name is not evidence that two rows are one piece.
        expect(same("", "")).toBe(false);
        expect(same("   ", "Für Elise")).toBe(false);
    });
});
