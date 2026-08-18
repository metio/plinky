// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { tidied, tidyCredit, tidyTitle } from "./titles.mts";

describe("tidyCredit", () => {
    it("decodes what should never have reached a reader encoded", () => {
        // Four titles shipped showing this literally; the composer field has been decoded
        // for a while and the title field was not.
        expect(tidyCredit("&quot;Wie des Mondes Abbild&quot;")).toBe('"Wie des Mondes Abbild"');
        expect(tidyCredit("Wie lieb ich dich hab&#39;")).toBe("Wie lieb ich dich hab'");
    });

    it("decodes the ampersand last, so an escaped entity survives its own decoding", () => {
        // Trailing punctuation is trimmed after decoding, so this is written with a word
        // behind it — the point being the ordering, not the trim.
        expect(tidyCredit("&amp;quot; Bach")).toBe("&quot; Bach");
        expect(tidyCredit("Lennon &amp; McCartney")).toBe("Lennon & McCartney");
    });

    it("takes out a link, however it was written", () => {
        expect(tidyCredit("EVENTIDE http://www.hymnary.org/hymn/ELW2006/782")).toBe("EVENTIDE");
        expect(tidyCredit("Scarlatti Questions or mistakes: motransarcor.de")).toBe(
            "Scarlatti Questions or mistakes",
        );
        expect(tidyCredit("Bach www.example.org/x")).toBe("Bach");
    });

    it("leaves a word alone that merely has a dot in it", () => {
        // The bare-domain arm is why this matters: a token with a dot is a word far more
        // often than it is a host.
        expect(tidyCredit("St. Louis Blues")).toBe("St. Louis Blues");
        expect(tidyCredit("J. S. Bach")).toBe("J. S. Bach");
        expect(tidyCredit("Op. 299 No. 1")).toBe("Op. 299 No. 1");
    });

    it("closes the gap a removal leaves", () => {
        expect(tidyCredit("Eventide,  https://imslp.org/x")).toBe("Eventide");
        expect(tidyCredit("  spaced   out  ")).toBe("spaced out");
    });
});

describe("tidyTitle", () => {
    it("gives a capital to a title typed without one", () => {
        expect(tidyTitle("pay me my money down")).toBe("Pay me my money down");
        expect(tidyTitle("cielito lindo")).toBe("Cielito lindo");
    });

    it("leaves the rest of the words as they were written", () => {
        // Capitalizing further is a decision no single rule gets right in every language.
        expect(tidyTitle("men of harlech")).toBe("Men of harlech");
    });

    it("does not argue with a title that already has a capital anywhere", () => {
        expect(tidyTitle("eine kleine Nachtmusik")).toBe("eine kleine Nachtmusik");
        expect(tidyTitle("SI BHEAG SI MHOR")).toBe("SI BHEAG SI MHOR");
    });

    it("leaves the numbering conventions of other languages alone", () => {
        // Correct German and correct French. Rewriting them to "No." would anglicize a
        // title in its own language.
        expect(tidyTitle("Klavierstück Nr. 3")).toBe("Klavierstück Nr. 3");
        expect(tidyTitle("Étude N° 5")).toBe("Étude N° 5");
    });

    it("finds the first letter past whatever comes before it", () => {
        expect(tidyTitle('"suo gan"')).toBe('"Suo gan"');
        expect(tidyTitle("12 deutsche Tänze")).toBe("12 deutsche Tänze");
    });
});

describe("tidied", () => {
    it("keeps the original when tidying would leave nothing at all", () => {
        // A title that is nothing but a URL keeps it until somebody curates a real one: a
        // piece with no name cannot be found, or even reported as broken.
        const url = "https://imslp.org/wiki/Eventide_(Frysinger2C_Frank)";
        expect(tidyTitle(url)).toBe("");
        expect(tidied(url, tidyTitle)).toBe(url);
    });

    it("passes a tidied value through", () => {
        expect(tidied("  Bach  ", tidyCredit)).toBe("Bach");
    });
});
