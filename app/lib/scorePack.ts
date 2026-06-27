// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The Plinky score-bundle format: a JSON document with MusicXML embedded, used to
// back up a library and to share or mass-import a set of scores. Each score carries
// its own content, so a bundle is self-contained.

// A score as it appears in a bundle. Only id, title, and xml are required — tempo and
// beatsPerBar are read from the MusicXML on import when a bundle omits them.
export interface PackScore {
    id: string;
    title: string;
    xml: string;
    tempo?: number;
    beatsPerBar?: number;
    description?: string;
    license?: string;
}

export interface ScorePack {
    format: "plinky-scores";
    version: 1;
    scores: PackScore[];
}

const FORMAT = "plinky-scores";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

// Tempo and beats-per-bar feed the 60000/tempo playback and grading math, so a
// zero, negative, or non-finite value is dropped here and re-derived from the
// MusicXML on import rather than admitted.
function isPositiveNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
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
    return {
        id: value.id,
        title: value.title,
        xml: value.xml,
        ...(isPositiveNumber(value.tempo) ? { tempo: value.tempo } : {}),
        ...(isPositiveNumber(value.beatsPerBar) ? { beatsPerBar: value.beatsPerBar } : {}),
        ...(typeof value.description === "string" ? { description: value.description } : {}),
        ...(typeof value.license === "string" ? { license: value.license } : {}),
    };
}

// Serialize a library to a bundle.
export function serializePack(scores: PackScore[]): string {
    const pack: ScorePack = { format: FORMAT, version: 1, scores };
    return JSON.stringify(pack, null, 2);
}

// Parse and validate a bundle, dropping malformed scores. Throws a reader-friendly
// error when the document is not a usable Plinky score bundle.
export function parsePack(json: string): ScorePack {
    let data: unknown;
    try {
        data = JSON.parse(json);
    } catch {
        throw new Error("That file is not valid JSON.");
    }
    if (!isRecord(data) || data.format !== FORMAT) {
        throw new Error("That is not a Plinky score bundle.");
    }
    if (!Array.isArray(data.scores)) {
        throw new Error("The score bundle has no scores.");
    }
    const scores = data.scores
        .map(parseScore)
        .filter((score): score is PackScore => score !== null);
    if (scores.length === 0) {
        throw new Error("The score bundle has no valid scores.");
    }
    return { format: FORMAT, version: 1, scores };
}
