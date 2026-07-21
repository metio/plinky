// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { prefChanges } from "./analyticsPrefs";
import { DEFAULT_PREFS, type Prefs } from "./prefs";

const withChange = (change: Partial<Prefs>): Prefs => ({ ...DEFAULT_PREFS, ...change });

describe("prefChanges", () => {
    it("reports nothing between identical snapshots", () => {
        expect(prefChanges(DEFAULT_PREFS, DEFAULT_PREFS)).toEqual([]);
    });

    it("reports a flipped boolean with its new value", () => {
        expect(prefChanges(DEFAULT_PREFS, withChange({ colorNotes: !DEFAULT_PREFS.colorNotes }))).toEqual(
            [{ setting: "colorNotes", value: !DEFAULT_PREFS.colorNotes }],
        );
    });

    it("reports a changed enum and number", () => {
        const changes = prefChanges(
            DEFAULT_PREFS,
            withChange({ noteScale: 1.5, keyboardTheme: "sunset" }),
        );
        expect(changes).toContainEqual({ setting: "noteScale", value: 1.5 });
        expect(changes).toContainEqual({ setting: "keyboardTheme", value: "sunset" });
    });

    it("ignores the drag-continuous volume, whose every step would flood", () => {
        expect(prefChanges(DEFAULT_PREFS, withChange({ volume: DEFAULT_PREFS.volume + 1 }))).toEqual(
            [],
        );
    });

    it("reports a structured pref as 'changed', not its shape", () => {
        const changed = withChange({
            handSpan: { ...DEFAULT_PREFS.handSpan, left: 7 },
        });
        expect(prefChanges(DEFAULT_PREFS, changed)).toEqual([{ setting: "handSpan", value: "changed" }]);
    });

    it("collects several changes from one save", () => {
        const changes = prefChanges(
            DEFAULT_PREFS,
            withChange({ highway: true, treadmill: true, barNumbers: false }),
        );
        expect(changes.map((c) => c.setting).sort()).toEqual([
            "barNumbers",
            "highway",
            "treadmill",
        ]);
    });
});
