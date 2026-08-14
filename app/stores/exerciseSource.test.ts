// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { arcadeConfig } from "../../core/arcade";
import { buildExerciseId, type ExerciseConfig, exerciseTitle } from "../../core/exerciseGen";
import type { Fetcher } from "../ports/fetcher";
import { createExerciseSource, type ExerciseMeta } from "./exerciseSource";

// The source takes its fetcher as a lambda, so a canned-response fake replaces
// a whole mock server. Names come in the same way: the English name core knows stands
// in for the app's translated one.
const sourceOver = (fetchUrl: Fetcher) => createExerciseSource(fetchUrl, exerciseTitle);

const scaleConfig: ExerciseConfig = {
    type: "major-scale",
    key: "c",
    octaves: 1,
    hands: "right",
    inversion: 0,
    interval: "single",
};

const scaleMeta: ExerciseMeta = {
    id: "ex-scale",
    title: "C major scale",
    grade: 1,
    cost: 1,
    kind: "scale-arpeggio",
    config: scaleConfig,
    tempo: 80,
    beatsPerBar: 4,
};

const studyMeta: ExerciseMeta = {
    id: "ex-study",
    title: "Study No. 1",
    grade: 2,
    cost: 2,
    kind: "study",
    composer: "Czerny",
    license: "CC0-1.0",
    tempo: 100,
    beatsPerBar: 4,
};

// A minimal real .mxl: a zip holding the score XML, the shape decompressMxl reads.
const STUDY_XML = `<?xml version="1.0"?><score-partwise version="4.0"></score-partwise>`;
const studyMxl = () => zipSync({ "score.xml": strToU8(STUDY_XML) });

const withManifest =
    (entries: unknown, onStudy?: () => Response): Fetcher =>
    (url) => {
        if (url.endsWith("manifest.json")) {
            return Promise.resolve(Response.json(entries));
        }
        return Promise.resolve(onStudy ? onStudy() : new Response(null, { status: 404 }));
    };

describe("exerciseSource.manifest", () => {
    it("caches a completed manifest for the session", async () => {
        let fetches = 0;
        const source = sourceOver(() => {
            fetches++;
            return Promise.resolve(Response.json([scaleMeta]));
        });
        expect(await source.manifest()).toHaveLength(1);
        await source.manifest();
        expect(fetches).toBe(1);
    });

    it("answers null on a failed fetch but retries — a transient failure must not read as an empty catalogue for the session", async () => {
        let calls = 0;
        const source = sourceOver(() => {
            calls++;
            return calls === 1
                ? Promise.reject(new TypeError("network down"))
                : Promise.resolve(Response.json([scaleMeta]));
        });
        expect(await source.manifest()).toBeNull();
        expect(await source.manifest()).toHaveLength(1);
        // The recovered manifest is cached like any completed one.
        await source.manifest();
        expect(calls).toBe(2);
    });

    it("retries after a non-OK response too", async () => {
        let calls = 0;
        const source = sourceOver(() => {
            calls++;
            return calls === 1
                ? Promise.resolve(new Response(null, { status: 503 }))
                : Promise.resolve(Response.json([studyMeta]));
        });
        expect(await source.manifest()).toBeNull();
        expect((await source.manifest())?.[0]?.id).toBe("ex-study");
    });

    it("treats a non-array manifest body as a failure rather than crashing consumers", async () => {
        const source = sourceOver(withManifest({ unexpected: "object" }));
        expect(await source.manifest()).toBeNull();
    });
});

describe("exerciseSource.resolve", () => {
    it("rebuilds a generated scale from its stored config", async () => {
        const source = sourceOver(withManifest([scaleMeta]));
        const resolved = await source.resolve("ex-scale");
        const score = typeof resolved === "object" ? resolved : null;
        expect(score?.title).toBe("C major scale");
        expect(score?.xml).toContain("score-partwise");
        expect(score?.license).toBe("CC0-1.0");
        expect(score?.bundled).toBe(true);
    });

    it("fetches and decompresses a study's .mxl", async () => {
        const source = sourceOver(withManifest([studyMeta], () => new Response(studyMxl())));
        const resolved = await source.resolve("ex-study");
        const score = typeof resolved === "object" ? resolved : null;
        expect(score?.xml).toBe(STUDY_XML);
        expect(score?.composer).toBe("Czerny");
        expect(score?.title).toBe("Study No. 1");
    });

    it("is null for an unknown id, so the play flow can fall through", async () => {
        const source = sourceOver(withManifest([scaleMeta]));
        expect(await source.resolve("not-an-exercise")).toBeNull();
    });

    it("generates a valid exercise id that isn't in the manifest, so the arcade climbs beyond it", async () => {
        const source = sourceOver(withManifest([scaleMeta]));
        // A far arcade rung: a valid config, but no manifest entry names it.
        const id = buildExerciseId(arcadeConfig(50));
        const resolved = await source.resolve(id);
        const score = typeof resolved === "object" ? resolved : null;
        expect(score?.xml).toContain("score-partwise");
        expect(score?.tempo).toBe(90);
        expect(score?.license).toBe("CC0-1.0");
    });

    it("is unavailable — not null — when a study's .mxl cannot be fetched", async () => {
        // The manifest names the study, so the piece exists; only the fetch
        // failed, and "gone" would be a lie the play page repeats to the user.
        const source = sourceOver(
            withManifest([studyMeta], () => new Response(null, { status: 500 })),
        );
        expect(await source.resolve("ex-study")).toBe("unavailable");
    });

    it("is unavailable when the manifest itself cannot be fetched", async () => {
        const source = sourceOver(() => Promise.resolve(new Response(null, { status: 500 })));
        expect(await source.resolve("ex-study")).toBe("unavailable");
    });
});
