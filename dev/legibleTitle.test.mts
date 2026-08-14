// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { legibleTitle } from "./legibleTitle.mts";

describe("legibleTitle", () => {
    it("leaves an ordinary title alone", () => {
        expect(legibleTitle("Sonata No. 8 “Pathétique”")).toBe("Sonata No. 8 “Pathétique”");
        expect(legibleTitle("  Für  Elise ")).toBe("Für Elise");
    });

    it("keeps accented titles that are merely accented, not damaged", () => {
        // Two accented letters in a row are ordinary in plenty of languages; only a
        // sequence carrying a UTF-8 lead byte is evidence of a wrong decoding.
        for (const title of ["Éire", "Für Elise", "Chanson d'Amour", "Ólafur", "Šárka"]) {
            expect(legibleTitle(title)).toBe(title);
        }
    });

    it("puts back a title that was read in the wrong encoding but kept its bytes", () => {
        // "Für Elise" written as UTF-8 and read as Latin-1.
        expect(legibleTitle("FÃ¼r Elise")).toBe("Für Elise");
        expect(legibleTitle("PoloÃ±ez")).toBe("Poloñez");
    });

    it("drops a run whose bytes are gone, keeping the part that still reads", () => {
        // The real case from the corpus: Arabic whose continuation bytes were lost on
        // the way in, so no round trip can bring it back.
        expect(legibleTitle("Beethoven SilenceÙØ¹ ØªØÙØØª ÙØÙØ ØÙØºÙØÙ")).toBe(
            "Beethoven Silence",
        );
    });

    it("returns nothing when nothing legible is left", () => {
        // The caller falls back to its own placeholder rather than printing rubble.
        expect(legibleTitle("ØªØÙØØª ÙØÙØ")).toBe("");
    });
});
