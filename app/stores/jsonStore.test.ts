// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { KeyValueStore } from "../ports/keyValueStore";
import { memoryStore } from "../adapters/memoryStore";
import {
    createJsonStore,
    createKeyedJsonStore,
    createStringSetStore,
    type JsonStore,
    mergeSubscribe,
    parseJson,
    readJson,
    writeJson,
} from "./jsonStore";

// The factory is exercised over the in-memory fake; only the cross-tab suite
// needs jsdom, for real StorageEvents on window.

const refusing = (kv: KeyValueStore): KeyValueStore => ({ ...kv, set: () => false });

type Shape = { n: number };
const parse = (raw: string | null): Shape => {
    if (raw === null) {
        return { n: 0 };
    }
    try {
        const parsed = JSON.parse(raw) as Shape;
        return typeof parsed?.n === "number" ? parsed : { n: 0 };
    } catch {
        return { n: 0 };
    }
};

const shapeStore = (kv: KeyValueStore): JsonStore<Shape> =>
    createJsonStore(kv, "plinky:test", parse);

describe("readJson / writeJson", () => {
    it("reads a missing key as null", () => {
        expect(readJson(memoryStore(), "nope")).toBeNull();
    });

    it("reads a corrupt entry as null rather than throwing", () => {
        const kv = memoryStore();
        kv.set("bad", "{not json");
        expect(readJson(kv, "bad")).toBeNull();
    });

    it("round-trips a value", () => {
        const kv = memoryStore();
        expect(writeJson(kv, "k", { a: [1, 2] })).toBe(true);
        expect(readJson(kv, "k")).toEqual({ a: [1, 2] });
    });

    it("reports a refused write", () => {
        expect(writeJson(refusing(memoryStore()), "k", 1)).toBe(false);
    });

    it("reports an unserializable value instead of throwing", () => {
        const cycle: Record<string, unknown> = {};
        cycle.self = cycle;
        expect(writeJson(memoryStore(), "k", cycle)).toBe(false);
    });
});

describe("parseJson", () => {
    const coerce = (parsed: unknown): number => (typeof parsed === "number" ? parsed : -1);

    it("reads nothing stored as the fallback without calling coerce", () => {
        const spy = vi.fn(coerce);
        expect(parseJson(null, 7, spy)).toBe(7);
        expect(spy).not.toHaveBeenCalled();
    });

    it("reads corrupt JSON as the fallback rather than throwing", () => {
        expect(parseJson("{not json", 7, coerce)).toBe(7);
    });

    it("hands valid JSON to coerce", () => {
        expect(parseJson("42", 7, coerce)).toBe(42);
        expect(parseJson('"junk"', 7, coerce)).toBe(-1);
    });

    it("contains a throwing coerce to the fallback", () => {
        expect(
            parseJson("42", 7, () => {
                throw new Error("bad shape");
            }),
        ).toBe(7);
    });
});

describe("createStringSetStore", () => {
    it("reads nothing stored, corrupt JSON, and a non-array all as the empty set", () => {
        const kv = memoryStore();
        const store = createStringSetStore(kv, "plinky:set");
        expect(store.load().size).toBe(0);
        kv.set("plinky:set", "{corrupt");
        expect(store.load().size).toBe(0);
        kv.set("plinky:set", '{"a":1}');
        expect(store.load().size).toBe(0);
    });

    it("round-trips a set and drops non-string entries on read", () => {
        const kv = memoryStore();
        const store = createStringSetStore(kv, "plinky:set");
        expect(store.save(new Set(["a", "b"]))).toBe(true);
        expect([...store.load()].sort()).toEqual(["a", "b"]);
        kv.set("plinky:set", JSON.stringify(["a", 1, null, "b"]));
        expect([...store.load()].sort()).toEqual(["a", "b"]);
    });

    it("keeps only members the validity guard admits", () => {
        const kv = memoryStore();
        kv.set("plinky:set", JSON.stringify(["keep", "drop"]));
        const store = createStringSetStore(kv, "plinky:set", (id): id is "keep" => id === "keep");
        expect([...store.load()]).toEqual(["keep"]);
    });
});

describe("mergeSubscribe", () => {
    it("registers the listener with every store and tears all of them down", () => {
        const a = shapeStore(memoryStore());
        const b = createJsonStore(memoryStore(), "plinky:test-b", parse);
        const onChange = vi.fn();
        const unsubscribe = mergeSubscribe(a.subscribe, b.subscribe)(onChange);
        a.save({ n: 1 });
        b.save({ n: 2 });
        expect(onChange).toHaveBeenCalledTimes(2);
        unsubscribe();
        a.save({ n: 3 });
        b.save({ n: 4 });
        expect(onChange).toHaveBeenCalledTimes(2);
    });
});

describe("createJsonStore", () => {
    it("parses the empty store into the default value", () => {
        expect(shapeStore(memoryStore()).load()).toEqual({ n: 0 });
    });

    it("keeps the snapshot object identical until the stored value changes", () => {
        const store = shapeStore(memoryStore());
        const first = store.load();
        expect(store.load()).toBe(first);
        store.save({ n: 1 });
        const second = store.load();
        expect(second).not.toBe(first);
        expect(store.load()).toBe(second);
    });

    it("notifies each subscriber once per landed save", () => {
        const store = shapeStore(memoryStore());
        const onChange = vi.fn();
        store.subscribe(onChange);
        store.save({ n: 1 });
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("skips the write and the wakeup when the value is unchanged", () => {
        const kv = memoryStore();
        const set = vi.spyOn(kv, "set");
        const store = shapeStore(kv);
        const onChange = vi.fn();
        store.subscribe(onChange);
        expect(store.save({ n: 5 })).toBe(true);
        expect(store.save({ n: 5 })).toBe(true);
        expect(set).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("reports a refused write and keeps subscribers quiet", () => {
        const store = shapeStore(refusing(memoryStore()));
        const onChange = vi.fn();
        store.subscribe(onChange);
        expect(store.save({ n: 1 })).toBe(false);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("reports an unserializable value as an unlanded save", () => {
        const store = createJsonStore<unknown>(memoryStore(), "k", (raw) => raw);
        const cycle: Record<string, unknown> = {};
        cycle.self = cycle;
        expect(store.save(cycle)).toBe(false);
    });

    it("keeps notifying the healthy subscriber when another one throws", () => {
        const store = shapeStore(memoryStore());
        const healthy = vi.fn();
        const unsubscribeBroken = store.subscribe(() => {
            throw new Error("broken subscriber");
        });
        store.subscribe(healthy);
        store.save({ n: 1 });
        expect(healthy).toHaveBeenCalledTimes(1);
        unsubscribeBroken();
    });

    it("also shields the cross-tab path from a throwing subscriber", () => {
        const store = shapeStore(memoryStore());
        const healthy = vi.fn();
        const unsubscribeBroken = store.subscribe(() => {
            throw new Error("broken subscriber");
        });
        store.subscribe(healthy);
        window.dispatchEvent(new StorageEvent("storage", { key: "plinky:test" }));
        expect(healthy).toHaveBeenCalledTimes(1);
        unsubscribeBroken();
    });

    it("stops notifying after unsubscribe", () => {
        const store = shapeStore(memoryStore());
        const onChange = vi.fn();
        const unsubscribe = store.subscribe(onChange);
        unsubscribe();
        store.save({ n: 1 });
        expect(onChange).not.toHaveBeenCalled();
    });
});

const keyed = (kv: KeyValueStore) =>
    createKeyedJsonStore<Shape>(kv, "plinky:test:", (raw) => {
        const value = raw as Partial<Shape>;
        return { n: typeof value?.n === "number" ? value.n : 0 };
    });

describe("createKeyedJsonStore", () => {
    it("round-trips entries per id and reads a missing id as null", () => {
        const store = keyed(memoryStore());
        store.save("a", { n: 1 });
        store.save("b", { n: 2 });
        expect(store.load("a")).toEqual({ n: 1 });
        expect(store.load("b")).toEqual({ n: 2 });
        expect(store.load("c")).toBeNull();
    });

    it("keeps an entry's snapshot identical until it changes", () => {
        const store = keyed(memoryStore());
        store.save("a", { n: 1 });
        const first = store.load("a");
        expect(store.load("a")).toBe(first);
        store.save("a", { n: 2 });
        expect(store.load("a")).not.toBe(first);
    });

    it("reads a corrupt entry as null and skips it in loadAll", () => {
        const kv = memoryStore();
        const store = keyed(kv);
        store.save("ok", { n: 1 });
        kv.set("plinky:test:bad", "{corrupt");
        expect(store.load("bad")).toBeNull();
        expect(store.loadAll()).toEqual([{ id: "ok", value: { n: 1 } }]);
    });

    it("ignores keys outside its prefix in loadAll", () => {
        const kv = memoryStore();
        kv.set("plinky:other", JSON.stringify({ n: 9 }));
        const store = keyed(kv);
        store.save("a", { n: 1 });
        expect(store.loadAll()).toEqual([{ id: "a", value: { n: 1 } }]);
    });

    it("skips the write and the wakeup when an entry is unchanged", () => {
        const kv = memoryStore();
        const set = vi.spyOn(kv, "set");
        const store = keyed(kv);
        const onChange = vi.fn();
        store.subscribe(onChange);
        expect(store.save("a", { n: 1 })).toBe(true);
        expect(store.save("a", { n: 1 })).toBe(true);
        expect(set).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("notifies on remove of an existing entry, but not of a missing one", () => {
        const store = keyed(memoryStore());
        const onChange = vi.fn();
        store.save("a", { n: 1 });
        store.subscribe(onChange);
        store.remove("missing");
        expect(onChange).not.toHaveBeenCalled();
        store.remove("a");
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(store.load("a")).toBeNull();
    });

    it("reports a refused write and keeps subscribers quiet", () => {
        const store = keyed(refusing(memoryStore()));
        const onChange = vi.fn();
        store.subscribe(onChange);
        expect(store.save("a", { n: 1 })).toBe(false);
        expect(onChange).not.toHaveBeenCalled();
    });
});

// Another tab's write arrives as the browser's storage event; the bus filters it
// by key so only the affected store's subscribers wake.
describe("cross-tab storage events", () => {
    const storageEvent = (key: string | null) =>
        new StorageEvent("storage", { key: key === null ? undefined : key });

    it("wakes a subscriber when its own key changes in another tab", () => {
        const store = shapeStore(memoryStore());
        const onChange = vi.fn();
        store.subscribe(onChange);
        window.dispatchEvent(storageEvent("plinky:test"));
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("stays quiet for an unrelated key", () => {
        const store = shapeStore(memoryStore());
        const onChange = vi.fn();
        store.subscribe(onChange);
        window.dispatchEvent(storageEvent("plinky:unrelated"));
        expect(onChange).not.toHaveBeenCalled();
    });

    it("treats a null-key event (store cleared) as affecting every key", () => {
        const store = shapeStore(memoryStore());
        const onChange = vi.fn();
        store.subscribe(onChange);
        window.dispatchEvent(new StorageEvent("storage", {}));
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("wakes a keyed store for any key under its prefix", () => {
        const store = keyed(memoryStore());
        const onChange = vi.fn();
        store.subscribe(onChange);
        window.dispatchEvent(storageEvent("plinky:test:some-id"));
        expect(onChange).toHaveBeenCalledTimes(1);
        window.dispatchEvent(storageEvent("plinky:elsewhere:id"));
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("stops listening to storage events after unsubscribe", () => {
        const store = shapeStore(memoryStore());
        const onChange = vi.fn();
        const unsubscribe = store.subscribe(onChange);
        unsubscribe();
        window.dispatchEvent(storageEvent("plinky:test"));
        expect(onChange).not.toHaveBeenCalled();
    });
});
