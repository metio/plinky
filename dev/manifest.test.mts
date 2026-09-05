// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SongMeta } from "../core/catalogMeta.ts";
import { readSongs, readSongsSync, writeSongs, writeSongsSync } from "./manifest.mts";

const ROW: SongMeta = {
    id: "abc123",
    title: "Minuet",
    composer: "Bach",
    grade: 1,
    cost: 2.5,
    license: "CC0-1.0",
    tempo: 90,
    beatsPerBar: 3,
    bars: 16,
};

let dir = "";
afterEach(() => {
    if (dir) {
        rmSync(dir, { recursive: true, force: true });
        dir = "";
    }
});

describe("the song manifest", () => {
    it("round-trips its rows, minified", async () => {
        dir = mkdtempSync(join(tmpdir(), "plinky-manifest-"));
        const path = join(dir, "manifest.json");
        await writeSongs([ROW], path);
        expect(await readSongs(path)).toEqual([ROW]);
        writeSongsSync([ROW, { ...ROW, id: "def456" }], path);
        expect(readSongsSync(path).map((row) => row.id)).toEqual(["abc123", "def456"]);
        expect(readSongsSync(path)).toEqual(
            JSON.parse(JSON.stringify([ROW, { ...ROW, id: "def456" }])),
        );
    });

    it("refuses a file that is not a list of rows", () => {
        dir = mkdtempSync(join(tmpdir(), "plinky-manifest-"));
        const path = join(dir, "manifest.json");
        writeFileSync(path, "{}");
        expect(() => readSongsSync(path)).toThrow(/not a list/);
    });
});
