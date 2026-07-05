// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { browserStore } from "../adapters/browserStore";
import { webAudioEngine } from "../adapters/webAudioEngine";
import type { AudioEngine } from "../ports/audioEngine";
import type { XmlCodec } from "../../core/xml";
import { domXmlCodec } from "../adapters/domXmlCodec";
import type { KeyValueStore } from "../ports/keyValueStore";
import type { Fetcher } from "../ports/fetcher";
import { httpFetcher } from "../adapters/httpFetcher";
import { createDailyStore, type DailyStore } from "../stores/dailyStore";
import { createExerciseSource, type ExerciseSource } from "../stores/exerciseSource";
import { createHintsStore, type HintsStore } from "../stores/hintsStore";
import { createMilestonesStore, type MilestonesStore } from "../stores/milestonesStore";
import { createOnboardingStore, type OnboardingStore } from "../stores/onboardingStore";
import { createThemeStore, type ThemeStore } from "../stores/themeStore";
import { createFavoritesStore, type FavoritesStore } from "../stores/favoritesStore";
import { createFingeringStore, type FingeringStore } from "../stores/fingeringStore";
import { createGhostStore, type GhostStore } from "../stores/ghostStore";
import { createLifetimeStore, type LifetimeStore } from "../stores/lifetimeStore";
import { createTakesStore, type TakesStore } from "../stores/takesStore";
import { createHistoryStore, type HistoryStore } from "../stores/historyStore";
import { createSongSource, type SongSource } from "../stores/songSource";
import { createMasteryStore, type MasteryStore } from "../stores/masteryStore";
import { createPrefsStore, type PrefsStore } from "../stores/prefsStore";

// The app's injected integration points, gathered in one place. Every external
// capability the UI depends on — persistence, the state stores over it, audio, XML
// parsing and the fetched catalogue halves — is handed to the tree through
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
    favorites: FavoritesStore;
    theme: ThemeStore;
    hints: HintsStore;
    onboarding: OnboardingStore;
    daily: DailyStore;
    milestones: MilestonesStore;
    lifetime: LifetimeStore;
    ghosts: GhostStore;
    takes: TakesStore;
    fingering: FingeringStore;
    // How the network is reached (see Fetcher). The catalogue sources derive
    // from it, so overriding just this redirects every fetch.
    fetcher: Fetcher;
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
    // The song source seeds first-run favorites, so it takes the same favorites
    // store the UI subscribes to — seeding lands where the library reads.
    const favorites = overrides.favorites ?? createFavoritesStore(store);
    const fetcher = overrides.fetcher ?? httpFetcher;
    return {
        store,
        prefs: overrides.prefs ?? createPrefsStore(store),
        mastery: overrides.mastery ?? createMasteryStore(store),
        history: overrides.history ?? createHistoryStore(store),
        favorites,
        theme: overrides.theme ?? createThemeStore(store),
        hints: overrides.hints ?? createHintsStore(store),
        onboarding: overrides.onboarding ?? createOnboardingStore(store),
        daily: overrides.daily ?? createDailyStore(store),
        milestones: overrides.milestones ?? createMilestonesStore(store),
        lifetime: overrides.lifetime ?? createLifetimeStore(store),
        ghosts: overrides.ghosts ?? createGhostStore(store),
        takes: overrides.takes ?? createTakesStore(store),
        fingering: overrides.fingering ?? createFingeringStore(store),
        fetcher,
        audio: overrides.audio ?? webAudioEngine,
        xml: overrides.xml ?? domXmlCodec,
        songs: overrides.songs ?? createSongSource(fetcher, store, favorites),
        exercises: overrides.exercises ?? createExerciseSource(fetcher),
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
    const favorites = services?.favorites;
    const theme = services?.theme;
    const hints = services?.hints;
    const onboarding = services?.onboarding;
    const daily = services?.daily;
    const milestones = services?.milestones;
    const lifetime = services?.lifetime;
    const ghosts = services?.ghosts;
    const takes = services?.takes;
    const fingering = services?.fingering;
    const fetcher = services?.fetcher;
    const audio = services?.audio;
    const xml = services?.xml;
    const songs = services?.songs;
    const exercises = services?.exercises;
    const value = useMemo(
        () =>
            store ||
            prefs ||
            mastery ||
            history ||
            favorites ||
            theme ||
            hints ||
            onboarding ||
            daily ||
            milestones ||
            lifetime ||
            ghosts ||
            takes ||
            fingering ||
            fetcher ||
            audio ||
            xml ||
            songs ||
            exercises
                ? build({
                      store,
                      prefs,
                      mastery,
                      history,
                      favorites,
                      theme,
                      hints,
                      onboarding,
                      daily,
                      milestones,
                      lifetime,
                      ghosts,
                      takes,
                      fingering,
                      fetcher,
                      audio,
                      xml,
                      songs,
                      exercises,
                  })
                : DEFAULT_SERVICES,
        [
            store,
            prefs,
            mastery,
            history,
            favorites,
            theme,
            hints,
            onboarding,
            daily,
            milestones,
            lifetime,
            ghosts,
            takes,
            fingering,
            fetcher,
            audio,
            xml,
            songs,
            exercises,
        ],
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

export function useFavoritesStore(): FavoritesStore {
    return useServices().favorites;
}

export function useThemeStore(): ThemeStore {
    return useServices().theme;
}

export function useHintsStore(): HintsStore {
    return useServices().hints;
}

export function useOnboardingStore(): OnboardingStore {
    return useServices().onboarding;
}

export function useDailyStore(): DailyStore {
    return useServices().daily;
}

export function useFingeringStore(): FingeringStore {
    return useServices().fingering;
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
