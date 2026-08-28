// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { usableTitle } from "./legibleTitle.mts";

describe("usableTitle", () => {
    it("takes the first candidate that names something", () => {
        expect(usableTitle("Gymnopédie No. 1", "from the index")).toBe("Gymnopédie No. 1");
        expect(usableTitle("", "from the index")).toBe("from the index");
        expect(usableTitle(undefined, undefined, "last resort")).toBe("last resort");
    });

    it("does not mistake a notation program's default text for a name", () => {
        // MuseScore writes these into every new score. 157 pieces called "Untitled" and
        // 21 called "Title" reached readers this way.
        for (const placeholder of [
            "Untitled",
            "untitled",
            "Title",
            "Score",
            "Composer",
            "Untitled score",
            "New Score",
            "n/a",
        ]) {
            expect(usableTitle(placeholder, "the real name")).toBe("the real name");
        }
    });

    it("answers empty when nothing names the piece", () => {
        expect(usableTitle("Untitled", "", undefined)).toBe("");
        expect(usableTitle()).toBe("");
    });

    it("keeps a real title that merely looks unusual", () => {
        // The placeholder list must not eat a genuine name.
        expect(usableTitle("Scores and Parts")).toBe("Scores and Parts");
        expect(usableTitle("Titelmusik")).toBe("Titelmusik");
        expect(usableTitle("Für Elise")).toBe("Für Elise");
    });

    it("still repairs text that was mangled in transit", () => {
        // usableTitle runs legibleTitle first, so the two jobs compose.
        expect(usableTitle("FÃ¼r Elise")).toBe("Für Elise");
    });
});
