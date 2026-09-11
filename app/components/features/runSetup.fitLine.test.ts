// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it } from "vitest";
import { overwriteGetLocale } from "../../paraglide/runtime.js";
import { fitLine } from "./runSetup";

afterEach(() => {
    overwriteGetLocale(() => "en");
});

const shifted = (octaves: number) => ({ kind: "shifted" as const, shift: octaves * 12 });

describe("fitLine", () => {
    it("says nothing when the piece fits as written", () => {
        expect(fitLine({ kind: "fits", shift: 0 })).toBeNull();
    });

    it("calls a single octave an octave, with no number", () => {
        expect(fitLine(shifted(1))).toBe("Moved up an octave to fit your keyboard");
        expect(fitLine(shifted(-1))).toBe("Moved down an octave to fit your keyboard");
    });

    it("counts two octaves and more in the plural", () => {
        expect(fitLine(shifted(2))).toBe("Moved up 2 octaves to fit your keyboard");
        expect(fitLine(shifted(-3))).toBe("Moved down 3 octaves to fit your keyboard");
    });

    it("takes the Polish form for two to four and the one for five and up", () => {
        overwriteGetLocale(() => "pl");
        expect(fitLine(shifted(2))).toBe(
            "Podniesiony o 2 oktawy, żeby zmieścił się na twojej klawiaturze",
        );
        expect(fitLine(shifted(-5))).toBe(
            "Obniżony o 5 oktaw, żeby zmieścił się na twojej klawiaturze",
        );
    });
});
