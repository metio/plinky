// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { pageTitle } from "./site";

describe("pageTitle", () => {
    it("ends with the brand and leads with the specific part", () => {
        expect(pageTitle("Sight-reading sprint")).toBe("Sight-reading sprint · Plinky");
        expect(pageTitle("C major scale", "Practice")).toBe("C major scale · Practice · Plinky");
    });
});
