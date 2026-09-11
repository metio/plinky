// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import type { KeyValueStore } from "../ports/keyValueStore";
import { quotaStore, sizeOf, snapshotOf } from "../testing/quotaStore";
import { countProgressEntries, exportProgress, importProgress } from "./progressBackup";
import { PREFIX } from "./resetDevice";

const device = {
    "plinky:prefs": '{"noteLabels":"all"}',
    "plinky:mastery:scale-c-major": '{"bestScore":91,"learned":true}',
    "plinky:takes:ode-to-joy": "[]",
    "plinky:theme": '"dark"',
};

// A store that refuses writes past `limit`, standing in for a device out of quota.
function crowdedStore(seed: Record<string, string>, limit: number): KeyValueStore {
    const inner = memoryStore(seed);
    let writes = 0;
    return { ...inner, set: (key, value) => writes++ < limit && inner.set(key, value) };
}

const x = (n: number) => "x".repeat(n);

describe("progress backup", () => {
    it("carries every Plinky value and leaves other sites' keys behind", () => {
        const store = memoryStore({ ...device, "other-app": "keep" });

        const restored = memoryStore();
        const result = importProgress(restored, exportProgress(store, "2026-07-28T10:00:00.000Z"));

        expect(result).toEqual({ ok: true, restored: 4, savedAt: "2026-07-28T10:00:00.000Z" });
        expect(restored.keys().sort()).toEqual(Object.keys(device).sort());
        expect(restored.get("plinky:mastery:scale-c-major")).toBe(
            device["plinky:mastery:scale-c-major"],
        );
    });

    it("counts what a backup would carry", () => {
        expect(countProgressEntries(memoryStore({ ...device, "other-app": "keep" }))).toBe(4);
        expect(countProgressEntries(memoryStore())).toBe(0);
    });

    it("replaces the device's state rather than merging into it", () => {
        const source = memoryStore({ "plinky:prefs": '{"noteLabels":"off"}' });
        // A piece deleted before the backup was taken must not come back to life.
        const target = memoryStore({
            "plinky:prefs": '{"noteLabels":"all"}',
            "plinky:mastery:deleted-piece": "{}",
        });

        importProgress(target, exportProgress(source, ""));

        expect(target.keys()).toEqual(["plinky:prefs"]);
        expect(target.get("plinky:prefs")).toBe('{"noteLabels":"off"}');
    });

    it("cannot be made to write outside Plinky's own keys", () => {
        const target = memoryStore({ "other-app": "keep" });
        const hostile = JSON.stringify({
            format: "plinky-progress",
            entries: { "../other-app": "owned", prefs: "{}" },
        });

        expect(importProgress(target, hostile)).toMatchObject({ ok: true });
        // The hostile key is confined under the prefix rather than escaping it, and
        // the other site's value is neither overwritten nor pruned.
        expect(target.get("other-app")).toBe("keep");
        expect(target.get("plinky:../other-app")).toBe("owned");
    });

    it("restores a bundle that fits only once the device's own values are gone", () => {
        // The device's takes and the bundle's takes are different keys. Holding both at
        // once would need room for the two together, although the device after the
        // restore holds only the bundle's — so the device's are cleared first.
        const here = { "plinky:takes:x": x(300), "plinky:takes:y": x(300) };
        const there = { "plinky:takes:p": x(250), "plinky:takes:q": x(250) };
        const target = quotaStore(here, sizeOf(memoryStore(here)));

        const result = importProgress(target, exportProgress(memoryStore(there), ""));

        expect(result).toEqual({ ok: true, restored: 2, savedAt: "" });
        expect(snapshotOf(target)).toEqual(there);
    });

    it("keeps what the device had when the bundle cannot fit at all", () => {
        const before = { "plinky:mastery:keep-me": "{}", "other-app": "keep" };
        const target = quotaStore(before, sizeOf(memoryStore(before)) + 20);

        const result = importProgress(target, exportProgress(memoryStore(device), ""));

        expect(result).toEqual({ ok: false, problem: "storage", undone: true });
        expect(snapshotOf(target)).toEqual(before);
    });

    it("puts back what it had already written when the device fills mid-restore", () => {
        // A restore is all or nothing. Stopping at the first refusal would leave mastery
        // from the bundle beside takes and ghosts from this device — one player's
        // progress spliced out of two, with no way back and a message on screen saying
        // nothing had changed. Here the first write lands and the second is refused, so
        // both halves of the rollback run: the bundle's key goes, the device's come back.
        const before = {
            "plinky:mastery:one": '{"bestScore":10}',
            "plinky:mastery:two": '{"bestScore":20}',
        };
        const target = quotaStore(before, sizeOf(memoryStore(before)));

        const result = importProgress(target, exportProgress(memoryStore(device), ""));

        expect(result).toEqual({ ok: false, problem: "storage", undone: true });
        expect(snapshotOf(target)).toEqual(before);
    });

    it("puts a larger value back only once the room it needs is free", () => {
        // The bundle shrinks a value the device holds, then brings a large new one. Putting
        // the old value back while the new one is still stored would need more room than
        // the device ever had, so the new one goes first.
        const before = { "plinky:a": x(100), "plinky:z": x(50) };
        const bundle = { "plinky:a": x(10), "plinky:b": x(130), "plinky:c": x(100) };
        const target = quotaStore(before, sizeOf(memoryStore(before)));

        const result = importProgress(target, exportProgress(memoryStore(bundle), ""));

        expect(result).toEqual({ ok: false, problem: "storage", undone: true });
        expect(snapshotOf(target)).toEqual(before);
    });

    it("frees the room an empty value took before putting back one it cleared", () => {
        // An empty value still costs its key. The device's own empty value is cleared, the
        // bundle's empty one is written into the room it left, and a larger value is then
        // refused: putting the device's back needs that room again, so the bundle's must go
        // first, although both values are the same length.
        const before = { "plinky:s": "" };
        const bundle = { "plinky:t": "", "plinky:u": x(10) };
        const target = quotaStore(before, sizeOf(memoryStore(before)));

        const result = importProgress(target, exportProgress(memoryStore(bundle), ""));

        expect(result).toEqual({ ok: false, problem: "storage", undone: true });
        expect(snapshotOf(target)).toEqual(before);
    });

    it("clears nothing on a device that refuses every write", () => {
        // Such a device could not take back a value once cleared, whatever its size, so
        // it is found out before anything is removed and keeps all it held.
        const before = { "plinky:mastery:keep-me": "{}", "plinky:takes:mine": "[]" };
        const target = crowdedStore(before, 0);

        const result = importProgress(target, exportProgress(memoryStore(device), ""));

        expect(result).toEqual({ ok: false, problem: "storage", undone: true });
        expect(snapshotOf(target)).toEqual(before);
    });

    it("says so when a value it cleared cannot be put back", () => {
        // A device that takes one write and then refuses the rest gets past the check,
        // clears its own values and cannot take them back. The copy has to say the
        // device changed rather than claim nothing did.
        const target = crowdedStore({ "plinky:mastery:keep-me": "{}" }, 1);

        const result = importProgress(target, exportProgress(memoryStore(device), ""));

        expect(result).toEqual({ ok: false, problem: "storage", undone: false });
    });

    it("says so when it cannot even undo itself", () => {
        // A device that refuses the value it is already holding leaves the player
        // genuinely mixed, and the copy has to say that rather than claim nothing
        // changed. It has to be a key the bundle also carries: rolling back a key that
        // was never here is a remove, and a remove cannot be refused.
        const target = crowdedStore({ "plinky:prefs": '{"noteLabels":"off"}' }, 2);

        const result = importProgress(target, exportProgress(memoryStore(device), ""));

        expect(result).toEqual({ ok: false, problem: "storage", undone: false });
    });

    it("reports an unreadable file without touching the device", () => {
        const target = memoryStore(device);

        expect(importProgress(target, "not json")).toEqual({ ok: false, problem: "json" });
        expect(importProgress(target, "{}")).toEqual({ ok: false, problem: "format" });
        expect(target.keys().sort()).toEqual(Object.keys(device).sort());
    });

    it("refuses a bundle exported from a device with nothing on it", () => {
        const result = importProgress(memoryStore(device), exportProgress(memoryStore(), ""));

        expect(result).toEqual({ ok: false, problem: "empty" });
    });
});

describe("keys that collide with Object.prototype", () => {
    it("carries a __proto__ key through a backup", () => {
        const kv = memoryStore();
        kv.set(`${PREFIX}__proto__`, "kept");
        kv.set(`${PREFIX}theme`, '"dark"');
        expect(countProgressEntries(kv)).toBe(2);
        const bundle = exportProgress(kv, "2026-07-31T00:00:00.000Z");
        // Reading __proto__ IS the assertion: the export has to carry a key literally
        // named "__proto__" as data rather than let it reach the prototype, which is the
        // hole this test exists to keep shut.
        // biome-ignore lint/suspicious/noProto: the deprecated accessor is the subject here
        expect(JSON.parse(bundle).entries.__proto__).toBe("kept");
    });

    it("restores it onto a fresh device", () => {
        const source = memoryStore();
        source.set(`${PREFIX}__proto__`, "kept");
        const target = memoryStore();
        const result = importProgress(target, exportProgress(source, "2026-07-31T00:00:00.000Z"));
        expect(result.ok).toBe(true);
        expect(target.get(`${PREFIX}__proto__`)).toBe("kept");
    });

    it("leaves the object prototype alone", () => {
        const kv = memoryStore();
        kv.set(`${PREFIX}__proto__`, "kept");
        exportProgress(kv, "2026-07-31T00:00:00.000Z");
        expect(Object.getPrototypeOf({})).toBe(Object.prototype);
        expect(({} as Record<string, unknown>).kept).toBeUndefined();
    });
});
