// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The Plinky song-pack exchange format: a JSON document with MusicXML embedded,
// used for mass-importing a music school's curriculum and backing up a library. A
// pack declares any number of curriculums; each song references the ones it
// belongs to by id, so a song can sit in several.

export interface Curriculum {
    id: string;
    name: string;
    publisher?: string;
}

// A song as it appears in a pack. Only id, title, and xml are required — tempo and
// beatsPerBar are read from the MusicXML on import when a pack omits them.
export interface PackSong {
    id: string;
    title: string;
    xml: string;
    tempo?: number;
    beatsPerBar?: number;
    description?: string;
    curriculums?: string[];
    license?: string;
}

export interface SongPack {
    format: "plinky-songs";
    version: 1;
    curriculums: Curriculum[];
    songs: PackSong[];
}

const FORMAT = "plinky-songs";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parseCurriculum(value: unknown): Curriculum | null {
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
        return null;
    }
    return {
        id: value.id,
        name: value.name,
        ...(typeof value.publisher === "string" ? { publisher: value.publisher } : {}),
    };
}

function parseSong(value: unknown): PackSong | null {
    if (
        !isRecord(value) ||
        typeof value.id !== "string" ||
        typeof value.title !== "string" ||
        typeof value.xml !== "string"
    ) {
        return null;
    }
    const curriculums = Array.isArray(value.curriculums)
        ? value.curriculums.filter((entry): entry is string => typeof entry === "string")
        : undefined;
    return {
        id: value.id,
        title: value.title,
        xml: value.xml,
        ...(typeof value.tempo === "number" ? { tempo: value.tempo } : {}),
        ...(typeof value.beatsPerBar === "number" ? { beatsPerBar: value.beatsPerBar } : {}),
        ...(typeof value.description === "string" ? { description: value.description } : {}),
        ...(typeof value.license === "string" ? { license: value.license } : {}),
        ...(curriculums && curriculums.length > 0 ? { curriculums } : {}),
    };
}

// Serialize a library to a pack. The curriculums list carries the human-readable
// names for whatever the songs reference.
export function serializePack(songs: PackSong[], curriculums: Curriculum[] = []): string {
    const pack: SongPack = { format: FORMAT, version: 1, curriculums, songs };
    return JSON.stringify(pack, null, 2);
}

// Parse and validate a pack, dropping malformed songs. Throws a reader-friendly
// error when the document is not a usable Plinky pack.
export function parsePack(json: string): SongPack {
    let data: unknown;
    try {
        data = JSON.parse(json);
    } catch {
        throw new Error("That file is not valid JSON.");
    }
    if (!isRecord(data) || data.format !== FORMAT) {
        throw new Error("That is not a Plinky song pack.");
    }
    if (!Array.isArray(data.songs)) {
        throw new Error("The song pack has no songs.");
    }
    const songs = data.songs.map(parseSong).filter((song): song is PackSong => song !== null);
    if (songs.length === 0) {
        throw new Error("The song pack has no valid songs.");
    }
    const curriculums = Array.isArray(data.curriculums)
        ? data.curriculums
              .map(parseCurriculum)
              .filter((entry): entry is Curriculum => entry !== null)
        : [];
    return { format: FORMAT, version: 1, curriculums, songs };
}
