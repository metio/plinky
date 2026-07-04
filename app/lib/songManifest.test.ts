// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SongMeta } from "../stores/songSource";

// Guards the shipped song catalogue's contract: every song carries a difficulty cost,
// and the catalogue is ordered easiest-first. The library renders songs in manifest
// order, so this ordering is what makes a grade read gentle → hard rather than
// jumping around. The import writes the file in this shape; this pins it.
const manifest: SongMeta[] = JSON.parse(readFileSync("public/songs/manifest.json", "utf8"));

describe("song manifest", () => {
    it("gives every song a finite numeric cost", () => {
        expect(manifest.length).toBeGreaterThan(0);
        expect(
            manifest.every((song) => typeof song.cost === "number" && Number.isFinite(song.cost)),
        ).toBe(true);
    });

    it("orders songs easiest-first, so within a grade they climb gently", () => {
        for (let i = 1; i < manifest.length; i++) {
            expect(manifest[i]!.cost).toBeGreaterThanOrEqual(manifest[i - 1]!.cost);
        }
    });

    it("keeps grade rising in step with cost", () => {
        for (let i = 1; i < manifest.length; i++) {
            expect(manifest[i]!.grade).toBeGreaterThanOrEqual(manifest[i - 1]!.grade);
        }
    });
});
