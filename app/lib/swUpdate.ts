// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Watches the offline service worker for a newer build and, when one is ready,
// surfaces it as a prompt instead of letting it seize the tab. Everything
// side-effecting arrives injected — the container, the reload, the timers — so
// the whole update state machine is unit-testable with plain fakes and the
// composition root stays the only place that names a browser global.

// The narrow structural slices of the Service Worker API the watcher touches.
// The real ServiceWorkerContainer/Registration/Worker satisfy them, and a test
// fake needs only these members.
export type SwWorker = {
    state: string;
    postMessage(message: unknown): void;
    addEventListener(type: "statechange", listener: () => void): void;
};

export type SwRegistration = {
    waiting: SwWorker | null;
    installing: SwWorker | null;
    update(): Promise<unknown>;
    addEventListener(type: "updatefound", listener: () => void): void;
};

export type SwContainer = {
    controller: object | null;
    register(scriptUrl: string): Promise<SwRegistration>;
    addEventListener(type: "controllerchange", listener: () => void): void;
    removeEventListener(type: "controllerchange", listener: () => void): void;
};

export type SwEnv = {
    reload(): void;
    setTimeout(run: () => void, ms: number): number;
    clearTimeout(id: number): void;
    // When present and true at reload time, the reload is parked instead of
    // fired — a new build seizing control must not wipe out a practice run in
    // progress. The caller flushes once the hold clears (see flushReload).
    holdReload?(): boolean;
};

export type SwUpdateWatcher = {
    // useSyncExternalStore-shaped: notify on change, read the current snapshots.
    subscribe(onChange: () => void): () => void;
    updateReady(): boolean;
    // Latched on: the service worker could not be registered, so this page will
    // never receive updates. Surfaced rather than swallowed — an installed app
    // that silently stops updating is undebuggable from the outside.
    registrationFailed(): boolean;
    applyUpdate(): void;
    // Fires a reload that was parked behind env.holdReload, if the hold has
    // cleared; otherwise a no-op. Safe to call on every hold change.
    flushReload(): void;
    dispose(): void;
};

// A slow network must not leave the apply click hanging: past this, take the
// parked build rather than keep the player waiting on a fetch.
const UPDATE_CHECK_TIMEOUT_MS = 4000;

export function createSwUpdateWatcher(container: SwContainer, env: SwEnv): SwUpdateWatcher {
    let updateReady = false;
    // The build parked in "waiting", to be told to take over once the user accepts.
    let waiting: SwWorker | null = null;
    // The registration, kept so accepting the update can run one last update check.
    let registration: SwRegistration | null = null;
    // Set the moment we ask the waiting worker to activate, so the controllerchange
    // it triggers reloads this tab — while the first-ever install's controllerchange
    // (which we did not initiate) leaves the page alone.
    let applying = false;
    let disposed = false;
    let registrationFailed = false;
    const listeners = new Set<() => void>();

    const notify = () => {
        for (const listener of [...listeners]) {
            listener();
        }
    };

    // Whether a worker already controlled this page when the watcher started. A later
    // controllerchange then means a NEW build seized control (an update) — so every
    // open tab must reload onto it, not only the one that clicked apply, or the others
    // keep running the old HTML and 404 on their next lazy chunk. The first-ever install
    // has no prior controller, and its claim-driven controllerchange must leave the page.
    const hadController = !!container.controller;

    // A worker in "waiting" is a new build ready to take over. It only counts as
    // an update when a previous worker already controls this page — the first
    // install has no predecessor and must stay silent.
    const offer = (worker: SwWorker | null) => {
        if (disposed || !worker || !container.controller) {
            return;
        }
        // Always track the newest parked worker — the waiting slot only ever
        // holds one, so a fresher build replaces the reference. Notify only on
        // the flip to ready.
        waiting = worker;
        if (updateReady) {
            return;
        }
        updateReady = true;
        notify();
    };

    container
        .register("/sw.js")
        .then((reg) => {
            if (disposed) {
                return;
            }
            registration = reg;
            offer(reg.waiting);
            reg.addEventListener("updatefound", () => {
                const installing = reg.installing;
                installing?.addEventListener("statechange", () => {
                    if (installing.state === "installed") {
                        offer(reg.waiting);
                    }
                });
            });
        })
        .catch(() => {
            if (disposed) {
                return;
            }
            registrationFailed = true;
            notify();
        });

    // A reload wanted now but parked because env.holdReload said the player is
    // mid-run; flushReload releases it once the hold clears.
    let reloadPending = false;
    const requestReload = () => {
        if (env.holdReload?.()) {
            reloadPending = true;
            return;
        }
        reloadPending = false;
        env.reload();
    };

    // A new worker taking control evicts the previous build's cache, so reload onto it
    // — whether this tab initiated the update or another tab did (applying stays false
    // here but a controller already existed). Skip only the first install's claim.
    const onControllerChange = () => {
        if (applying || hadController) {
            applying = false;
            requestReload();
        }
    };
    container.addEventListener("controllerchange", onControllerChange);

    const applyUpdate = () => {
        applying = true;
        // One last update check before switching, so back-to-back deploys can't strand
        // the click on an intermediate build: if a newer sw.js has been published since
        // this one parked, wait for it to install and activate THAT — the waiting slot
        // only ever holds one worker, so the freshest wins. The parked build remains the
        // fallback when the check fails (offline), finds nothing, or takes too long —
        // activating it triggers a reload, and the reload's own update check self-heals
        // onto anything newer.
        const applyParked = () => waiting?.postMessage({ type: "SKIP_WAITING" });
        const reg = registration;
        if (!reg) {
            applyParked();
            return;
        }
        let done = false;
        const finish = (worker: SwWorker | null) => {
            if (done) {
                return;
            }
            done = true;
            env.clearTimeout(timer);
            (worker ?? waiting)?.postMessage({ type: "SKIP_WAITING" });
        };
        const timer = env.setTimeout(() => finish(null), UPDATE_CHECK_TIMEOUT_MS);
        reg.update()
            .then(() => {
                const installing = reg.installing;
                if (!installing) {
                    // Nothing newer found (or it already reached waiting).
                    finish(reg.waiting);
                    return;
                }
                installing.addEventListener("statechange", () => {
                    if (installing.state === "installed") {
                        finish(reg.waiting);
                    } else if (installing.state === "redundant") {
                        // The newer build failed to install; the parked one still works.
                        finish(null);
                    }
                });
            })
            .catch(() => finish(null));
    };

    return {
        subscribe(onChange) {
            listeners.add(onChange);
            return () => {
                listeners.delete(onChange);
            };
        },
        updateReady: () => updateReady,
        registrationFailed: () => registrationFailed,
        applyUpdate,
        flushReload() {
            if (reloadPending) {
                requestReload();
            }
        },
        dispose() {
            disposed = true;
            container.removeEventListener("controllerchange", onControllerChange);
        },
    };
}
