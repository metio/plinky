// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { BoardArtist } from "../../core/board";
import { fakeBoard } from "./fakeBoard";

const artist: BoardArtist = { id: "a1", name: "Ada Keys", order: 0, text: "Plays daily." };

describe("fakeBoard", () => {
    it("resolves to the given artists regardless of language", async () => {
        const source = fakeBoard([artist]);
        expect(await source.fetchArtists("en")).toEqual([artist]);
        expect(await source.fetchArtists("de")).toEqual([artist]);
    });

    it("resolves to nothing by default", async () => {
        expect(await fakeBoard().fetchArtists("en")).toEqual([]);
    });
});
