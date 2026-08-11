// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createPlacementStore } from "./placementStore";

const result = { rating: 900, grade: 3, takenAt: 1_700_000_000 };

describe("placement store", () => {
    it("keeps the latest result rather than a history", () => {
        const store = createPlacementStore(memoryStore());

        store.save(result);
        store.save({ ...result, rating: 1200, grade: 4 });

        // The question is where to start now, so the newest answer replaces the old.
        expect(store.load()).toEqual({ ...result, rating: 1200, grade: 4 });
    });

    it("reads an untested device as nothing", () => {
        expect(createPlacementStore(memoryStore()).load()).toBeNull();
    });

    it("reads a half-written result as nothing rather than a broken one", () => {
        const kv = memoryStore({ "plinky:placement": '{"rating":900}' });

        expect(createPlacementStore(kv).load()).toBeNull();
    });

    it("clears back to untested", () => {
        const store = createPlacementStore(memoryStore());
        store.save(result);

        store.clear();

        expect(store.load()).toBeNull();
    });

    it("reports a refused write", () => {
        const refusing = { ...memoryStore(), set: () => false };

        expect(createPlacementStore(refusing).save(result)).toBe(false);
    });

    it("notifies subscribers when a result lands", () => {
        const store = createPlacementStore(memoryStore());
        let notified = 0;
        store.subscribe(() => notified++);

        store.save(result);

        expect(notified).toBe(1);
    });
});
