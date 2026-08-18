// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { buildScore } from "../../core/musicxmlBuild";
import { domXmlCodec } from "../adapters/domXmlCodec";
import { memoryStore } from "../adapters/memoryStore";
import type { KeyValueStore } from "../ports/keyValueStore";
import { saveUserScore } from "./catalog";
import { type CatalogSources, loadGradeCatalogue } from "./gradeProgress";

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
