// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import type { KeyValueStore } from "../ports/keyValueStore";
import { adoptLegacyKeys } from "./legacyKeys";
import { PREFIX } from "./resetDevice";

describe("carrying over keys stored under the old name", () => {
    it("moves a legacy key to the prefix this build reads", () => {
        const kv = memoryStore({ "plinky:mastery:twinkle": '{"bestScore":91}' });

        expect(adoptLegacyKeys(kv)).toBe(1);

        expect(kv.get(`${PREFIX}mastery:twinkle`)).toBe('{"bestScore":91}');
        expect(kv.get("plinky:mastery:twinkle")).toBeNull();
    });

    it("leaves keys belonging to anything else on the origin alone", () => {
        const kv = memoryStore({
            "plinky:prefs": "{}",
            "someone-else:token": "secret",
            theme: "dark",
        });

        adoptLegacyKeys(kv);

        expect(kv.get("someone-else:token")).toBe("secret");
        expect(kv.get("theme")).toBe("dark");
    });

    it("runs again without undoing itself", () => {
        const kv = memoryStore({ "plinky:lifetime": "7" });

        expect(adoptLegacyKeys(kv)).toBe(1);
        expect(adoptLegacyKeys(kv)).toBe(0);
        expect(kv.get(`${PREFIX}lifetime`)).toBe("7");
    });

    it("keeps what this build already wrote, and drops the older copy beside it", () => {
        const kv = memoryStore({
            "plinky:theme": '"light"',
            [`${PREFIX}theme`]: '"black"',
        });

        // Nothing moved: the current value stands.
        expect(adoptLegacyKeys(kv)).toBe(0);

        expect(kv.get(`${PREFIX}theme`)).toBe('"black"');
        expect(kv.get("plinky:theme")).toBeNull();
    });

    // A refused write must never cost the player the only copy they have.
    it("keeps the legacy key when the device refuses the write", () => {
        const backing = memoryStore({ "plinky:scores": "[1]" });
        const refusing: KeyValueStore = { ...backing, set: () => false };

        expect(adoptLegacyKeys(refusing)).toBe(0);

        expect(refusing.get("plinky:scores")).toBe("[1]");
        expect(refusing.get(`${PREFIX}scores`)).toBeNull();
    });

    it("does nothing on a device that never saw the old name", () => {
        const kv = memoryStore({ [`${PREFIX}prefs`]: "{}" });

        expect(adoptLegacyKeys(kv)).toBe(0);

        expect(kv.get(`${PREFIX}prefs`)).toBe("{}");
    });

    it("does nothing when storage cannot be read at all", () => {
        expect(adoptLegacyKeys(memoryStore({}))).toBe(0);
    });
});
