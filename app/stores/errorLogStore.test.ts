// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { MAX_LOGGED } from "../../core/errorLog";
import { memoryStore } from "../adapters/memoryStore";
import { createErrorLogStore } from "./errorLogStore";

const fault = (message: string, at = 1000) => ({ message, where: "/en/play/x/", at });

describe("errorLogStore", () => {
    it("starts empty and remembers what it records", () => {
        const store = createErrorLogStore(memoryStore());
        expect(store.load()).toEqual([]);

        store.record(fault("boom"));

        expect(store.load().map((one) => one.message)).toEqual(["boom"]);
    });

    it("survives a reload, which is the whole point", () => {
        // The faults worth reading about are the ones that took the page with them. A
        // log held only in memory would describe exactly the crashes mild enough not to
        // matter.
        const kv = memoryStore();
        createErrorLogStore(kv).record(fault("boom"));

        expect(
            createErrorLogStore(kv)
                .load()
                .map((one) => one.message),
        ).toEqual(["boom"]);
    });

    it("reports whether the fault was written down", () => {
        const refusing = createErrorLogStore({ ...memoryStore(), set: () => false });
        expect(refusing.record(fault("boom"))).toBe(false);
        expect(createErrorLogStore(memoryStore()).record(fault("boom"))).toBe(true);
    });

    it("keeps the log bounded however many faults arrive", () => {
        const store = createErrorLogStore(memoryStore());
        for (let i = 0; i < 200; i++) {
            store.record(fault(`fault ${i}`, i));
        }
        expect(store.load()).toHaveLength(MAX_LOGGED);
    });

    it("forgets them on request", () => {
        const store = createErrorLogStore(memoryStore());
        store.record(fault("boom"));

        expect(store.clear()).toBe(true);
        expect(store.load()).toEqual([]);
    });

    it("reads corrupt storage as an empty log rather than failing the page", () => {
        const kv = memoryStore({ "plinky:errors": "{not json" });
        expect(createErrorLogStore(kv).load()).toEqual([]);
    });

    it("notifies subscribers so the panel appears without a reload", () => {
        const store = createErrorLogStore(memoryStore());
        let told = 0;
        store.subscribe(() => {
            told += 1;
        });

        store.record(fault("boom"));

        expect(told).toBe(1);
    });
});
