// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { GLOSSARY } from "../../core/glossary";
import { symbolGloss, symbolName } from "./glossaryLabels";

// core owns which marks exist and this file owns the words for them, so the two can
// drift: an entry added to the catalogue without a name here falls back to its id, and
// the page renders "shapeNote" at a reader in twenty-six languages. Nothing else notices —
// the message gate only checks that a key every locale carries is referenced somewhere,
// and a key nobody added is a key nobody misses.
describe("every glossary entry has words", () => {
    it.each(GLOSSARY.map((entry) => entry.id))("names %s", (id) => {
        expect(symbolName(id)).not.toBe(id);
        expect(symbolName(id).trim()).not.toBe("");
    });

    it.each(GLOSSARY.map((entry) => entry.id))("glosses %s", (id) => {
        expect(symbolGloss(id).trim()).not.toBe("");
    });
});

describe("an id the glossary does not hold", () => {
    it("falls back to itself rather than throwing", () => {
        expect(symbolName("not-a-symbol")).toBe("not-a-symbol");
        expect(symbolGloss("not-a-symbol")).toBe("");
    });
});
