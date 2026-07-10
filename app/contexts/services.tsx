// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { browserStore } from "../adapters/browserStore";
import { webAudioEngine } from "../adapters/webAudioEngine";
import { lazyVideoExporter } from "../adapters/lazyVideo";
import { webMidi } from "../adapters/webMidi";
import type { MidiAccessPort } from "../ports/midiAccess";
import type { AudioEngine } from "../ports/audioEngine";
import type { XmlCodec } from "../../core/xml";
import { domXmlCodec } from "../adapters/domXmlCodec";
import type { KeyValueStore } from "../ports/keyValueStore";
import type { Fetcher } from "../ports/fetcher";
import { httpFetcher } from "../adapters/httpFetcher";
import type { NewsSource } from "../ports/news";
import { createSanityNews } from "../adapters/sanityNews";
import type { HelpSource } from "../ports/help";
import type { VideoExporter } from "../ports/videoExporter";
import { createSanityHelp } from "../adapters/sanityHelp";
import { createAssignmentsStore, type AssignmentsStore } from "../stores/assignmentsStore";
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
import { type ActivitySignal, runActivity } from "../lib/activity";

// The app's injected integration points, gathered in one place. Every external
// capability the UI depends on — persistence, the state stores over it, audio,
// MIDI, XML parsing, the network and the fetched catalogue halves — is handed to the tree through
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
    assignments: AssignmentsStore;
    // How the network is reached (see Fetcher). The catalogue sources derive
    // from it, so overriding just this redirects every fetch.
    fetcher: Fetcher;
    // Where sound comes out (see AudioEngine).
    audio: AudioEngine;
    // Where MIDI comes from (see MidiAccessPort).
    midi: MidiAccessPort;
    // How MusicXML strings become walkable documents and back (see XmlCodec).
    xml: XmlCodec;
    // The fetched halves of the catalogue: the song manifest + on-demand .mxl,
    // and the exercise manifest + generated/fetched pieces.
    songs: SongSource;
    exercises: ExerciseSource;
    // The live home-page news item, fetched from an external content service
    // (Sanity) so a non-technical editor can change the picture + link without a
    // redeploy. No configured project or a failed fetch simply yields no news.
    news: NewsSource;
    // The help page's content, fetched from the same Sanity project so an editor
    // can write per-page help in every language without a redeploy. Language-aware;
    // no configured project or a failed fetch simply yields no items.
    help: HelpSource;
    // The "a run is in progress" signal: screens begin/end it, the composition
    // root reads it to hold a service-worker reload until the app is idle.
    // Turns a take into a shareable MP4 where the engine can encode one.
    video: VideoExporter;
    activity: ActivitySignal;
};

// Assembles a full service set from a partial override. Derived services follow the
// pieces they are built on: overriding just `store` gives every state store over
// that store, so a test that hands in a memoryStore gets consistent persistence
// throughout. Exported for the test harness, which builds one isolated world per
// test and hands its stores back for seeding and asserting.
export function createServices(overrides: Partial<AppServices> = {}): AppServices {
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
        assignments: overrides.assignments ?? createAssignmentsStore(store),
        fetcher,
        audio: overrides.audio ?? webAudioEngine,
        midi: overrides.midi ?? webMidi,
        xml: overrides.xml ?? domXmlCodec,
        songs: overrides.songs ?? createSongSource(fetcher, store, favorites),
        exercises: overrides.exercises ?? createExerciseSource(fetcher),
        news: overrides.news ?? createSanityNews(fetcher),
        help: overrides.help ?? createSanityHelp(fetcher),
        video: overrides.video ?? lazyVideoExporter,
        // The shared app-wide instance by default — the composition root watches
        // the same signal the screens write to.
        activity: overrides.activity ?? runActivity,
    };
}

// The one list of capability names, in a stable order. The Record type makes it
// exhaustive in both directions: adding a capability to AppServices without
// naming it here (or vice versa) fails to compile — so the provider below can
// never silently ignore an override.
const SERVICE_KEY_SET: Record<keyof AppServices, true> = {
    store: true,
    prefs: true,
    mastery: true,
    history: true,
    favorites: true,
    theme: true,
    hints: true,
    onboarding: true,
    daily: true,
    milestones: true,
    lifetime: true,
    ghosts: true,
    takes: true,
    fingering: true,
    assignments: true,
    fetcher: true,
    audio: true,
    midi: true,
    xml: true,
    songs: true,
    exercises: true,
    news: true,
    help: true,
    video: true,
    activity: true,
};
const SERVICE_KEYS = Object.keys(SERVICE_KEY_SET) as readonly (keyof AppServices)[];

// The production wiring. A component read outside any provider still gets working
// services, so nothing has to know whether it is inside the app shell or a test.
const DEFAULT_SERVICES: AppServices = createServices();

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
    // Keyed on the individual override values, not the prop object's identity: an
    // inline `services={{ store }}` literal is a fresh object every render, and
    // rebuilding the set each time would mint new stores whose subscribers miss
    // saves made through the previous instances. SERVICE_KEYS is a fixed list, so
    // the dependency array has a stable length and order across renders.
    const overrides = SERVICE_KEYS.map((key) => services?.[key]);
    const value = useMemo(
        () =>
            overrides.some((override) => override !== undefined)
                ? createServices(services)
                : DEFAULT_SERVICES,
        // biome-ignore lint/correctness/useExhaustiveDependencies: the memo is keyed on each override value; `services` itself is deliberately not a dependency (see above)
        overrides,
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

export function useAssignmentsStore(): AssignmentsStore {
    return useServices().assignments;
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

export function useNewsSource(): NewsSource {
    return useServices().news;
}

export function useHelpSource(): HelpSource {
    return useServices().help;
}

export function useVideoExporter(): VideoExporter {
    return useServices().video;
}
