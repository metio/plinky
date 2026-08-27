// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { browserStore } from "../adapters/browserStore";
import { audioContext, playFromSamples, webAudioEngine } from "../adapters/webAudioEngine";
import { webStoragePersistence } from "../adapters/webStoragePersistence";
import { webSampleSource } from "../adapters/webSampleSource";
import { sampleLookup } from "../lib/sampleVoices";
import type { SampleSource } from "../ports/sampleSource";
import { lazyVideoExporter } from "../adapters/lazyVideo";
import { micPitch } from "../adapters/micPitch";
import { webMidi } from "../adapters/webMidi";
import { browserScheduler } from "../adapters/browserScheduler";
import type { MidiAccessPort } from "../ports/midiAccess";
import type { PitchInput } from "../ports/pitchInput";
import type { Scheduler } from "../ports/scheduler";
import type { AudioEngine } from "../ports/audioEngine";
import { samplesEnabled } from "../../core/sampledPiano";
import type { XmlCodec } from "../../core/xml";
import { domXmlCodec } from "../adapters/domXmlCodec";
import type { KeyValueStore } from "../ports/keyValueStore";
import type { StoragePersistence } from "../ports/storagePersistence";
import type { Fetcher } from "../ports/fetcher";
import { httpFetcher } from "../adapters/httpFetcher";
import type { VideoExporter } from "../ports/videoExporter";
import { createAssignmentsStore, type AssignmentsStore } from "../stores/assignmentsStore";
import { createDailyStore, type DailyStore } from "../stores/dailyStore";
import { exerciseName } from "../lib/exerciseNames";
import { createExerciseSource, type ExerciseSource } from "../stores/exerciseSource";
import { createHintsStore, type HintsStore } from "../stores/hintsStore";
import { createMilestonesStore, type MilestonesStore } from "../stores/milestonesStore";
import { createOnboardingStore, type OnboardingStore } from "../stores/onboardingStore";
import { createTheoryStore, type TheoryStore } from "../stores/theoryStore";
import { createNoteStatsStore, type NoteStatsStore } from "../stores/noteStatsStore";
import { createPlacementStore, type PlacementStore } from "../stores/placementStore";
import { createSectionBestStore, type SectionBestStore } from "../stores/sectionBestStore";
import { createSightReadStore, type SightReadStore } from "../stores/sightReadStore";
import { createThemeStore, type ThemeStore } from "../stores/themeStore";
import { createFavoritesStore, type FavoritesStore } from "../stores/favoritesStore";
import { createFingeringStore, type FingeringStore } from "../stores/fingeringStore";
import { createGhostStore, type GhostStore } from "../stores/ghostStore";
import { createLifetimeStore, type LifetimeStore } from "../stores/lifetimeStore";
import { createTakesStore, type TakesStore } from "../stores/takesStore";
import { createHistoryStore, type HistoryStore } from "../stores/historyStore";
import { createPracticeLogStore, type PracticeLogStore } from "../stores/practiceLogStore";
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
    // Asking the browser not to evict any of it (see StoragePersistence).
    persistence: StoragePersistence;
    // The single sources of truth for each family of persistent state, built over
    // `store`.
    prefs: PrefsStore;
    mastery: MasteryStore;
    history: HistoryStore;
    practiceLog: PracticeLogStore;
    favorites: FavoritesStore;
    theme: ThemeStore;
    hints: HintsStore;
    onboarding: OnboardingStore;
    // Which theory lessons have been met, so the course knows where you are.
    theory: TheoryStore;
    daily: DailyStore;
    milestones: MilestonesStore;
    lifetime: LifetimeStore;
    ghosts: GhostStore;
    sightReads: SightReadStore;
    placement: PlacementStore;
    noteStats: NoteStatsStore;
    sectionBest: SectionBestStore;
    takes: TakesStore;
    fingering: FingeringStore;
    assignments: AssignmentsStore;
    // How the network is reached (see Fetcher). The catalogue sources derive
    // from it, so overriding just this redirects every fetch.
    fetcher: Fetcher;
    // Where sound comes out (see AudioEngine).
    audio: AudioEngine;
    // Where recordings of a real piano come from (see SampleSource). Absent recordings are
    // not an absent instrument: the engine plays its own voice for anything not yet here.
    samples: SampleSource;
    // Where MIDI comes from (see MidiAccessPort).
    midi: MidiAccessPort;
    // Where microphone pitch detection comes from (see PitchInput), so an
    // acoustic piano can be an input device too.
    pitch: PitchInput;
    // How future work is scheduled (see Scheduler) — timers, intervals, and
    // animation frames. A test injects a virtual clock to drive time by hand.
    scheduler: Scheduler;
    // How MusicXML strings become walkable documents and back (see XmlCodec).
    xml: XmlCodec;
    // The fetched halves of the catalogue: the song manifest + on-demand .mxl,
    // and the exercise manifest + generated/fetched pieces.
    songs: SongSource;
    exercises: ExerciseSource;
    // The "a run is in progress" signal: screens begin/end it, the composition
    // root reads it to hold a service-worker reload until the app is idle.
    // Turns a take into a shareable MP4 where the engine can encode one.
    video: VideoExporter;
    activity: ActivitySignal;
};

// Where the recordings are published. A version sits in the path because a pack is
// immutable once uploaded: the app caches every recording by URL, and a changed encoding
// under an unchanged name is the one thing a cache cannot notice.
const SAMPLES_BASE = "https://samples.plinky.fun/v1";

// The key that remembers whether the player asked for the real piano. The recordings
// themselves live in the browser's cache, which the player never has to think about; this
// is the choice.
const SAMPLES_ENABLED = "plinky:samples";

function defaultSamples(overrides: Partial<AppServices>): SampleSource {
    const store = overrides.store ?? browserStore;
    const source = webSampleSource({
        baseUrl: SAMPLES_BASE,
        enabled: samplesEnabled(store.get(SAMPLES_ENABLED)),
        remember: (enabled) => {
            store.set(SAMPLES_ENABLED, enabled ? "1" : "0");
        },
        // The engine's own context, so a decoded recording belongs to the context that
        // will play it. Null before the first gesture unlocks audio, which is exactly when
        // nothing is being played anyway.
        context: async () => audioContext(),
    });
    // The engine asks this at every note-on. Handing it over here rather than importing it
    // there keeps the engine's one job — making a sound — free of where recordings live.
    playFromSamples(() => ({ source: sampleLookup(source) }));
    return source;
}

// Assembles a full service set from a partial override. Derived services follow the
// pieces they are built on: overriding just `store` gives every state store over
// that store, so a test that hands in a memoryStore gets consistent persistence
// throughout. Exported for the test harness, which builds one isolated world per
// test and hands its stores back for seeding and asserting.
export function createServices(overrides: Partial<AppServices> = {}): AppServices {
    const store = overrides.store ?? browserStore;
    const favorites = overrides.favorites ?? createFavoritesStore(store);
    const fetcher = overrides.fetcher ?? httpFetcher;
    // The mic samples on the Scheduler's frames, so it takes the same one the
    // rest of the app is given — a test that injects a fake clock drives the
    // mic's loop with it too, rather than the mic quietly keeping its own.
    const scheduler = overrides.scheduler ?? browserScheduler;
    return {
        store,
        persistence: overrides.persistence ?? webStoragePersistence,
        prefs: overrides.prefs ?? createPrefsStore(store),
        mastery: overrides.mastery ?? createMasteryStore(store),
        history: overrides.history ?? createHistoryStore(store),
        practiceLog: overrides.practiceLog ?? createPracticeLogStore(store),
        favorites,
        theme: overrides.theme ?? createThemeStore(store),
        hints: overrides.hints ?? createHintsStore(store),
        onboarding: overrides.onboarding ?? createOnboardingStore(store),
        theory: overrides.theory ?? createTheoryStore(store),
        daily: overrides.daily ?? createDailyStore(store),
        milestones: overrides.milestones ?? createMilestonesStore(store),
        lifetime: overrides.lifetime ?? createLifetimeStore(store),
        ghosts: overrides.ghosts ?? createGhostStore(store),
        sightReads: overrides.sightReads ?? createSightReadStore(store),
        placement: overrides.placement ?? createPlacementStore(store),
        noteStats: overrides.noteStats ?? createNoteStatsStore(store),
        sectionBest: overrides.sectionBest ?? createSectionBestStore(store),
        takes: overrides.takes ?? createTakesStore(store),
        fingering: overrides.fingering ?? createFingeringStore(store),
        assignments: overrides.assignments ?? createAssignmentsStore(store),
        fetcher,
        audio: overrides.audio ?? webAudioEngine,
        samples: overrides.samples ?? defaultSamples(overrides),
        midi: overrides.midi ?? webMidi,
        pitch: overrides.pitch ?? micPitch(scheduler),
        scheduler,
        xml: overrides.xml ?? domXmlCodec,
        songs: overrides.songs ?? createSongSource(fetcher),
        exercises: overrides.exercises ?? createExerciseSource(fetcher, exerciseName),
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
    persistence: true,
    store: true,
    prefs: true,
    mastery: true,
    history: true,
    practiceLog: true,
    favorites: true,
    theme: true,
    hints: true,
    onboarding: true,
    theory: true,
    daily: true,
    milestones: true,
    lifetime: true,
    ghosts: true,
    sightReads: true,
    placement: true,
    noteStats: true,
    sectionBest: true,
    takes: true,
    fingering: true,
    assignments: true,
    fetcher: true,
    audio: true,
    samples: true,
    midi: true,
    pitch: true,
    scheduler: true,
    xml: true,
    songs: true,
    exercises: true,
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

export function usePlacementStore(): PlacementStore {
    return useServices().placement;
}

export function useNoteStatsStore(): NoteStatsStore {
    return useServices().noteStats;
}

export function useSectionBestStore(): SectionBestStore {
    return useServices().sectionBest;
}

export function useHistoryStore(): HistoryStore {
    return useServices().history;
}

export function usePracticeLogStore(): PracticeLogStore {
    return useServices().practiceLog;
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

export function useTheoryStore(): TheoryStore {
    return useServices().theory;
}

export function useDailyStore(): DailyStore {
    return useServices().daily;
}

export function useTakesStore(): TakesStore {
    return useServices().takes;
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

export function useSampleSource(): SampleSource {
    return useServices().samples;
}

export function usePersistence(): StoragePersistence {
    return useServices().persistence;
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

export function useVideoExporter(): VideoExporter {
    return useServices().video;
}

export function useScheduler(): Scheduler {
    return useServices().scheduler;
}
