// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DEFAULT_SONG_SOURCE, licenseDir, licenseInfo, sourceInfo } from "../core/attribution.ts";

// The catalogue as it actually ships, held to the promise the app makes about it: every
// piece Creative Commons, every piece crediting its composer, source and licence. The
// licence table's own laws are in core/attribution.property.test.ts; this asks the
// separate question of whether the 3,000-odd pieces in the manifest obey them.
//
// It reads the baked manifest rather than a fixture on purpose. A fixture would pass
// while the shipped file carried a piece nobody may redistribute — and the import that
// writes the manifest runs against corpora that change, so this is the check that the
// last import brought nothing in that the app cannot lawfully show.

type Song = {
    id: string;
    title: string;
    composer?: string;
    license?: string;
    source?: string;
    scoreKind?: string;
};

const MANIFEST = fileURLToPath(new URL("../public/songs/manifest.json", import.meta.url));
const songs = JSON.parse(readFileSync(MANIFEST, "utf8")) as Song[];
const arbSong = fc.constantFrom(...songs);

describe("the catalogue as it ships", () => {
    it("holds pieces at all", () => {
        // An emptied manifest would otherwise report a clean sweep over nothing.
        expect(songs.length).toBeGreaterThan(100);
    });

    it("carries a licence the app knows, on every piece", () => {
        for (const song of songs) {
            const license = licenseInfo(song.license);
            if (license === null) {
                throw new Error(`${song.id} (${song.title}) carries licence ${song.license}`);
            }
            // The catalogue adds fingering and grading, which is a derivative work, so a
            // no-derivatives piece could never have been admitted.
            expect(license.allowsDerivatives).toBe(true);
        }
    });

    it("names the composer of every piece whose licence asks for one", () => {
        for (const song of songs) {
            const license = licenseInfo(song.license);
            if (!license?.requiresAttribution) {
                continue;
            }
            // A BY piece shown without its creator is the one outcome the attribution
            // module exists to prevent, and the manifest is where it would start.
            expect(song.composer?.trim() ?? "").not.toBe("");
        }
    });

    it("says where every piece came from", () => {
        fc.assert(
            fc.property(arbSong, (song) => {
                const source = sourceInfo(song.source ?? DEFAULT_SONG_SOURCE);

                expect(source).not.toBeNull();
                expect(source?.label.trim()).not.toBe("");
            }),
            { numRuns: 300 },
        );
    });

    it("keeps each piece's score where its licence files it", () => {
        fc.assert(
            fc.property(arbSong, (song) => {
                const dir = licenseDir(song.license);
                const score = fileURLToPath(
                    new URL(`../public/songs/${dir}/${song.id}.mxl`, import.meta.url),
                );

                // The id is a fingerprint of the notes and carries no licence, so the
                // directory is the only thing tying a score to its terms: a piece filed
                // under the wrong one is annotated with the wrong licence by REUSE.
                expect(existsSync(score)).toBe(true);
            }),
            { numRuns: 120 },
        );
    });

    it("gives every piece an id and a title to show", () => {
        const ids = new Set<string>();
        for (const song of songs) {
            expect(song.id.trim()).not.toBe("");
            expect(song.title.trim()).not.toBe("");
            ids.add(song.id);
        }
        expect(ids.size).toBe(songs.length);
    });
});
