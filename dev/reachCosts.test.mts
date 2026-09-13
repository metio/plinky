// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readReachCosts, serializeReachCosts, writeReachCosts } from "./reachCosts.mts";

describe("reach costs", () => {
    it("writes one piece per line, sorted by id", () => {
        expect(serializeReachCosts({ b: { melody: 2 }, a: { thinned: 4, melody: 1.5 } })).toBe(
            '{\n"a":{"thinned":4,"melody":1.5},\n"b":{"melody":2}\n}\n',
        );
    });

    it("reads back what it wrote", async () => {
        const path = join(mkdtempSync(join(tmpdir(), "reach-")), "costs.json");
        const costs = { x: { outlined: 3.25 }, y: { melody: 1 } };
        await writeReachCosts(costs, path);
        expect(await readReachCosts(path)).toEqual(costs);
    });

    it("reads a missing file as a catalogue with no ways in", async () => {
        expect(await readReachCosts(join(tmpdir(), "no-such-reach-costs.json"))).toEqual({});
    });
});
