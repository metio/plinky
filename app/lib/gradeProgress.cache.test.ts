// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { markLearned } from "../../core/mastery";
import { buildScore } from "../../core/musicxmlBuild";
import { domXmlCodec } from "../adapters/domXmlCodec";
import { memoryStore } from "../adapters/memoryStore";
import type { KeyValueStore } from "../ports/keyValueStore";
import { saveUserScore } from "./catalog";
import { type CatalogSources, loadGradeCatalogue, loadGradedMastery } from "./gradeProgress";

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
        expect(calls).toBe(2);
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
