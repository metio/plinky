// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createSectionBestStore } from "./sectionBestStore";

describe("section best store", () => {
    it("keeps the better reading of each section across runs", () => {
        const store = createSectionBestStore(memoryStore());

        store.record("song", [90, 10, 0, 0, 0, 0]);
        const merged = store.record("song", [20, 80, 50, 0, 0, 0]);

        expect(merged).toEqual([90, 80, 50, 0, 0, 0]);
        expect(store.load("song")).toEqual([90, 80, 50, 0, 0, 0]);
    });

    it("hands back the record as it now stands", () => {
        const store = createSectionBestStore(memoryStore());

        expect(store.record("song", [10, 20, 30, 40, 50, 60])).toEqual([10, 20, 30, 40, 50, 60]);
    });

    it("keeps pieces apart", () => {
        const store = createSectionBestStore(memoryStore());

        store.record("a", [90, 0, 0, 0, 0, 0]);
        store.record("b", [10, 0, 0, 0, 0, 0]);

        expect(store.load("a")?.[0]).toBe(90);
        expect(store.load("b")?.[0]).toBe(10);
    });

    it("reads an unplayed piece as no record", () => {
        expect(createSectionBestStore(memoryStore()).load("never")).toBeNull();
    });

    it("reads a corrupt record as none rather than a wrong one", () => {
        const kv = memoryStore({ "plinky:sectionbest:song": '"not an array"' });

        expect(createSectionBestStore(kv).load("song")).toBeNull();
    });

    it("rebuilds a record stored at the wrong length", () => {
        const kv = memoryStore({ "plinky:sectionbest:song": "[50,60]" });

        // Trusting a short record would drop the sections it never mentioned.
        expect(createSectionBestStore(kv).load("song")).toEqual([50, 60, 0, 0, 0, 0]);
    });
});
