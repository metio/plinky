// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What each easier reduction of a piece costs, by song id: the numbers `npm run songs:bake`
// grades a piece's ways in from, written by `npm run songs:cost`.
//
// Kept here rather than in the manifest because no visitor needs them. The app shows the
// way-in grades, which the bake writes into the manifest; the costs behind them exist only
// so the bake can re-grade those when a boundary moves, and in the manifest they were a
// fifteenth of a file every browsing visitor downloads.

import { readFile, writeFile } from "node:fs/promises";
import type { ReductionCosts } from "../core/reach.ts";

export const REACH_COSTS = "dev/catalog-reach-costs.json";

export type ReachCosts = Record<string, ReductionCosts>;

// A missing file is an empty one: a catalogue nothing has been measured for yet has no ways
// in, which is what the bake then writes.
export async function readReachCosts(path = REACH_COSTS): Promise<ReachCosts> {
    const text = await readFile(path, "utf8").catch(() => null);
    return text === null ? {} : (JSON.parse(text) as ReachCosts);
}

// One piece per line, sorted by id, so a remeasure reviews as the pieces whose costs moved.
export function serializeReachCosts(costs: ReachCosts): string {
    const lines = Object.keys(costs)
        .sort()
        .map((id) => `${JSON.stringify(id)}:${JSON.stringify(costs[id])}`);
    return `{\n${lines.join(",\n")}\n}\n`;
}

export async function writeReachCosts(costs: ReachCosts, path = REACH_COSTS): Promise<void> {
    await writeFile(path, serializeReachCosts(costs));
}
