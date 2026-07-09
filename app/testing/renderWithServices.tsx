// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { memoryStore } from "../adapters/memoryStore";
import { type AppServices, createServices, ServicesProvider } from "../contexts/services";
import { createActivitySignal } from "../lib/activity";

// Render UI inside a ServicesProvider over a fresh in-memory world: no shared
// localStorage, no cross-test leakage, no clearing between tests. The returned
// `services` are the exact instances the component reads through the provider,
// so a test seeds and asserts against the same source of truth — the payoff of
// components receiving their capabilities injected.
export function renderWithServices(ui: ReactElement, overrides: Partial<AppServices> = {}) {
    // The store is resolved after the spread, so even an explicit `store:
    // undefined` in the overrides cannot fall back to the real browser adapter.
    const services = createServices({
        ...overrides,
        store: overrides.store ?? memoryStore(),
        // A fresh activity signal per test world — the app-wide default is a
        // shared singleton, and a leaked begin() from one test must not read as
        // "active" in the next.
        activity: overrides.activity ?? createActivitySignal(),
    });
    const view = render(<ServicesProvider services={services}>{ui}</ServicesProvider>);
    return {
        ...view,
        services,
        rerender: (next: ReactElement) =>
            view.rerender(<ServicesProvider services={services}>{next}</ServicesProvider>),
    };
}
