// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    createSwUpdateWatcher,
    type SwContainer,
    type SwRegistration,
    type SwWorker,
} from "./swUpdate";

// A hand-driven fake of the Service Worker API slices the watcher consumes:
// workers whose state we set, a registration whose update() we resolve, a
// container whose controllerchange we fire — all synchronously from the test.

type FakeWorker = SwWorker & {
    messages: unknown[];
    setState(state: string): void;
};

function fakeWorker(state = "installed"): FakeWorker {
    const listeners = new Set<() => void>();
    const worker: FakeWorker = {
        state,
        messages: [],
        postMessage(message) {
            worker.messages.push(message);
        },
        addEventListener(_type, listener) {
            listeners.add(listener);
        },
        setState(next) {
            worker.state = next;
            for (const listener of [...listeners]) {
                listener();
            }
        },
    };
    return worker;
}

type FakeRegistration = SwRegistration & {
    fireUpdateFound(): void;
    resolveUpdate(): void;
    rejectUpdate(): void;
    updateCalls: number;
};

function fakeRegistration(): FakeRegistration {
    const updateFoundListeners = new Set<() => void>();
    let settle: { resolve(): void; reject(): void } | null = null;
    const registration: FakeRegistration = {
        waiting: null,
        installing: null,
        updateCalls: 0,
        update() {
            registration.updateCalls += 1;
            return new Promise<unknown>((resolve, reject) => {
                settle = {
                    resolve: () => resolve(undefined),
                    reject: () => reject(new Error("offline")),
                };
            });
        },
        addEventListener(_type, listener) {
            updateFoundListeners.add(listener);
        },
        fireUpdateFound() {
            for (const listener of [...updateFoundListeners]) {
                listener();
            }
        },
        resolveUpdate() {
            settle?.resolve();
        },
        rejectUpdate() {
            settle?.reject();
        },
    };
    return registration;
}

type FakeContainer = SwContainer & {
    resolveRegister(registration: SwRegistration): void;
    rejectRegister(): void;
    fireControllerChange(): void;
    controllerChangeListeners(): number;
};

function fakeContainer(controller: object | null = null): FakeContainer {
    const listeners = new Set<() => void>();
    let settle: { resolve(reg: SwRegistration): void; reject(): void } | null = null;
    return {
        controller,
        register() {
            return new Promise<SwRegistration>((resolve, reject) => {
                settle = { resolve, reject: () => reject(new Error("registration failed")) };
            });
        },
        addEventListener(_type, listener) {
            listeners.add(listener);
        },
        removeEventListener(_type, listener) {
            listeners.delete(listener);
        },
        resolveRegister(registration) {
            settle?.resolve(registration);
        },
        rejectRegister() {
            settle?.reject();
        },
        fireControllerChange() {
            for (const listener of [...listeners]) {
                listener();
            }
        },
        controllerChangeListeners: () => listeners.size,
    };
}

// A controllable clock standing in for window.setTimeout/clearTimeout.
function fakeTimers() {
    let nextId = 1;
    const pending = new Map<number, () => void>();
    return {
        env: {
            setTimeout(run: () => void, _ms: number) {
                const id = nextId++;
                pending.set(id, run);
                return id;
            },
            clearTimeout(id: number) {
                pending.delete(id);
            },
        },
        fire() {
            for (const [id, run] of [...pending]) {
                pending.delete(id);
                run();
            }
        },
        pendingCount: () => pending.size,
    };
}

// Promise resolutions inside the watcher settle on microtasks; one tick per
// .then() hop.
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup({ controller = {} as object | null } = {}) {
    const container = fakeContainer(controller);
    const timers = fakeTimers();
    const reloads = { count: 0 };
    const watcher = createSwUpdateWatcher(container, {
        reload: () => {
            reloads.count += 1;
        },
        ...timers.env,
    });
    const readyFlips: boolean[] = [];
    watcher.subscribe(() => readyFlips.push(watcher.updateReady()));
    return { container, timers, reloads, watcher, readyFlips };
}

const SKIP = { type: "SKIP_WAITING" };

describe("createSwUpdateWatcher", () => {
    it("offers a build already parked in waiting when a controller exists", async () => {
        const { container, watcher, readyFlips } = setup();
        const registration = fakeRegistration();
        registration.waiting = fakeWorker();
        container.resolveRegister(registration);
        await tick();
        expect(watcher.updateReady()).toBe(true);
        expect(readyFlips).toEqual([true]);
    });

    it("stays silent on the first-ever install (no controller)", async () => {
        const { container, watcher, reloads } = setup({ controller: null });
        const registration = fakeRegistration();
        registration.waiting = fakeWorker();
        container.resolveRegister(registration);
        await tick();
        expect(watcher.updateReady()).toBe(false);
        // The first install's claim-driven controllerchange must not reload.
        container.fireControllerChange();
        expect(reloads.count).toBe(0);
    });

    it("offers a build that installs after registration", async () => {
        const { container, watcher } = setup();
        const registration = fakeRegistration();
        container.resolveRegister(registration);
        await tick();
        expect(watcher.updateReady()).toBe(false);

        const installing = fakeWorker("installing");
        registration.installing = installing;
        registration.fireUpdateFound();
        expect(watcher.updateReady()).toBe(false);
        registration.waiting = installing;
        installing.setState("installed");
        expect(watcher.updateReady()).toBe(true);
    });

    it("notifies subscribers once even when a second build parks later", async () => {
        const { container, watcher, readyFlips } = setup();
        const registration = fakeRegistration();
        const first = fakeWorker();
        registration.waiting = first;
        container.resolveRegister(registration);
        await tick();

        const second = fakeWorker("installing");
        registration.installing = second;
        registration.fireUpdateFound();
        registration.waiting = second;
        second.setState("installed");
        // An installed worker moves from the installing slot to waiting.
        registration.installing = null;
        expect(readyFlips).toEqual([true]);
        // The fresher parked build is the one an apply targets.
        watcher.applyUpdate();
        registration.resolveUpdate();
        await tick();
        expect(second.messages).toEqual([SKIP]);
        expect(first.messages).toEqual([]);
    });

    it("reloads when another tab's update seizes control", () => {
        const { container, reloads } = setup();
        container.fireControllerChange();
        expect(reloads.count).toBe(1);
    });

    it("latches a failed registration instead of swallowing it", async () => {
        const { container, watcher } = setup();
        let notified = 0;
        watcher.subscribe(() => {
            notified += 1;
        });
        expect(watcher.registrationFailed()).toBe(false);
        container.rejectRegister();
        await tick();
        expect(watcher.updateReady()).toBe(false);
        expect(watcher.registrationFailed()).toBe(true);
        expect(notified).toBe(1);
    });

    it("does not flag a registration that fails after dispose", async () => {
        const { container, watcher } = setup();
        watcher.dispose();
        container.rejectRegister();
        await tick();
        expect(watcher.registrationFailed()).toBe(false);
    });

    it("reports no failure while registration is pending or succeeded", async () => {
        const { container, watcher } = setup();
        expect(watcher.registrationFailed()).toBe(false);
        container.resolveRegister(fakeRegistration());
        await tick();
        expect(watcher.registrationFailed()).toBe(false);
    });

    it("ignores a registration that resolves after dispose", async () => {
        const { container, watcher } = setup();
        watcher.dispose();
        const registration = fakeRegistration();
        registration.waiting = fakeWorker();
        container.resolveRegister(registration);
        await tick();
        expect(watcher.updateReady()).toBe(false);
    });

    it("dispose unhooks the controllerchange reload", () => {
        const { container, watcher, reloads } = setup();
        expect(container.controllerChangeListeners()).toBe(1);
        watcher.dispose();
        expect(container.controllerChangeListeners()).toBe(0);
        container.fireControllerChange();
        expect(reloads.count).toBe(0);
    });

    it("unsubscribe stops notifications", async () => {
        const { container, watcher } = setup();
        let calls = 0;
        const unsubscribe = watcher.subscribe(() => {
            calls += 1;
        });
        unsubscribe();
        const registration = fakeRegistration();
        registration.waiting = fakeWorker();
        container.resolveRegister(registration);
        await tick();
        expect(watcher.updateReady()).toBe(true);
        expect(calls).toBe(0);
    });

    describe("applyUpdate", () => {
        it("is a harmless no-op while registration is still pending", () => {
            const { container, watcher, reloads, timers } = setup();
            // register() has not resolved: no registration, nothing parked. The
            // apply posts to no one and starts no update check.
            watcher.applyUpdate();
            expect(timers.pendingCount()).toBe(0);
            // applying was set, so a controllerchange still reloads this tab.
            container.fireControllerChange();
            expect(reloads.count).toBe(1);
        });

        it("activates the waiting build when the final check finds nothing newer", async () => {
            const { container, watcher, timers } = setup();
            const registration = fakeRegistration();
            const parked = fakeWorker();
            registration.waiting = parked;
            container.resolveRegister(registration);
            await tick();

            watcher.applyUpdate();
            registration.resolveUpdate();
            await tick();
            expect(parked.messages).toEqual([SKIP]);
            // The pending-timeout was cancelled; firing what's left double-posts nothing.
            expect(timers.pendingCount()).toBe(0);
        });

        it("waits for a fresher build found by the final check and activates that", async () => {
            const { container, watcher } = setup();
            const registration = fakeRegistration();
            const parked = fakeWorker();
            registration.waiting = parked;
            container.resolveRegister(registration);
            await tick();

            watcher.applyUpdate();
            const fresher = fakeWorker("installing");
            registration.installing = fresher;
            registration.resolveUpdate();
            await tick();
            expect(parked.messages).toEqual([]);
            registration.waiting = fresher;
            fresher.setState("installed");
            expect(fresher.messages).toEqual([SKIP]);
            expect(parked.messages).toEqual([]);
        });

        it("falls back to the parked build when the fresher install fails", async () => {
            const { container, watcher } = setup();
            const registration = fakeRegistration();
            const parked = fakeWorker();
            registration.waiting = parked;
            container.resolveRegister(registration);
            await tick();

            watcher.applyUpdate();
            const fresher = fakeWorker("installing");
            registration.installing = fresher;
            registration.resolveUpdate();
            await tick();
            fresher.setState("redundant");
            expect(parked.messages).toEqual([SKIP]);
            expect(fresher.messages).toEqual([]);
        });

        it("falls back to the parked build when the check fails (offline)", async () => {
            const { container, watcher } = setup();
            const registration = fakeRegistration();
            const parked = fakeWorker();
            registration.waiting = parked;
            container.resolveRegister(registration);
            await tick();

            watcher.applyUpdate();
            registration.rejectUpdate();
            await tick();
            expect(parked.messages).toEqual([SKIP]);
        });

        it("takes the parked build when the check outlasts the timeout, and a late result does not double-activate", async () => {
            const { container, watcher, timers } = setup();
            const registration = fakeRegistration();
            const parked = fakeWorker();
            registration.waiting = parked;
            container.resolveRegister(registration);
            await tick();

            watcher.applyUpdate();
            timers.fire();
            expect(parked.messages).toEqual([SKIP]);
            registration.resolveUpdate();
            await tick();
            expect(parked.messages).toEqual([SKIP]);
        });

        it("reloads this tab on the controllerchange the apply triggers, even with no prior controller", () => {
            const { container, reloads, watcher } = setup({ controller: null });
            watcher.applyUpdate();
            container.fireControllerChange();
            expect(reloads.count).toBe(1);
            // The flag resets: a later, unrelated claim leaves the page alone.
            container.fireControllerChange();
            expect(reloads.count).toBe(1);
        });
    });
});
