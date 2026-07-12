// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
import { beforeEach, describe, expect, it } from "vitest";
import {
    buildScore,
    exportAllPack,
    exportFullPack,
    importScoresPack,
    loadBundledScores,
    loadCatalog,
    loadUserScores,
    removeUserScore,
    resolveScore,
    saveUserScore,
    slugify,
} from "./catalog";
import { browserStore } from "../adapters/browserStore";
import { memoryStore } from "../adapters/memoryStore";
import type { KeyValueStore } from "../ports/keyValueStore";
import { withDeniedStorage } from "../testing/deniedStorage";
import type { XmlCodec } from "../../core/xml";

function xml(title = "Test", beats = 4): string {
    return `<?xml version="1.0"?><score-partwise><work><work-title>${title}</work-title></work><identification><creator type="composer">Bach</creator></identification><part id="P1"><measure number="1"><attributes><time><beats>${beats}</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
}

// Without a DOM in the node project, the codec answers null and readScoreMeta
// takes its text pass — the same route the static prerender uses.
const codec: XmlCodec = { parse: () => null, serialize: () => "" };

// A fresh in-memory store per test — the catalogue takes its persistence injected.
let kv: KeyValueStore;
beforeEach(() => {
    kv = memoryStore();
});

describe("loadUserScores robustness", () => {
    it("drops corrupt stored entries so the catalogue sort never throws", () => {
        kv.set(
            "plinky:scores",
            JSON.stringify([
                {
                    id: "ok",
                    title: "Good",
                    xml: "<x/>",
                    tempo: 100,
                    beatsPerBar: 4,
                    bundled: false,
                },
                { id: "bad", xml: "<x/>" }, // missing title — would break localeCompare
                "not an object",
            ]),
        );
        expect(loadUserScores(kv)).toHaveLength(1);
        // The catalogue still sorts without throwing on the dropped entry.
        expect(() => loadCatalog(kv)).not.toThrow();
    });

    it("repairs a non-finite stored tempo to the default", () => {
        kv.set(
            "plinky:scores",
            JSON.stringify([{ id: "x", title: "X", xml: "<x/>", tempo: 0, beatsPerBar: -1 }]),
        );
        const score = loadUserScores(kv)[0];
        expect(score?.tempo).toBe(90);
        expect(score?.beatsPerBar).toBe(4);
    });
});

describe("user scores under denied storage", () => {
    it("reads an empty library rather than throwing when storage is blocked", () => {
        expect(withDeniedStorage(() => loadUserScores(browserStore))).toEqual([]);
    });

    it("reports a failed save rather than throwing when storage is blocked", () => {
        const score = buildScore(codec, xml("Blocked"), []);
        expect(withDeniedStorage(() => saveUserScore(browserStore, score))).toBe(false);
    });

    it("surfaces a clean error, not a SecurityError, when importing into blocked storage", () => {
        saveUserScore(kv, buildScore(codec, xml("Pack"), []));
        const pack = exportAllPack(kv);
        expect(() => withDeniedStorage(() => importScoresPack(browserStore, codec, pack))).toThrow(
            /Could not save/,
        );
    });
});

describe("library export packs", () => {
    it("backs up only the user's imports in the plain pack", () => {
        saveUserScore(kv, buildScore(codec, xml("Mine"), []));
        const pack = JSON.parse(exportAllPack(kv));
        expect(pack.scores.map((s: { title: string }) => s.title)).toEqual(["Mine"]);
    });

    it("includes the bundled pieces alongside imports in the full pack", () => {
        saveUserScore(kv, buildScore(codec, xml("Mine"), []));
        const pack = JSON.parse(exportFullPack(kv));
        const titles = pack.scores.map((s: { title: string }) => s.title);
        expect(titles).toContain("Mine");
        for (const bundled of loadBundledScores()) {
            expect(titles).toContain(bundled.title);
        }
        // Each exported score is self-contained: the MusicXML rides along.
        expect(pack.scores.every((s: { xml?: string }) => typeof s.xml === "string")).toBe(true);
    });
});

describe("slugify", () => {
    it("makes a url-safe id, falling back to 'score'", () => {
        expect(slugify("Für Elise!")).toBe("f-r-elise");
        expect(slugify("   ")).toBe("score");
    });
});

describe("buildScore", () => {
    it("derives a score with an id unique among the taken ones", () => {
        const score = buildScore(codec, xml("My Score"), ["my-score"]);
        expect(score.id).toBe("my-score-2");
        expect(score.title).toBe("My Score");
        expect(score.bundled).toBe(false);
    });
});

describe("user scores", () => {
    it("saves, loads and removes", () => {
        saveUserScore(kv, buildScore(codec, xml("A"), []));
        expect(loadUserScores(kv).map((s) => s.id)).toEqual(["a"]);
        saveUserScore(kv, buildScore(codec, xml("B"), ["a"]));
        expect(loadUserScores(kv)).toHaveLength(2);
        removeUserScore(kv, "a");
        expect(loadUserScores(kv).map((s) => s.id)).toEqual(["b"]);
    });
});

describe("loadBundledScores", () => {
    it("returns the shipped scores, all marked bundled", () => {
        const bundled = loadBundledScores();
        expect(bundled.length).toBeGreaterThan(0);
        expect(bundled.every((score) => score.bundled)).toBe(true);
    });
});

describe("loadCatalog", () => {
    it("includes bundled and user scores, the user's overriding by id", () => {
        const first = loadBundledScores()[0]!;
        saveUserScore(kv, { ...buildScore(codec, xml("Mine"), []), id: first.id });
        const catalog = loadCatalog(kv);
        const entry = catalog.find((score) => score.id === first.id);
        expect(entry?.title).toBe("Mine");
        expect(entry?.bundled).toBe(false);
        // No duplicate id from the shadowed bundled score.
        expect(catalog.filter((score) => score.id === first.id)).toHaveLength(1);
    });

    it("resolves a score by id, or undefined", () => {
        saveUserScore(kv, buildScore(codec, xml("Solo"), []));
        expect(resolveScore(kv, "solo")?.title).toBe("Solo");
        expect(resolveScore(kv, "nope")).toBeUndefined();
    });
});

describe("pack backup", () => {
    it("round-trips the user library through export and import", () => {
        saveUserScore(kv, buildScore(codec, xml("Keep"), []));
        const pack = exportAllPack(kv);
        const other = memoryStore();
        const result = importScoresPack(other, codec, pack);
        expect(result.imported).toBe(1);
        expect(loadUserScores(other).map((s) => s.id)).toEqual(["keep"]);
    });
});
