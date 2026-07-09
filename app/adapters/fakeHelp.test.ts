// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { HelpItem } from "../../core/help";
import { fakeHelp } from "./fakeHelp";

const item: HelpItem = { id: "h1", pageKey: "play", order: 0, text: "Play a note." };

describe("fakeHelp", () => {
    it("resolves to the given items regardless of language", async () => {
        expect(await fakeHelp([item]).fetchItems("de")).toEqual([item]);
    });

    it("resolves to an empty list by default", async () => {
        expect(await fakeHelp().fetchItems("en")).toEqual([]);
    });
});
