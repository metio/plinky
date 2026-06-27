// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { packToCode, unpackFromCode } from "./shareCode";
import type { Track } from "./tracks";

// A teacher's assignment: a named, ordered list of catalogue ids (bundled pieces,
// imported scores, or finger exercises) with an optional target tempo and note per
// item. It is tiny — no MusicXML, since exercises generate from their id and pieces
// already live in the catalogue — so it travels as a small .json file or a single
// compressed share link, like a user-authored track. Received, it becomes a local
// track; progress stays per-id, exactly as for the built-in tracks.

export interface AssignmentItem {
    id: string;
    // A target tempo to reach on this item, and a short instruction from the teacher.
    tempo?: number;
    note?: string;
}

export interface Assignment {
    format: "plinky-assignment";
    version: 1;
    id: string;
    name: string;
    description?: string;
    items: AssignmentItem[];
}

const FORMAT = "plinky-assignment";
const STORAGE_KEY = "plinky:assignments";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

// A tempo feeds the 60000/tempo playback math, so only a sane positive value is
// kept; anything else is dropped and the item simply carries no target.
function cleanTempo(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) && value >= 20 && value <= 400
        ? Math.round(value)
        : undefined;
}

function cleanNote(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 200) : undefined;
}

function cleanItem(value: unknown): AssignmentItem | null {
    if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) {
        return null;
    }
    const tempo = cleanTempo(value.tempo);
    const note = cleanNote(value.note);
    return { id: value.id, ...(tempo ? { tempo } : {}), ...(note ? { note } : {}) };
}

export function slugifyName(name: string): string {
    return (
        name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "assignment"
    );
}

// A fresh id from the name, made unique against ids already taken so a new
// assignment neither clashes with nor silently overwrites an existing one.
export function newAssignmentId(name: string, taken: Iterable<string>): string {
    const base = slugifyName(name);
    const used = new Set(taken);
    let id = base;
    for (let n = 2; used.has(id); n++) {
        id = `${base}-${n}`;
    }
    return id;
}

// Build a validated assignment from loose parts, dropping malformed items.
export function makeAssignment(parts: {
    id?: string;
    name?: string;
    description?: string;
    items: unknown[];
}): Assignment {
    const name =
        typeof parts.name === "string" && parts.name.trim() ? parts.name.trim() : "Untitled";
    const description = cleanNote(parts.description);
    const items = parts.items
        .map(cleanItem)
        .filter((item): item is AssignmentItem => item !== null);
    return {
        format: FORMAT,
        version: 1,
        id: parts.id && parts.id.length > 0 ? parts.id : slugifyName(name),
        name,
        ...(description ? { description } : {}),
        items,
    };
}

export function serializeAssignment(assignment: Assignment): string {
    return JSON.stringify(makeAssignment(assignment), null, 2);
}

// Parse and validate an assignment file, throwing a reader-friendly message when the
// document is not a usable assignment.
export function parseAssignment(json: string): Assignment {
    let data: unknown;
    try {
        data = JSON.parse(json);
    } catch {
        throw new Error("That file is not valid JSON.");
    }
    if (!isRecord(data) || data.format !== FORMAT) {
        throw new Error("That is not a Plinky assignment.");
    }
    if (!Array.isArray(data.items)) {
        throw new Error("The assignment has no items.");
    }
    const assignment = makeAssignment({
        id: typeof data.id === "string" ? data.id : undefined,
        name: typeof data.name === "string" ? data.name : undefined,
        description: typeof data.description === "string" ? data.description : undefined,
        items: data.items,
    });
    if (assignment.items.length === 0) {
        throw new Error("The assignment has no valid items.");
    }
    return assignment;
}

// The compact shape carried by a share link — short keys, the local id dropped (the
// receiver assigns its own), each item a tuple so the payload stays small before
// compression: [id], [id, tempo], or [id, tempo, note].
type CompactItem = [string] | [string, number] | [string, number, string];
type Compact = { n: string; d?: string; i: CompactItem[] };

function toCompact(assignment: Assignment): Compact {
    return {
        n: assignment.name,
        ...(assignment.description ? { d: assignment.description } : {}),
        i: assignment.items.map((item): CompactItem => {
            if (item.note) {
                return [item.id, item.tempo ?? 0, item.note];
            }
            if (item.tempo) {
                return [item.id, item.tempo];
            }
            return [item.id];
        }),
    };
}

function fromCompact(compact: unknown): Assignment {
    if (!isRecord(compact) || !Array.isArray(compact.i)) {
        throw new Error("malformed");
    }
    const items = compact.i.map((tuple) => {
        if (!Array.isArray(tuple)) {
            return null;
        }
        const [id, tempo, note] = tuple as [unknown, unknown, unknown];
        return cleanItem({ id, tempo, note });
    });
    return makeAssignment({
        name: typeof compact.n === "string" ? compact.n : undefined,
        description: typeof compact.d === "string" ? compact.d : undefined,
        items,
    });
}

// Pack an assignment into a URL-safe token: a compact shape through the shared
// share-code codec, short enough for a ?assignment= link.
export function encodeAssignmentLink(assignment: Assignment): string {
    return packToCode(toCompact(assignment));
}

export function decodeAssignmentLink(code: string): Assignment | null {
    if (!code) {
        return null;
    }
    try {
        const assignment = fromCompact(unpackFromCode(code));
        return assignment.items.length > 0 ? assignment : null;
    } catch {
        return null;
    }
}

export function loadAssignments(): Assignment[] {
    if (typeof localStorage === "undefined") {
        return [];
    }
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .map((entry) => {
                if (!isRecord(entry) || !Array.isArray(entry.items)) {
                    return null;
                }
                const assignment = makeAssignment({
                    id: typeof entry.id === "string" ? entry.id : undefined,
                    name: typeof entry.name === "string" ? entry.name : undefined,
                    description:
                        typeof entry.description === "string" ? entry.description : undefined,
                    items: entry.items,
                });
                return assignment.items.length > 0 ? assignment : null;
            })
            .filter((entry): entry is Assignment => entry !== null);
    } catch {
        return [];
    }
}

function storeAssignments(assignments: Assignment[]): boolean {
    if (typeof localStorage === "undefined") {
        return false;
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
        return true;
    } catch {
        return false;
    }
}

// Upsert by id, so re-saving an edited assignment refreshes it in place. Returns
// false when the write fails (e.g. storage quota), so a caller can say so.
export function saveAssignment(assignment: Assignment): boolean {
    const others = loadAssignments().filter((entry) => entry.id !== assignment.id);
    return storeAssignments([...others, assignment]);
}

export function removeAssignment(id: string): void {
    storeAssignments(loadAssignments().filter((entry) => entry.id !== id));
}

// An assignment shown as a track: it steps through its items in order, so it slots
// into the tracks page beside the built-in progressions. The id is namespaced so it
// can't collide with a built-in track's id.
export function assignmentToTrack(assignment: Assignment): Track {
    return {
        id: `assignment:${assignment.id}`,
        name: assignment.name,
        description: assignment.description ?? "",
        kind: "progression",
        scoreIds: assignment.items.map((item) => item.id),
    };
}
