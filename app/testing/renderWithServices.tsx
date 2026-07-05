// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { memoryStore } from "../adapters/memoryStore";
import { type AppServices, createServices, ServicesProvider } from "../contexts/services";

// Render UI inside a ServicesProvider over a fresh in-memory world: no shared
// localStorage, no cross-test leakage, no clearing between tests. The returned
// `services` are the exact instances the component reads through the provider,
// so a test seeds and asserts against the same source of truth — the payoff of
// components receiving their capabilities injected.
export function renderWithServices(ui: ReactElement, overrides: Partial<AppServices> = {}) {
    const services = createServices({ store: overrides.store ?? memoryStore(), ...overrides });
    const view = render(<ServicesProvider services={services}>{ui}</ServicesProvider>);
    return {
        ...view,
        services,
        rerender: (next: ReactElement) =>
            view.rerender(<ServicesProvider services={services}>{next}</ServicesProvider>),
    };
}
