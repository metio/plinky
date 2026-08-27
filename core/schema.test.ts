// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { schemaStanding } from "./schema";

describe("schemaStanding", () => {
    it("reads an unstamped device as this shape, because no other has shipped", () => {
        expect(schemaStanding(null, 3)).toBe("fresh");
        expect(schemaStanding("", 3)).toBe("fresh");
        expect(schemaStanding("   ", 3)).toBe("fresh");
    });

    it("names the three real standings", () => {
        expect(schemaStanding("3", 3)).toBe("current");
        expect(schemaStanding("2", 3)).toBe("older");
        expect(schemaStanding("4", 3)).toBe("newer");
    });

    it("treats a damaged stamp as unstamped rather than as newer", () => {
        // Refusing every write over a stray value would lock the player out of their own
        // device, and the values themselves are still whatever they always were.
        for (const junk of ["banana", "{}", "NaN", "1.5", "-1", "0", "1e400"]) {
            expect(schemaStanding(junk, 3)).toBe("fresh");
        }
    });

    it("keeps reading a far-future stamp as newer", () => {
        expect(schemaStanding("999", 1)).toBe("newer");
    });
});
