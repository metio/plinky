// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { collectionPieces } from "./promo/collections.mjs";
import { folderFor, PIECES } from "./promo/pieces.mjs";

// A clip is written to the folder its piece names, so two pieces naming one folder means the
// second render silently replaces the first — hours in, and reported as a success. The
// curated shelf guards this at import because it is written by hand; the collections cannot,
// because they are whatever the catalogue holds, and the catalogue titles six movements of
// one suite identically.

describe("promo folders", () => {
    it("gives every collection piece a folder of its own", () => {
        const pieces = collectionPieces();
        const folders = new Set(pieces.map((piece) => folderFor(piece)));
        expect(folders.size).toBe(pieces.length);
    });

    it("gives every curated piece a folder of its own", () => {
        const folders = new Set(PIECES.map((piece) => folderFor(piece)));
        expect(folders.size).toBe(PIECES.length);
    });

    it("separates same-titled pieces by their variant", () => {
        const one = { id: "a", title: "Prelude", composer: "Frédéric Chopin" };
        const two = { ...one, id: "b" };
        expect(folderFor(one)).toBe(folderFor(two));
        expect(folderFor({ ...one, variant: one.id })).not.toBe(
            folderFor({ ...two, variant: two.id }),
        );
    });

    it("names a folder from the canonical composer, not the spelling the corpus supplied", () => {
        expect(folderFor({ id: "a", title: "Prelude", composer: "ChopinFF" })).toBe(
            folderFor({ id: "a", title: "Prelude", composer: "Frédéric Chopin" }),
        );
    });
});
