// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { memoryStore } from "./memoryStore";
import { SCHEMA_KEY, versionedStore } from "./versionedStore";

describe("versionedStore", () => {
    it("stamps a device that carries no version", () => {
        const inner = memoryStore({ "plinky:mastery:a": "{}" });

        const { store, standing } = versionedStore(inner, 3);

        expect(standing).toBe("fresh");
        expect(inner.get(SCHEMA_KEY)).toBe("3");
        expect(store.set("plinky:mastery:b", "{}")).toBe(true);
    });

    it("leaves a device already on this version alone", () => {
        const inner = memoryStore({ [SCHEMA_KEY]: "3" });
        let writes = 0;
        const counted = {
            ...inner,
            set: (k: string, v: string) => {
                writes++;
                return inner.set(k, v);
            },
        };

        const { standing } = versionedStore(counted, 3);

        expect(standing).toBe("current");
        expect(writes).toBe(0);
    });

    it("brings an older device's stamp forward", () => {
        const inner = memoryStore({ [SCHEMA_KEY]: "2" });

        expect(versionedStore(inner, 3).standing).toBe("older");
        expect(inner.get(SCHEMA_KEY)).toBe("3");
    });

    describe("a device written by a newer build", () => {
        // Every push deploys, and a tab left open on yesterday's code is still running
        // it. Its parsers read a field they do not know as a default and the next save
        // writes that default back — so without this the older tab quietly normalises
        // the player's progress and overwrites it.
        const newer = () =>
            versionedStore(memoryStore({ [SCHEMA_KEY]: "9", "plinky:mastery:a": '{"v":2}' }), 3);

        it("refuses every write, as an ordinary verdict", () => {
            const { store, standing } = newer();

            expect(standing).toBe("newer");
            expect(store.set("plinky:mastery:a", "{}")).toBe(false);
        });

        it("changes nothing when it refuses", () => {
            const { store } = newer();

            store.set("plinky:mastery:a", "{}");
            store.remove("plinky:mastery:a");

            expect(store.get("plinky:mastery:a")).toBe('{"v":2}');
        });

        it("does not restamp the device down to its own version", () => {
            const inner = memoryStore({ [SCHEMA_KEY]: "9" });

            versionedStore(inner, 3);

            expect(inner.get(SCHEMA_KEY)).toBe("9");
        });

        it("still reads everything, so a backup can still be taken", () => {
            // The one thing that must keep working: taking that away turns a recoverable
            // situation into the loss this exists to prevent.
            const { store } = newer();

            expect(store.get("plinky:mastery:a")).toBe('{"v":2}');
            expect(store.keys()).toContain("plinky:mastery:a");
        });
    });

    describe("a tab left open while a newer build restamps the device", () => {
        it("refuses its writes from the moment the stamp moves, not from its own load", () => {
            const inner = memoryStore({ [SCHEMA_KEY]: "3" });
            const { store, standing, standingNow } = versionedStore(inner, 3);
            expect(standing).toBe("current");
            expect(store.set("plinky:mastery:a", "{}")).toBe(true);

            // The other tab loads tomorrow's build and stamps the device.
            inner.set(SCHEMA_KEY, "4");

            expect(standingNow()).toBe("newer");
            expect(store.set("plinky:mastery:a", '{"stale":true}')).toBe(false);
            store.remove("plinky:mastery:a");
            expect(inner.get("plinky:mastery:a")).toBe("{}");
        });
    });
});
