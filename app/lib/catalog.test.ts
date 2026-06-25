// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
    buildScore,
    exportAllPack,
    importScoresPack,
    loadBundledScores,
    loadCatalog,
    loadCurriculums,
    loadUserScores,
    readScoreMeta,
    removeUserScore,
    resolveScore,
    saveUserScore,
    slugify,
    submissionUrl,
} from "./catalog";

function xml(title = "Test", beats = 4): string {
    return `<?xml version="1.0"?><score-partwise><work><work-title>${title}</work-title></work><identification><creator type="composer">Bach</creator></identification><part id="P1"><measure number="1"><attributes><time><beats>${beats}</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
}

afterEach(() => localStorage.clear());

describe("loadUserScores robustness", () => {
    it("defaults a non-numeric sound tempo rather than emitting NaN", () => {
        const meta = readScoreMeta(
            '<?xml version="1.0"?><score-partwise><sound tempo="andante"/></score-partwise>',
        );
        expect(meta.tempo).toBe(90);
    });

    it("drops corrupt stored entries so the catalogue sort never throws", () => {
        localStorage.setItem(
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
        expect(loadUserScores()).toHaveLength(1);
        // The catalogue still sorts without throwing on the dropped entry.
        expect(() => loadCatalog()).not.toThrow();
    });

    it("drops malformed stored curriculums so grouping can't crash", () => {
        localStorage.setItem(
            "plinky:curriculums",
            JSON.stringify([{ id: "grade-1", name: "Grade 1" }, null, { id: 7 }, "nope"]),
        );
        expect(loadCurriculums()).toEqual([{ id: "grade-1", name: "Grade 1" }]);
    });

    it("repairs a non-finite stored tempo to the default", () => {
        localStorage.setItem(
            "plinky:scores",
            JSON.stringify([{ id: "x", title: "X", xml: "<x/>", tempo: 0, beatsPerBar: -1 }]),
        );
        const score = loadUserScores()[0];
        expect(score?.tempo).toBe(90);
        expect(score?.beatsPerBar).toBe(4);
    });
});

describe("readScoreMeta", () => {
    it("reads title, composer and meter from the MusicXML", () => {
        const meta = readScoreMeta(xml("Minuet", 3));
        expect(meta.title).toBe("Minuet");
        expect(meta.composer).toBe("Bach");
        expect(meta.beatsPerBar).toBe(3);
        expect(meta.tempo).toBe(90); // no <sound tempo>, so the default
    });

    it("reads an explicit tempo from <sound>", () => {
        const withTempo = xml().replace(
            "</work>",
            '</work><part><measure><sound tempo="120"/></measure></part>',
        );
        expect(readScoreMeta(withTempo).tempo).toBe(120);
    });

    it("falls back to Untitled and 4/4 when the metadata is absent", () => {
        const meta = readScoreMeta("<score-partwise><part/></score-partwise>");
        expect(meta.title).toBe("Untitled");
        expect(meta.composer).toBe("");
        expect(meta.beatsPerBar).toBe(4);
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
        const score = buildScore(xml("My Score"), ["my-score"]);
        expect(score.id).toBe("my-score-2");
        expect(score.title).toBe("My Score");
        expect(score.bundled).toBe(false);
    });
});

describe("user scores", () => {
    it("saves, loads and removes", () => {
        saveUserScore(buildScore(xml("A"), []));
        expect(loadUserScores().map((s) => s.id)).toEqual(["a"]);
        saveUserScore(buildScore(xml("B"), ["a"]));
        expect(loadUserScores()).toHaveLength(2);
        removeUserScore("a");
        expect(loadUserScores().map((s) => s.id)).toEqual(["b"]);
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
        saveUserScore({ ...buildScore(xml("Mine"), []), id: first.id });
        const catalog = loadCatalog();
        const entry = catalog.find((score) => score.id === first.id);
        expect(entry?.title).toBe("Mine");
        expect(entry?.bundled).toBe(false);
        // No duplicate id from the shadowed bundled score.
        expect(catalog.filter((score) => score.id === first.id)).toHaveLength(1);
    });

    it("resolves a score by id, or undefined", () => {
        saveUserScore(buildScore(xml("Solo"), []));
        expect(resolveScore("solo")?.title).toBe("Solo");
        expect(resolveScore("nope")).toBeUndefined();
    });
});

describe("submissionUrl", () => {
    it("prefills the issue form with the MusicXML", () => {
        const url = submissionUrl(buildScore(xml("Gift"), []));
        expect(url).toContain("template=score-submission.yml");
        expect(url).toContain("score-title=Gift");
        expect(url).toContain("musicxml=");
    });
});

describe("pack backup", () => {
    it("round-trips the user library through export and import", () => {
        saveUserScore(buildScore(xml("Keep"), []));
        const pack = exportAllPack();
        localStorage.clear();
        const result = importScoresPack(pack);
        expect(result.imported).toBe(1);
        expect(loadUserScores().map((s) => s.id)).toEqual(["keep"]);
    });
});
