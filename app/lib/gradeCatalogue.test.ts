// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { domXmlCodec } from "../adapters/domXmlCodec";
import { httpFetcher } from "../adapters/httpFetcher";
import { memoryStore } from "../adapters/memoryStore";
import { createExerciseSource } from "../stores/exerciseSource";
import { createFavoritesStore } from "../stores/favoritesStore";
import { createSongSource } from "../stores/songSource";
import { afterEach, describe, expect, it } from "vitest";
import { saveUserScore, type Score } from "./catalog";
import { loadGradeCatalogue } from "./gradeProgress";

// The MSW handlers return empty song/exercise manifests by default, so the gradeable
// catalogue here is just the bundled demo pieces plus whatever user scores we inject.
afterEach(() => localStorage.clear());

const userScore = (id: string, xml: string): Score => ({
    id,
    title: id,
    composer: "",
    description: "",
    xml,
    tempo: 90,
    beatsPerBar: 4,
    bundled: false,
});

const scoreXml = (notes: string) =>
    `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">${notes}</measure></part></score-partwise>`;
const NOTE = `<note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note>`;

const kv = memoryStore();
const sources = {
    songs: createSongSource(httpFetcher, kv, createFavoritesStore(kv)),
    exercises: createExerciseSource(httpFetcher),
    xml: domXmlCodec,
    store: kv,
};

describe("loadGradeCatalogue", () => {
    it("keeps a playable import but drops a note-less one", async () => {
        saveUserScore(kv, userScore("playable-import-xyz", scoreXml(NOTE + NOTE)));
        saveUserScore(kv, userScore("empty-import-xyz", scoreXml("")));
        const ids = new Set((await loadGradeCatalogue(sources)).map((item) => item.id));
        // A score with notes is a real practice target…
        expect(ids.has("playable-import-xyz")).toBe(true);
        // …while one with no fingerable notes is nothing to practise and is left out.
        expect(ids.has("empty-import-xyz")).toBe(false);
    });
});
