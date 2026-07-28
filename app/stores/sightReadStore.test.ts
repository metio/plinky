// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { SightReadRecord } from "../../core/sightRead";
import { memoryStore } from "../adapters/memoryStore";
import { createSightReadStore } from "./sightReadStore";

const read: SightReadRecord = { score: 71, letter: "C", atTempo: false, playedAt: 1_700_000_000 };

describe("sight-read store", () => {
    it("keeps the first read of a piece and ignores every later one", () => {
        const store = createSightReadStore(memoryStore());

        expect(store.record("ode-to-joy", read)).toBe(true);
        expect(store.record("ode-to-joy", { ...read, score: 98, letter: "S" })).toBe(true);

        // The second read reports success — nothing failed, there was simply
        // nothing to store — while the first read stands.
        expect(store.load("ode-to-joy")).toEqual(read);
    });

    it("remembers each piece separately", () => {
        const store = createSightReadStore(memoryStore());

        store.record("a", read);
        store.record("b", { ...read, score: 40, letter: "E" });

        expect(store.load("a")?.score).toBe(71);
        expect(store.load("b")?.score).toBe(40);
        expect(store.load("never-played")).toBeNull();
    });

    it("reads a corrupt entry as nothing rather than crashing", () => {
        const kv = memoryStore({ "plinky:sightread:broken": '{"score":"nope"}' });

        expect(createSightReadStore(kv).load("broken")).toBeNull();
    });

    it("reports a refused write so a caller is not told it saved", () => {
        const refusing = { ...memoryStore(), set: () => false };

        expect(createSightReadStore(refusing).record("a", read)).toBe(false);
    });

    it("notifies subscribers when a read lands", () => {
        const store = createSightReadStore(memoryStore());
        let notified = 0;
        store.subscribe(() => notified++);

        store.record("a", read);
        expect(notified).toBe(1);

        // A re-read stores nothing, so nobody is woken.
        store.record("a", { ...read, score: 99 });
        expect(notified).toBe(1);
    });
});
