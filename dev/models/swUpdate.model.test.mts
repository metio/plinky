// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
    createSwUpdateWatcher,
    type SwContainer,
    type SwRegistration,
    type SwWorker,
} from "../../app/lib/swUpdate.ts";
import { replay, tracesIn } from "./itf.mts";

// The service worker's update, checked against the model in swUpdate.qnt. The rule is
// temporal — no reload while a run is in progress, and none lost when the run ends — so
// what matters is the order things happen in, and the model walks orders a scenario
// would not: a run starting between the accept and the control change, a second tab's
// update landing mid-run, a watcher disposed with a reload still owed.
//
// This file is the whole cost of the second model. Everything above it — decoding the
// traces, dispatching, reporting which step disagreed — is the same harness the keybed
// model uses.

type World = {
    watcher: ReturnType<typeof createSwUpdateWatcher>;
    fire(): void;
    reloads(): number;
    hold(on: boolean): void;
    offer(): void;
};

const worker = (): SwWorker => ({
    state: "installed",
    postMessage: () => {},
    addEventListener: () => {},
});

function world(): World {
    const listeners = new Set<() => void>();
    let held = false;
    let reloads = 0;
    const registration: SwRegistration = {
        waiting: null,
        installing: null,
        update: () => Promise.resolve(undefined),
        addEventListener: () => {},
    };
    const container: SwContainer = {
        // A worker already controls the page, which is what makes a waiting build an
        // update rather than a first install.
        controller: {},
        register: () => Promise.resolve(registration),
        addEventListener: (_type, listener) => {
            listeners.add(listener);
        },
        removeEventListener: (_type, listener) => {
            listeners.delete(listener);
        },
    };
    const watcher = createSwUpdateWatcher(container, {
        reload: () => {
            reloads += 1;
        },
        setTimeout: () => 0,
        clearTimeout: () => {},
        holdReload: () => held,
    });
    return {
        watcher,
        fire: () => {
            for (const listener of [...listeners]) {
                listener();
            }
        },
        reloads: () => reloads,
        hold: (on) => {
            held = on;
        },
        offer: () => {
            registration.waiting = worker();
        },
    };
}

const actions = {
    offer: (system: World) => {
        system.offer();
    },
    apply: (system: World) => {
        system.watcher.applyUpdate();
    },
    applyIfIdle: (system: World) => {
        system.watcher.applyIfIdle();
    },
    controlChanges: (system: World) => {
        system.fire();
    },
    runStarts: (system: World) => {
        system.hold(true);
    },
    runEnds: (system: World) => {
        system.hold(false);
        // What the composition root does when the last activity ends.
        system.watcher.flushReload();
    },
};

const agrees = (system: World, state: Record<string, unknown>) => {
    // The count is the whole claim: a reload one step early is a run thrown away, and a
    // reload that never came is a tab left on an evicted cache.
    expect(system.reloads()).toBe(state.reloads);
};

const TRACES = fileURLToPath(new URL("traces/swUpdate", import.meta.url));

describe("the update watcher, against every run the model explored", () => {
    const traces = tracesIn(TRACES);

    it("has runs to replay", () => {
        expect(traces.length).toBeGreaterThan(0);
    });

    for (const trace of traces) {
        it(`reloads exactly when the model does through ${trace.name}`, async () => {
            const system = world();
            // The registration resolves on a microtask; let it land before the first step.
            await new Promise((resolve) => setTimeout(resolve, 0));
            replay(trace, { start: () => system, actions, agrees });
        });
    }
});
