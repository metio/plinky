// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { browserStore } from "../adapters/browserStore";
import { webAudioEngine } from "../adapters/webAudioEngine";
import type { AudioEngine } from "../ports/audioEngine";
import type { XmlCodec } from "../../core/xml";
import { domXmlCodec } from "../adapters/domXmlCodec";
import type { KeyValueStore } from "../ports/keyValueStore";
import { httpFetcher } from "../adapters/httpFetcher";
import { createExerciseSource, type ExerciseSource } from "../stores/exerciseSource";
import { createHistoryStore, type HistoryStore } from "../stores/historyStore";
import { createSongSource, type SongSource } from "../stores/songSource";
import { createMasteryStore, type MasteryStore } from "../stores/masteryStore";
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
    // The single sources of truth for each family of persistent state, built over
    // `store`.
    prefs: PrefsStore;
    mastery: MasteryStore;
    history: HistoryStore;
    // Where sound comes out (see AudioEngine).
    audio: AudioEngine;
    // How MusicXML strings become walkable documents and back (see XmlCodec).
    xml: XmlCodec;
    // The fetched halves of the catalogue: the song manifest + on-demand .mxl,
    // and the exercise manifest + generated/fetched pieces.
    songs: SongSource;
    exercises: ExerciseSource;
};

// Assembles a full service set from a partial override. Derived services follow the
// pieces they are built on: overriding just `store` gives every state store over
// that store, so a test that hands in a memoryStore gets consistent persistence
// throughout.
function build(overrides: Partial<AppServices> = {}): AppServices {
    const store = overrides.store ?? browserStore;
    return {
        store,
        prefs: overrides.prefs ?? createPrefsStore(store),
        mastery: overrides.mastery ?? createMasteryStore(store),
        history: overrides.history ?? createHistoryStore(store),
        audio: overrides.audio ?? webAudioEngine,
        xml: overrides.xml ?? domXmlCodec,
        songs: overrides.songs ?? createSongSource(httpFetcher, store),
        exercises: overrides.exercises ?? createExerciseSource(httpFetcher),
    };
}

// The production wiring. A component read outside any provider still gets working
// services, so nothing has to know whether it is inside the app shell or a test.
const DEFAULT_SERVICES: AppServices = build();

const ServicesContext = createContext<AppServices>(DEFAULT_SERVICES);

// Wraps a subtree with a set of services, overriding only the ones given. The app
// root supplies the real adapters; a test supplies fakes — hoist the fake to a
// variable (`const store = memoryStore()`) rather than constructing it inline in the
// prop, so its state survives the parent's re-renders.
export function ServicesProvider({
    services,
    children,
}: {
    services?: Partial<AppServices>;
    children: ReactNode;
}) {
    // Keyed on the individual overrides, not the prop object's identity: an inline
    // `services={{ store }}` literal is a fresh object every render, and rebuilding
    // the set each time would mint new stores whose subscribers miss saves made
    // through the previous instances.
    const store = services?.store;
    const prefs = services?.prefs;
    const mastery = services?.mastery;
    const history = services?.history;
    const audio = services?.audio;
    const xml = services?.xml;
    const songs = services?.songs;
    const exercises = services?.exercises;
    const value = useMemo(
        () =>
            store || prefs || mastery || history || audio || xml || songs || exercises
                ? build({ store, prefs, mastery, history, audio, xml, songs, exercises })
                : DEFAULT_SERVICES,
        [store, prefs, mastery, history, audio, xml, songs, exercises],
    );
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

export function useMasteryStore(): MasteryStore {
    return useServices().mastery;
}

export function useHistoryStore(): HistoryStore {
    return useServices().history;
}

export function useAudioEngine(): AudioEngine {
    return useServices().audio;
}

export function useXmlCodec(): XmlCodec {
    return useServices().xml;
}

export function useSongSource(): SongSource {
    return useServices().songs;
}

export function useExerciseSource(): ExerciseSource {
    return useServices().exercises;
}
