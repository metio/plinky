// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createSectionBestStore } from "./sectionBestStore";

describe("section best store", () => {
    it("keeps the better reading of each section across runs", () => {
        const store = createSectionBestStore(memoryStore());

        store.record("song", [90, 10, 0, 0, 0, 0]);
        store.record("song", [20, 80, 50, 0, 0, 0]);

        expect(store.load("song")).toEqual([90, 80, 50, 0, 0, 0]);
    });

    it("holds the record as it now stands", () => {
        const store = createSectionBestStore(memoryStore());

        store.record("song", [10, 20, 30, 40, 50, 60]);

        expect(store.load("song")).toEqual([10, 20, 30, 40, 50, 60]);
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

describe("sectionBestStore.record verdicts", () => {
    it("says so when the merged record lands", () => {
        expect(createSectionBestStore(memoryStore()).record("song-1", [80, 70])).toBe(true);
    });

    it("says so when the write is refused, and keeps nothing", () => {
        const store = createSectionBestStore({ ...memoryStore(), set: () => false });
        expect(store.record("song-1", [80, 70])).toBe(false);
        expect(store.load("song-1")).toBeNull();
    });
});
