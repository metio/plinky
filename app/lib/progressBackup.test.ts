// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import type { KeyValueStore } from "../ports/keyValueStore";
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

    it("keeps what the device had when storage refuses the restore", () => {
        // Two of the four writes land, then the device is full. Pruning is what makes
        // a restore destructive, so a failed one must not reach it.
        const target = crowdedStore({ "plinky:mastery:keep-me": "{}" }, 2);

        const result = importProgress(target, exportProgress(memoryStore(device), ""));

        expect(result).toEqual({ ok: false, problem: "storage" });
        expect(target.get("plinky:mastery:keep-me")).toBe("{}");
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
