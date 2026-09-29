// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { quotaStore, sizeOf, snapshotOf } from "../testing/quotaStore";
import {
    createJsonStore,
    createKeyedJsonStore,
    createStringSetStore,
    mergeSubscribe,
    readJson,
    writeJson,
} from "./jsonStore";

// The one idiom every persistent store is built from: parse what is there defensively,
// write with a verdict saying whether it landed, hand React a snapshot that stays the
// same object until the value really changes, and wake subscribers only for writes that
// happened. Everything a player owns — progress, takes, assignments, settings — goes
// through here, so a fault here is their data, and the verdict is what the
// storage-health banner reads.

const KEY = "plinky:thing";

const arbValue = fc.oneof(
    fc.integer(),
    fc.string(),
    fc.boolean(),
    fc.constant(null),
    fc.array(fc.integer(), { maxLength: 5 }),
    fc.record({ a: fc.integer(), b: fc.string() }),
);

const parseAny = (raw: string | null): unknown => {
    if (raw === null) {
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const jsonOrNothing = (raw: string): unknown => {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

describe("a value kept under one key", () => {
    it("reads back what it wrote, here and after a reload", () => {
        fc.assert(
            fc.property(arbValue, (value) => {
                const kv = memoryStore();
                const store = createJsonStore(kv, KEY, parseAny);

                expect(store.save(value)).toBe(true);

                expect(store.load()).toEqual(value);
                // A fresh store over the same device is what a reload is.
                expect(createJsonStore(kv, KEY, parseAny).load()).toEqual(value);
            }),
        );
    });

    it("hands back the same snapshot until the value really changes", () => {
        fc.assert(
            fc.property(arbValue, arbValue, (first, second) => {
                const kv = memoryStore();
                const store = createJsonStore(kv, KEY, parseAny);
                store.save(first);

                const once = store.load();

                // Nothing changed, so a React subscription must see the same object
                // rather than a new one every render.
                expect(store.load()).toBe(once);
                store.save(second);
                if (JSON.stringify(second) !== JSON.stringify(first)) {
                    expect(store.load()).not.toBe(once);
                }
                expect(store.load()).toBe(store.load());
            }),
        );
    });

    it("wakes subscribers for a change, and for nothing else", () => {
        fc.assert(
            fc.property(arbValue, arbValue, (first, second) => {
                const kv = memoryStore();
                const store = createJsonStore(kv, KEY, parseAny);
                store.save(first);
                let woken = 0;
                const off = store.subscribe(() => {
                    woken += 1;
                });

                // Saving what is already stored is not a change.
                expect(store.save(first)).toBe(true);
                expect(woken).toBe(0);

                store.save(second);
                expect(woken).toBe(JSON.stringify(second) === JSON.stringify(first) ? 0 : 1);

                off();
                store.save(first);
                expect(woken).toBe(JSON.stringify(second) === JSON.stringify(first) ? 0 : 1);
            }),
        );
    });

    it("says so when a write does not land, and leaves the device as it was", () => {
        fc.assert(
            fc.property(fc.string({ minLength: 200, maxLength: 400 }), (big) => {
                // A device with no room at all: every write is refused.
                const kv = quotaStore({}, 0);
                const store = createJsonStore(kv, KEY, parseAny);
                let woken = 0;
                store.subscribe(() => {
                    woken += 1;
                });
                const before = snapshotOf(kv);

                expect(store.save(big)).toBe(false);

                expect(snapshotOf(kv)).toEqual(before);
                expect(sizeOf(kv)).toBe(0);
                // A refused write is not a change, so nobody is told one happened.
                expect(woken).toBe(0);
            }),
        );
    });

    it("keeps the value it had when a later write is refused", () => {
        fc.assert(
            fc.property(fc.integer(), fc.string({ minLength: 80, maxLength: 200 }), (kept, big) => {
                const kv = quotaStore({}, KEY.length + 40);
                const store = createJsonStore(kv, KEY, parseAny);
                expect(store.save(kept)).toBe(true);

                expect(store.save(big)).toBe(false);

                expect(store.load()).toBe(kept);
                expect(createJsonStore(kv, KEY, parseAny).load()).toBe(kept);
            }),
        );
    });

    it("reads corrupt storage as nothing rather than throwing", () => {
        fc.assert(
            fc.property(fc.string({ maxLength: 40 }), (junk) => {
                const kv = memoryStore({ [KEY]: junk });

                expect(() => readJson(kv, KEY)).not.toThrow();
                expect(readJson(kv, KEY)).toEqual(jsonOrNothing(junk));
            }),
        );
        expect(readJson(memoryStore(), KEY)).toBeNull();
    });

    it("refuses a value that has no written form", () => {
        const kv = memoryStore();
        const cycle: Record<string, unknown> = {};
        cycle.self = cycle;

        expect(writeJson(kv, KEY, cycle)).toBe(false);
        expect(createJsonStore(kv, KEY, parseAny).save(cycle)).toBe(false);
        expect(createJsonStore(kv, KEY, parseAny).save(undefined)).toBe(false);
        expect(kv.keys()).toEqual([]);
    });
});

describe("a family of entries under one prefix", () => {
    const PREFIX = "plinky:take:";
    const arbEntries = fc.array(fc.tuple(fc.stringMatching(/^[a-z0-9]{1,8}$/), fc.integer()), {
        maxLength: 8,
    });
    const takes = (kv: ReturnType<typeof memoryStore>) =>
        createKeyedJsonStore<number>(kv, PREFIX, (raw) => {
            if (typeof raw !== "number") {
                throw new Error("not a take");
            }
            return raw;
        });

    it("keeps each entry to itself", () => {
        fc.assert(
            fc.property(arbEntries, (entries) => {
                const kv = memoryStore();
                const store = takes(kv);
                const last = new Map<string, number>();
                for (const [id, value] of entries) {
                    expect(store.save(id, value)).toBe(true);
                    last.set(id, value);
                }

                for (const [id, value] of last) {
                    expect(store.load(id)).toBe(value);
                }
                const all = store.loadAll();
                expect(all.length).toBe(last.size);
                expect(new Set(all.map((one) => one.id))).toEqual(new Set(last.keys()));
                for (const { id, value } of all) {
                    expect(value).toBe(last.get(id));
                }
            }),
        );
    });

    it("forgets one without forgetting the others", () => {
        fc.assert(
            fc.property(arbEntries, (entries) => {
                fc.pre(entries.length > 0);
                const kv = memoryStore();
                const store = takes(kv);
                for (const [id, value] of entries) {
                    store.save(id, value);
                }
                const [gone] = entries[0] as [string, number];
                const others = store.loadAll().filter((one) => one.id !== gone);

                store.remove(gone);

                expect(store.load(gone)).toBeNull();
                expect(store.loadAll()).toEqual(others);
            }),
        );
    });

    it("reads an entry it cannot make sense of as missing", () => {
        fc.assert(
            fc.property(fc.string({ maxLength: 20 }), (junk) => {
                fc.pre(typeof jsonOrNothing(junk) !== "number");
                const kv = memoryStore({ [`${PREFIX}one`]: junk });
                const store = takes(kv);

                expect(() => store.load("one")).not.toThrow();
                expect(store.load("one")).toBeNull();
                // …and it is left out of the family rather than counted as an entry.
                expect(store.loadAll()).toEqual([]);
            }),
        );
    });

    it("ignores keys that are not its own", () => {
        const kv = memoryStore({ "plinky:other": "1", [`${PREFIX}mine`]: "2" });

        expect(takes(kv).loadAll()).toEqual([{ id: "mine", value: 2 }]);
    });
});

describe("a set of strings under one key", () => {
    const known = (value: string): value is "a" | "b" | "c" =>
        value === "a" || value === "b" || value === "c";

    it("holds each member once", () => {
        fc.assert(
            fc.property(fc.array(fc.constantFrom("a", "b", "c"), { maxLength: 10 }), (ids) => {
                const kv = memoryStore();
                const store = createStringSetStore<"a" | "b" | "c">(kv, "plinky:seen", known);

                store.save(new Set(ids));

                expect(store.load()).toEqual(new Set(ids));
            }),
        );
    });

    it("drops a member it does not recognise, and reads junk as an empty set", () => {
        fc.assert(
            fc.property(
                fc.array(fc.constantFrom("a", "b", "zz", "1"), { maxLength: 10 }),
                (ids) => {
                    const kv = memoryStore({ "plinky:seen": JSON.stringify(ids) });

                    const held = createStringSetStore<"a" | "b" | "c">(
                        kv,
                        "plinky:seen",
                        known,
                    ).load();

                    expect(held).toEqual(new Set(ids.filter(known)));
                },
            ),
        );
        for (const junk of ["", "{}", "not json", "[1,2]", "null"]) {
            const kv = memoryStore({ "plinky:seen": junk });

            expect(createStringSetStore<"a" | "b" | "c">(kv, "plinky:seen", known).load()).toEqual(
                new Set(),
            );
        }
    });
});

describe("subscribing across several stores at once", () => {
    it("detaches from every one of them", () => {
        const kv = memoryStore();
        const first = createJsonStore(kv, "plinky:one", parseAny);
        const second = createJsonStore(kv, "plinky:two", parseAny);
        let woken = 0;

        const off = mergeSubscribe(
            first.subscribe,
            second.subscribe,
        )(() => {
            woken += 1;
        });
        first.save(1);
        second.save(2);
        expect(woken).toBe(2);

        off();
        first.save(3);
        second.save(4);

        expect(woken).toBe(2);
    });
});
