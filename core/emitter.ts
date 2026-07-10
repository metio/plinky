// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The one listener-set idiom every notifying seam shares: subscribe returns its
// own teardown, notify walks a snapshot of the set (a listener that subscribes
// or unsubscribes mid-delivery affects the next notify, not the current one),
// and each listener is isolated — one broken subscriber must never silence the
// rest.

export type Emitter = {
    subscribe(listener: () => void): () => void;
    // Deliver to every current listener, isolated per listener.
    notify(): void;
    // The isolation wrapper by itself, for a delivery path outside notify()
    // (e.g. a browser event handler) that must honor the same guarantee.
    safely(listener: () => void): void;
};

export function createEmitter(): Emitter {
    const listeners = new Set<() => void>();
    const safely = (listener: () => void) => {
        try {
            listener();
        } catch {
            // The subscriber's failure is its own; delivery continues.
        }
    };
    return {
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        notify() {
            for (const listener of [...listeners]) {
                safely(listener);
            }
        },
        safely,
    };
}
