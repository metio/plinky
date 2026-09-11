// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { quotaStore, sizeOf, snapshotOf } from "../testing/quotaStore";
import { exportProgress, importProgress } from "./progressBackup";
import { PREFIX } from "./resetDevice";

const key = fc.constantFrom("a", "b", "c", "d", "takes:x", "takes:y");
const value = fc.string({ maxLength: 60 });
const prefixed = (entries: Record<string, string>) =>
    Object.fromEntries(Object.entries(entries).map(([k, v]) => [PREFIX + k, v]));

// A device (Plinky's keys plus another site's), a bundle, and a quota the device already
// fits inside with some room to spare.
const scenario = fc.record({
    here: fc.dictionary(key, value),
    other: fc.option(value, { nil: undefined }),
    there: fc.dictionary(key, value, { minKeys: 1 }),
    spare: fc.nat({ max: 300 }),
});

type Scenario = {
    here: Record<string, string>;
    other: string | undefined;
    there: Record<string, string>;
    spare: number;
};

function setUp({ here, other, there, spare }: Scenario) {
    const original = { ...prefixed(here), ...(other === undefined ? {} : { "other-app": other }) };
    const capacity = sizeOf(memoryStore(original)) + spare;
    const target = quotaStore(original, capacity);
    const bundle = exportProgress(memoryStore(prefixed(there)), "");
    return { original, capacity, target, bundle };
}

describe("importProgress under a quota", () => {
    it("leaves the device exactly as it was whenever a restore fails", () => {
        fc.assert(
            fc.property(scenario, (input) => {
                const { original, target, bundle } = setUp(input);
                const result = importProgress(target, bundle);
                if (!result.ok) {
                    // The device fit before the restore began, so there is always room to
                    // put it back: a refused restore must be a full one.
                    expect(result).toEqual({ ok: false, problem: "storage", undone: true });
                    expect(snapshotOf(target)).toEqual(original);
                }
            }),
        );
    });

    it("holds exactly the bundle, and the other site's key untouched, whenever one succeeds", () => {
        fc.assert(
            fc.property(scenario, (input) => {
                const { target, bundle } = setUp(input);
                const result = importProgress(target, bundle);
                if (result.ok) {
                    const expected = {
                        ...prefixed(input.there),
                        ...(input.other === undefined ? {} : { "other-app": input.other }),
                    };
                    expect(snapshotOf(target)).toEqual(expected);
                }
            }),
        );
    });

    it("succeeds whenever the device has room for each key's larger value", () => {
        // What clearing the device's own values first buys: the restore never needs room
        // for the device's pieces and the bundle's at once, only for whichever of the two
        // values a shared key holds is bigger.
        fc.assert(
            fc.property(scenario, (input) => {
                const { capacity, target, bundle } = setUp(input);
                const otherSize =
                    input.other === undefined ? 0 : "other-app".length + input.other.length;
                const needed =
                    otherSize +
                    Object.entries(input.there).reduce((sum, [k, v]) => {
                        const old = input.here[k];
                        const larger = Math.max(v.length, old === undefined ? 0 : old.length);
                        return sum + PREFIX.length + k.length + larger;
                    }, 0);
                fc.pre(capacity >= needed);
                expect(importProgress(target, bundle).ok).toBe(true);
            }),
        );
    });
});
