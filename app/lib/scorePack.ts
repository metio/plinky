// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The Plinky score-pack exchange format: a JSON document with MusicXML embedded,
// used for mass-importing a music school's curriculum and backing up a library. A
// pack declares any number of curriculums; each score references the ones it
// belongs to by id, so a score can sit in several.

export interface Curriculum {
    id: string;
    name: string;
    publisher?: string;
}

// A score as it appears in a pack. Only id, title, and xml are required — tempo and
// beatsPerBar are read from the MusicXML on import when a pack omits them.
export interface PackScore {
    id: string;
    title: string;
    xml: string;
    tempo?: number;
    beatsPerBar?: number;
    description?: string;
    curriculums?: string[];
    license?: string;
}

export interface ScorePack {
    format: "plinky-scores";
    version: 1;
    curriculums: Curriculum[];
    scores: PackScore[];
}

const FORMAT = "plinky-scores";

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

function parseScore(value: unknown): PackScore | null {
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
// names for whatever the scores reference.
export function serializePack(scores: PackScore[], curriculums: Curriculum[] = []): string {
    const pack: ScorePack = { format: FORMAT, version: 1, curriculums, scores };
    return JSON.stringify(pack, null, 2);
}

// Parse and validate a pack, dropping malformed scores. Throws a reader-friendly
// error when the document is not a usable Plinky pack.
export function parsePack(json: string): ScorePack {
    let data: unknown;
    try {
        data = JSON.parse(json);
    } catch {
        throw new Error("That file is not valid JSON.");
    }
    if (!isRecord(data) || data.format !== FORMAT) {
        throw new Error("That is not a Plinky score pack.");
    }
    if (!Array.isArray(data.scores)) {
        throw new Error("The score pack has no scores.");
    }
    const scores = data.scores
        .map(parseScore)
        .filter((score): score is PackScore => score !== null);
    if (scores.length === 0) {
        throw new Error("The score pack has no valid scores.");
    }
    const curriculums = Array.isArray(data.curriculums)
        ? data.curriculums
              .map(parseCurriculum)
              .filter((entry): entry is Curriculum => entry !== null)
        : [];
    return { format: FORMAT, version: 1, curriculums, scores };
}
