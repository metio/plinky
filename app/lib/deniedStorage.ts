// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Simulates a browser that blocks site storage: merely *accessing* the `localStorage`
// global throws a SecurityError — the way Firefox does with cookies/site-data disabled,
// or a sandboxed iframe does. A `typeof localStorage` check does not suppress this (it
// still evaluates the throwing getter), so only a try/catch around the access survives
// it. This drives the guard every storage helper must hold: read/write under denied
// storage returns the empty fallback instead of crashing the page that called it.
export function withDeniedStorage<T>(run: () => T): T {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        get() {
            throw new DOMException("The operation is insecure.", "SecurityError");
        },
    });
    try {
        return run();
    } finally {
        if (original) {
            Object.defineProperty(globalThis, "localStorage", original);
        } else {
            delete (globalThis as { localStorage?: Storage }).localStorage;
        }
    }
}
