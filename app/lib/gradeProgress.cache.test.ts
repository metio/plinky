// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { markLearned } from "../../core/mastery";
import { buildScore } from "../../core/musicxmlBuild";
import { domXmlCodec } from "../adapters/domXmlCodec";
import { memoryStore } from "../adapters/memoryStore";
import type { Fetcher } from "../ports/fetcher";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createExerciseSource } from "../stores/exerciseSource";
import { createPrefsStore } from "../stores/prefsStore";
import { saveUserScore } from "./catalog";
import { exerciseName } from "./exerciseNames";
import { type CatalogSources, loadGradeCatalogue, loadGradedMastery } from "./gradeProgress";
import { namingOf } from "./noteNames";

// The assembled catalogue is cached per store, because building it walks every manifest
// entry and parses the MusicXML of every score held on the device — and both loaders want
// one. A cache that outlived an import would be worse than no cache: the shelf would show
// a piece the grade ladder had never heard of.
//
// jsdom, because grading a held score parses its MusicXML through the DOM codec — in a
// bare node environment every such score is dropped as unreadable and the case under test
// never happens.

const MINE = buildScore({
    title: "Mine",
    fifths: 0,
    beatsPerBar: 4,
    treble: [
        { pitch: { step: "C", octave: 4, alter: 0 }, value: "quarter" },
        { pitch: { step: "E", octave: 4, alter: 0 }, value: "quarter" },
    ],
    bass: [{ pitch: { step: "C", octave: 3, alter: 0 }, value: "half" }],
});

const sourcesOver = (store: KeyValueStore): CatalogSources =>
    ({
        songs: {
            manifest: async () => [{ id: "s1", title: "One", composer: "C", grade: 1, cost: 1 }],
        },
        exercises: { manifest: async () => [] },
        xml: domXmlCodec,
        store,
    }) as unknown as CatalogSources;

const save = (store: KeyValueStore, id: string) =>
    saveUserScore(store, {
        id,
        title: id,
        composer: "Me",
        xml: MINE,
        tempo: 90,
    } as Parameters<typeof saveUserScore>[1]);

describe("the catalogue cache", () => {
    it("hands back the same catalogue for the same store and sources", async () => {
        const sources = sourcesOver(memoryStore());
        expect(await loadGradeCatalogue(sources)).toEqual(await loadGradeCatalogue(sources));
    });

    it("rebuilds once a score is imported", async () => {
        const store = memoryStore();
        const sources = sourcesOver(store);
        const before = await loadGradeCatalogue(sources);
        expect(before.some((one) => one.id === "mine")).toBe(false);

        save(store, "mine");
        const after = await loadGradeCatalogue(sources);
        expect(after.some((one) => one.id === "mine")).toBe(true);
        expect(after.length).toBe(before.length + 1);
    });

    it("shares one build across callers that ask in the same tick", async () => {
        // The header badge and the Home panel's two loaders all ask on a cold load; the
        // catalogue is assembled once and every one of them awaits that assembly.
        const store = memoryStore();
        save(store, "mine");
        let parses = 0;
        const counting: CatalogSources = {
            ...sourcesOver(store),
            xml: {
                ...domXmlCodec,
                parse: (text: string) => {
                    parses++;
                    return domXmlCodec.parse(text);
                },
            },
        };
        await Promise.all([
            loadGradedMastery(
                { loadAll: () => [{ id: "mine", value: markLearned(null, 0) }] },
                counting,
            ),
            loadGradeCatalogue(counting),
            loadGradeCatalogue(counting),
        ]);
        const shared = parses;

        parses = 0;
        const alone: CatalogSources = { ...counting, store: memoryStore() };
        save(alone.store, "mine");
        await loadGradeCatalogue(alone);
        expect(shared).toBe(parses);
    });

    it("asks again for a manifest that failed rather than remembering the gap", async () => {
        // A manifest that could not be fetched contributes nothing to that pass, and the
        // pass is not kept: the next load asks the network again, so the songs come back
        // the moment it does — and the mastery joined against them with it.
        let calls = 0;
        const sources: CatalogSources = {
            ...sourcesOver(memoryStore()),
            songs: {
                manifest: async () => {
                    calls++;
                    return calls === 1
                        ? null
                        : [{ id: "s1", title: "One", composer: "C", grade: 1, cost: 1 }];
                },
            } as unknown as CatalogSources["songs"],
        };
        const first = await loadGradeCatalogue(sources);
        expect(first.some((one) => one.id === "s1")).toBe(false);

        const second = await loadGradeCatalogue(sources);
        expect(second.some((one) => one.id === "s1")).toBe(true);
        expect(calls).toBe(2);

        const graded = await loadGradedMastery(
            { loadAll: () => [{ id: "s1", value: markLearned(null, 0) }] },
            sources,
        );
        expect(graded.map((one) => one.id)).toEqual(["s1"]);

        // A complete build is remembered: the third load does not ask the source again.
        await loadGradeCatalogue(sources);
        expect(calls).toBe(2);
    });

    it("asks again when it was the exercise manifest that failed", async () => {
        let calls = 0;
        const sources: CatalogSources = {
            ...sourcesOver(memoryStore()),
            exercises: {
                manifest: async () => {
                    calls++;
                    return calls === 1
                        ? null
                        : [{ id: "x1", title: "Study", composer: "C", grade: 1, cost: 1 }];
                },
            } as unknown as CatalogSources["exercises"],
        };
        expect((await loadGradeCatalogue(sources)).some((one) => one.id === "x1")).toBe(false);
        expect((await loadGradeCatalogue(sources)).some((one) => one.id === "x1")).toBe(true);
    });

    it("names a scale the way the player's keys name it now, not when it was cached", async () => {
        // A scale's title follows the note naming, which changes in Settings without a
        // reload and without anything else the catalogue is built from changing. Today,
        // Stats and the review session all read it through these two loaders.
        let naming = "H";
        const sources: CatalogSources = {
            ...sourcesOver(memoryStore()),
            exercises: {
                manifest: async () => [
                    { id: "scale-b", title: `${naming}-Dur-Tonleiter`, grade: 1, cost: 1 },
                    { id: "study-1", title: "Etüde", grade: 1, cost: 2 },
                ],
            },
        };
        const mastery = { loadAll: () => [{ id: "scale-b", value: markLearned(null, 0) }] };
        const titleIn = (list: { id: string; title: string }[], id: string) =>
            list.find((one) => one.id === id)?.title;

        expect(titleIn(await loadGradeCatalogue(sources), "scale-b")).toBe("H-Dur-Tonleiter");
        expect(titleIn(await loadGradedMastery(mastery, sources), "scale-b")).toBe(
            "H-Dur-Tonleiter",
        );

        naming = "B";
        const catalogue = await loadGradeCatalogue(sources);
        expect(titleIn(catalogue, "scale-b")).toBe("B-Dur-Tonleiter");
        expect(titleIn(await loadGradedMastery(mastery, sources), "scale-b")).toBe(
            "B-Dur-Tonleiter",
        );
        // Everything else about the row, and every other row, is the cached one.
        expect(catalogue.find((one) => one.id === "scale-b")).toMatchObject({
            grade: 1,
            cost: 1,
            kind: "piece",
        });
        expect(titleIn(catalogue, "study-1")).toBe("Etüde");
        expect(titleIn(catalogue, "s1")).toBe("One");
    });

    it("names a scale from the saved note naming through the real exercise source", async () => {
        // The path a player takes: Settings saves the prefs, and the source the app wires
        // names each scale-arpeggio row from its config with the naming those prefs ask
        // for. A study keeps the name its composer gave it.
        const store = memoryStore();
        const prefs = createPrefsStore(store);
        const manifest = [
            {
                id: "scale-c",
                title: "baked title",
                grade: 1,
                cost: 1,
                kind: "scale-arpeggio",
                config: {
                    type: "major-scale",
                    key: "c",
                    octaves: 1,
                    hands: "right",
                    inversion: 0,
                    interval: "single",
                },
                tempo: 90,
                beatsPerBar: 4,
            },
            { id: "study-1", title: "Etüde", composer: "Czerny", grade: 1, cost: 2, kind: "study" },
        ];
        const fetcher: Fetcher = async () => new Response(JSON.stringify(manifest));
        const sources: CatalogSources = {
            ...sourcesOver(store),
            exercises: createExerciseSource(fetcher, (config) =>
                exerciseName(config, namingOf(prefs.load())),
            ),
        };
        const titleIn = (list: { id: string; title: string }[], id: string) =>
            list.find((one) => one.id === id)?.title;

        const lettered = titleIn(await loadGradeCatalogue(sources), "scale-c");
        expect(lettered).toBe("C major scale");

        expect(prefs.save({ ...prefs.load(), noteLabels: "solfege" })).toBe(true);
        const catalogue = await loadGradeCatalogue(sources);
        const sung = titleIn(catalogue, "scale-c");
        expect(sung).not.toBe(lettered);
        expect(sung?.toLowerCase().startsWith("do")).toBe(true);
        expect(titleIn(catalogue, "study-1")).toBe("Etüde");
    });

    it("keeps the cached title when the exercise manifest cannot be read", async () => {
        let fail = false;
        const sources: CatalogSources = {
            ...sourcesOver(memoryStore()),
            exercises: {
                manifest: async () =>
                    fail ? null : [{ id: "scale-c", title: "C major scale", grade: 1, cost: 1 }],
            },
        };
        await loadGradeCatalogue(sources);
        fail = true;
        const list = await loadGradeCatalogue(sources);
        expect(list.find((one) => one.id === "scale-c")?.title).toBe("C major scale");
    });

    it("keeps one world's catalogue out of another's", async () => {
        // Every test builds its own store; a cache shared across them would hand one
        // test's imports to the next.
        const mine = memoryStore();
        save(mine, "mine");
        await loadGradeCatalogue(sourcesOver(mine));
        const theirs = await loadGradeCatalogue(sourcesOver(memoryStore()));
        expect(theirs.some((one) => one.id === "mine")).toBe(false);
    });
});
