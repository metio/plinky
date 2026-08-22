// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { SHARD_COUNT, shardName, shardOf } from "./catalogShard";

describe("shardOf", () => {
    it("always names a slice that exists", () => {
        for (const id of ["", "a", "ptZL9y10b88G", "tvxEmMwHkXdb", "a-user-imported-score"]) {
            const shard = shardOf(id);
            expect(Number.isInteger(shard)).toBe(true);
            expect(shard).toBeGreaterThanOrEqual(0);
            expect(shard).toBeLessThan(SHARD_COUNT);
        }
    });

    it("names a slice with digits alone, which no filesystem can case-fold", () => {
        // The whole reason a slice is numbered rather than named after a letter of the id:
        // ids are case-sensitive and filenames on some filesystems are not.
        for (const id of ["aBcDeF", "AbCdEf", "ptZL9y10b88G"]) {
            expect(shardName(id)).toMatch(/^\d+$/);
        }
    });

    it("names slices that sort as numbers do", () => {
        expect(shardName("").length).toBe(2);
        expect(Number(shardName("ptZL9y10b88G"))).toBe(shardOf("ptZL9y10b88G"));
    });

    it("spreads real ids across the slices rather than piling them up", () => {
        // A bucket that is really the first character would leave the rare letters nearly
        // empty and the common ones nearly whole — which is the cost this exists to avoid.
        const ids = Array.from({ length: 3000 }, (_, index) => `id${index.toString(36)}x${index}`);
        const counts = new Map<number, number>();
        for (const id of ids) {
            counts.set(shardOf(id), (counts.get(shardOf(id)) ?? 0) + 1);
        }
        expect(counts.size).toBe(SHARD_COUNT);
        const largest = Math.max(...counts.values());
        // Well under a tenth of the catalogue in any one slice.
        expect(largest).toBeLessThan(ids.length / 10);
    });
});
