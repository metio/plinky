// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { browserStore } from "../adapters/browserStore";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createPrefsStore, type PrefsStore } from "../stores/prefsStore";

// The app's injected integration points, gathered in one place. Every external
// capability the UI depends on — persistence and preferences today; audio, MIDI, the
// score renderer and the network as their ports land — is handed to the tree through
// this context, so a component that uses one never reaches for a global or a
// singleton. It receives its capability and stays oblivious to which implementation
// it got: the real browser adapter in production, a fake in a test. That is what lets
// a feature be rendered in a test with no jsdom globals to stub and no module to
// mock — just wrap it in a provider carrying fakes.
export type AppServices = {
    // Where persistent state is read and written (see KeyValueStore).
    store: KeyValueStore;
    // The single source of truth for preferences, built over `store`.
    prefs: PrefsStore;
};

// Assembles a full service set from a partial override. Derived services follow the
// pieces they are built on: overriding just `store` gives a prefs store over that
// store, so a test that hands in a memoryStore gets consistent persistence throughout.
function build(overrides: Partial<AppServices> = {}): AppServices {
    const store = overrides.store ?? browserStore;
    return {
        store,
        prefs: overrides.prefs ?? createPrefsStore(store),
    };
}

// The production wiring. A component read outside any provider still gets working
// services, so nothing has to know whether it is inside the app shell or a test.
const DEFAULT_SERVICES: AppServices = build();

const ServicesContext = createContext<AppServices>(DEFAULT_SERVICES);

// Wraps a subtree with a set of services, overriding only the ones given. The app
// root supplies the real adapters; a test supplies fakes (e.g. `{ store: memoryStore() }`).
export function ServicesProvider({
    services,
    children,
}: {
    services?: Partial<AppServices>;
    children: ReactNode;
}) {
    const value = useMemo(() => (services ? build(services) : DEFAULT_SERVICES), [services]);
    return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

// Read the whole service set, or one capability. Prefer the narrow hooks at call
// sites so a component declares exactly what it depends on.
export function useServices(): AppServices {
    return useContext(ServicesContext);
}

export function useStore(): KeyValueStore {
    return useServices().store;
}

export function usePrefsStore(): PrefsStore {
    return useServices().prefs;
}
