// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    createSwUpdateWatcher,
    type SwContainer,
    type SwRegistration,
    type SwWorker,
} from "./swUpdate";

// A new build taking over reloads the tab, and a reload lands wherever the player
// happens to be — so the rule that matters is a temporal one: no reload while something
// is in progress, and none lost when the hold clears. Both are properties of a whole
// sequence of events rather than of any single call, which is why they are stated here
// over generated sequences instead of in a scenario.
//
// The model below is the rule in its own terms: a page that has ever been controlled
// reloads when control changes, a page applying an update reloads when control changes,
// a held reload waits, and a flush releases exactly the one that waited.

type Event =
    | { kind: "register" }
    | { kind: "waiting" }
    | { kind: "controllerchange" }
    | { kind: "apply" }
    | { kind: "applyIfIdle" }
    | { kind: "hold"; on: boolean }
    | { kind: "flush" }
    | { kind: "timers" }
    | { kind: "settle" }
    | { kind: "dispose" };

const arbEvents = fc.array(
    fc.oneof(
        { weight: 2, arbitrary: fc.constant<Event>({ kind: "register" }) },
        { weight: 3, arbitrary: fc.constant<Event>({ kind: "waiting" }) },
        { weight: 4, arbitrary: fc.constant<Event>({ kind: "controllerchange" }) },
        { weight: 2, arbitrary: fc.constant<Event>({ kind: "apply" }) },
        { weight: 3, arbitrary: fc.constant<Event>({ kind: "applyIfIdle" }) },
        { weight: 4, arbitrary: fc.boolean().map((on) => ({ kind: "hold" as const, on })) },
        { weight: 3, arbitrary: fc.constant<Event>({ kind: "flush" }) },
        { weight: 1, arbitrary: fc.constant<Event>({ kind: "timers" }) },
        { weight: 1, arbitrary: fc.constant<Event>({ kind: "settle" }) },
        { weight: 1, arbitrary: fc.constant<Event>({ kind: "dispose" }) },
    ),
    { maxLength: 25 },
);

function fakeWorker(state = "installed"): SwWorker & { messages: unknown[]; install(): void } {
    const listeners = new Set<() => void>();
    const worker = {
        state,
        messages: [] as unknown[],
        postMessage(message: unknown) {
            worker.messages.push(message);
        },
        addEventListener(_type: "statechange", listener: () => void) {
            listeners.add(listener);
        },
        install() {
            worker.state = "installed";
            for (const listener of [...listeners]) {
                listener();
            }
        },
    };
    return worker;
}

function fakeRegistration() {
    const found = new Set<() => void>();
    let settle: (() => void) | null = null;
    const registration = {
        waiting: null as SwWorker | null,
        installing: null as SwWorker | null,
        update() {
            return new Promise<unknown>((resolve) => {
                settle = () => resolve(undefined);
            });
        },
        addEventListener(_type: "updatefound", listener: () => void) {
            found.add(listener);
        },
        fireUpdateFound() {
            for (const listener of [...found]) {
                listener();
            }
        },
        settleUpdate() {
            settle?.();
        },
    };
    return registration;
}

function fakeContainer(controller: object | null) {
    const listeners = new Set<() => void>();
    let settle: ((registration: SwRegistration) => void) | null = null;
    return {
        controller,
        register() {
            return new Promise<SwRegistration>((resolve) => {
                settle = resolve;
            });
        },
        addEventListener(_type: "controllerchange", listener: () => void) {
            listeners.add(listener);
        },
        removeEventListener(_type: "controllerchange", listener: () => void) {
            listeners.delete(listener);
        },
        resolveRegister(registration: SwRegistration) {
            settle?.(registration);
        },
        fireControllerChange() {
            for (const listener of [...listeners]) {
                listener();
            }
        },
    };
}

// The watcher's promises settle on microtasks; a real event loop turn drains them all.
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("watching for a new build, over any sequence of events", () => {
    it("never reloads while the player is mid-run, and loses no reload that waited", async () => {
        await fc.assert(
            fc.asyncProperty(arbEvents, fc.boolean(), async (events, startsControlled) => {
                const container = fakeContainer(startsControlled ? {} : null);
                const registration = fakeRegistration();
                const timers = new Map<number, () => void>();
                let nextTimer = 1;
                let hold = false;
                let reloads = 0;
                const watcher = createSwUpdateWatcher(container as SwContainer, {
                    reload: () => {
                        reloads += 1;
                    },
                    setTimeout: (run) => {
                        const id = nextTimer++;
                        timers.set(id, run);
                        return id;
                    },
                    clearTimeout: (id) => {
                        timers.delete(id);
                    },
                    holdReload: () => hold,
                });

                // The rule, in its own terms.
                let controlled = startsControlled;
                let applying = false;
                let parked = false;
                let disposed = false;
                let expected = 0;
                const wantReload = () => {
                    if (hold) {
                        parked = true;
                        return;
                    }
                    parked = false;
                    expected += 1;
                };

                let everReady = false;
                for (const event of events) {
                    const before = reloads;
                    switch (event.kind) {
                        case "register":
                            container.resolveRegister(registration as SwRegistration);
                            await tick();
                            break;
                        case "waiting": {
                            const worker = fakeWorker();
                            registration.waiting = worker;
                            registration.installing = worker;
                            registration.fireUpdateFound();
                            worker.install();
                            break;
                        }
                        case "controllerchange": {
                            container.fireControllerChange();
                            if (!disposed) {
                                const wasControlled = controlled;
                                controlled = true;
                                if (applying || wasControlled) {
                                    applying = false;
                                    wantReload();
                                }
                            }
                            break;
                        }
                        case "apply":
                            watcher.applyUpdate();
                            applying = true;
                            await tick();
                            break;
                        case "applyIfIdle": {
                            const idle = watcher.updateReady() && !hold;

                            expect(watcher.applyIfIdle()).toBe(idle);

                            applying = applying || idle;
                            await tick();
                            break;
                        }
                        case "hold":
                            hold = event.on;
                            break;
                        case "flush":
                            watcher.flushReload();
                            if (parked) {
                                wantReload();
                            }
                            break;
                        case "timers":
                            for (const [id, run] of [...timers]) {
                                timers.delete(id);
                                run();
                            }
                            break;
                        case "settle":
                            registration.settleUpdate();
                            await tick();
                            break;
                        case "dispose":
                            watcher.dispose();
                            disposed = true;
                            break;
                    }

                    expect(reloads).toBe(expected);
                    if (hold) {
                        // Whatever just happened, it did not reload the page out from
                        // under a run.
                        expect(reloads).toBe(before);
                    }
                    everReady = everReady || watcher.updateReady();
                    // An offer stands until it is taken: it never withdraws itself.
                    expect(watcher.updateReady()).toBe(everReady);
                    // Nothing here refuses the registration, so the "this page will
                    // never update" latch must stay off.
                    expect(watcher.registrationFailed()).toBe(false);
                }

                // Releasing the hold and flushing pays out exactly what waited.
                const owed = parked ? 1 : 0;
                hold = false;
                watcher.flushReload();
                expect(reloads).toBe(expected + owed);
                watcher.flushReload();
                expect(reloads).toBe(expected + owed);
            }),
        );
    });

    it("stays silent for a first install, whatever happens after it", async () => {
        await fc.assert(
            fc.asyncProperty(arbEvents, async (events) => {
                // No controller means this page has never been controlled: the install
                // that claims it is not an update, and there is nothing to offer.
                const container = fakeContainer(null);
                const registration = fakeRegistration();
                let reloads = 0;
                const watcher = createSwUpdateWatcher(container as SwContainer, {
                    reload: () => {
                        reloads += 1;
                    },
                    setTimeout: () => 0,
                    clearTimeout: () => {},
                });
                container.resolveRegister(registration as SwRegistration);
                await tick();

                for (const event of events) {
                    if (event.kind === "waiting") {
                        const worker = fakeWorker();
                        registration.waiting = worker;
                        registration.installing = worker;
                        registration.fireUpdateFound();
                        worker.install();
                    }
                    // The claim that makes this page controlled, and nothing else.
                    if (event.kind === "controllerchange") {
                        container.fireControllerChange();
                        break;
                    }
                }

                expect(watcher.updateReady()).toBe(false);
                expect(reloads).toBe(0);
            }),
        );
    });

    it("hands the waiting build a take-over, however the check turns out", async () => {
        await fc.assert(
            fc.asyncProperty(fc.constantFrom("settle", "timeout", "both"), async (how) => {
                const container = fakeContainer({});
                const registration = fakeRegistration();
                const timers = new Map<number, () => void>();
                let nextTimer = 1;
                const watcher = createSwUpdateWatcher(container as SwContainer, {
                    reload: () => {},
                    setTimeout: (run) => {
                        const id = nextTimer++;
                        timers.set(id, run);
                        return id;
                    },
                    clearTimeout: (id) => {
                        timers.delete(id);
                    },
                });
                container.resolveRegister(registration as SwRegistration);
                await tick();
                const worker = fakeWorker();
                registration.waiting = worker;
                registration.installing = worker;
                registration.fireUpdateFound();
                worker.install();
                expect(watcher.updateReady()).toBe(true);

                watcher.applyUpdate();
                if (how !== "timeout") {
                    registration.installing = null;
                    registration.settleUpdate();
                    await tick();
                }
                if (how !== "settle") {
                    for (const [id, run] of [...timers]) {
                        timers.delete(id);
                        run();
                    }
                }
                await tick();

                // Exactly one take-over: a slow check must not tell the same build
                // twice, and a check that never answers must not strand the click.
                expect(worker.messages).toEqual([{ type: "SKIP_WAITING" }]);
            }),
        );
    });
});
