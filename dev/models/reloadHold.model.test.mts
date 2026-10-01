// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createReloadHold } from "../../core/reloadHold.ts";
import { replay, tracesIn } from "./itf.mts";

// The reload hold, checked against the model in reloadHold.qnt. The rule is temporal —
// no reload while a run is in progress, none lost when it ends — so what matters is the
// order things happen in, and the model walks orders a scenario would not: a run
// starting between the build taking control and the flush, two runs back to back with a
// reload owed across both, a flush arriving while the hold is still on.
//
// This file is the whole cost of the model. The decoding, dispatch and reporting are the
// harness the keybed model uses.

type World = { hold: ReturnType<typeof createReloadHold>; held: boolean; reloads: number };

const actions = {
    wants: (world: World) => {
        if (world.hold.want()) {
            world.reloads += 1;
        }
    },
    flushes: (world: World) => {
        if (world.hold.flush()) {
            world.reloads += 1;
        }
    },
    runStarts: (world: World) => {
        world.held = true;
    },
    runEnds: (world: World) => {
        world.held = false;
    },
};

const agrees = (world: World, state: Record<string, unknown>) => {
    // The count is the claim: a reload one step early is a run thrown away, and one that
    // never came is a tab left on an evicted cache.
    expect(world.reloads).toBe(state.reloads);
    expect(world.hold.owed()).toBe(state.owed);
};

const TRACES = fileURLToPath(new URL("traces/reloadHold", import.meta.url));

describe("the reload hold, against every run the model explored", () => {
    const traces = tracesIn(TRACES);

    it("has runs to replay", () => {
        expect(traces.length).toBeGreaterThan(0);
    });

    for (const trace of traces) {
        it(`reloads exactly when the model does through ${trace.name}`, () => {
            replay(trace, {
                start: () => {
                    const world: World = {
                        hold: createReloadHold(() => world.held),
                        held: false,
                        reloads: 0,
                    };
                    return world;
                },
                actions,
                agrees,
            });
        });
    }
});
