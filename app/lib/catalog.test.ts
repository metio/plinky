// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
    buildSong,
    exportAllPack,
    importSongsPack,
    loadBundledSongs,
    loadCatalog,
    loadUserSongs,
    readSongMeta,
    removeUserSong,
    resolveSong,
    saveUserSong,
    slugify,
    submissionUrl,
} from "./catalog";

function xml(title = "Test", beats = 4): string {
    return `<?xml version="1.0"?><score-partwise><work><work-title>${title}</work-title></work><identification><creator type="composer">Bach</creator></identification><part id="P1"><measure number="1"><attributes><time><beats>${beats}</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
}

afterEach(() => localStorage.clear());

describe("readSongMeta", () => {
    it("reads title, composer and meter from the MusicXML", () => {
        const meta = readSongMeta(xml("Minuet", 3));
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
        expect(readSongMeta(withTempo).tempo).toBe(120);
    });

    it("falls back to Untitled and 4/4 when the metadata is absent", () => {
        const meta = readSongMeta("<score-partwise><part/></score-partwise>");
        expect(meta.title).toBe("Untitled");
        expect(meta.composer).toBe("");
        expect(meta.beatsPerBar).toBe(4);
    });
});

describe("slugify", () => {
    it("makes a url-safe id, falling back to 'song'", () => {
        expect(slugify("Für Elise!")).toBe("f-r-elise");
        expect(slugify("   ")).toBe("song");
    });
});

describe("buildSong", () => {
    it("derives a song with an id unique among the taken ones", () => {
        const song = buildSong(xml("My Song"), ["my-song"]);
        expect(song.id).toBe("my-song-2");
        expect(song.title).toBe("My Song");
        expect(song.bundled).toBe(false);
    });
});

describe("user songs", () => {
    it("saves, loads and removes", () => {
        saveUserSong(buildSong(xml("A"), []));
        expect(loadUserSongs().map((s) => s.id)).toEqual(["a"]);
        saveUserSong(buildSong(xml("B"), ["a"]));
        expect(loadUserSongs()).toHaveLength(2);
        removeUserSong("a");
        expect(loadUserSongs().map((s) => s.id)).toEqual(["b"]);
    });
});

describe("loadBundledSongs", () => {
    it("returns the shipped scores, all marked bundled", () => {
        const bundled = loadBundledSongs();
        expect(bundled.length).toBeGreaterThan(0);
        expect(bundled.every((song) => song.bundled)).toBe(true);
    });
});

describe("loadCatalog", () => {
    it("includes bundled and user songs, the user's overriding by id", () => {
        const first = loadBundledSongs()[0]!;
        saveUserSong({ ...buildSong(xml("Mine"), []), id: first.id });
        const catalog = loadCatalog();
        const entry = catalog.find((song) => song.id === first.id);
        expect(entry?.title).toBe("Mine");
        expect(entry?.bundled).toBe(false);
        // No duplicate id from the shadowed bundled score.
        expect(catalog.filter((song) => song.id === first.id)).toHaveLength(1);
    });

    it("resolves a song by id, or undefined", () => {
        saveUserSong(buildSong(xml("Solo"), []));
        expect(resolveSong("solo")?.title).toBe("Solo");
        expect(resolveSong("nope")).toBeUndefined();
    });
});

describe("submissionUrl", () => {
    it("prefills the issue form with the MusicXML", () => {
        const url = submissionUrl(buildSong(xml("Gift"), []));
        expect(url).toContain("template=song-submission.yml");
        expect(url).toContain("song-title=Gift");
        expect(url).toContain("musicxml=");
    });
});

describe("pack backup", () => {
    it("round-trips the user library through export and import", () => {
        saveUserSong(buildSong(xml("Keep"), []));
        const pack = exportAllPack();
        localStorage.clear();
        const result = importSongsPack(pack);
        expect(result.imported).toBe(1);
        expect(loadUserSongs().map((s) => s.id)).toEqual(["keep"]);
    });
});
