// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { isRecord } from "./guards";
import { packToCode, unpackFromCode } from "./shareCode";

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

// An assignment carries opaque piece ids, so a step can outlive the piece it
// points at (a deleted import, a link from another device). These helpers judge
// items against a caller-supplied "is this id known?" predicate — the catalogue
// itself never enters core.

// The distinct unknown ids, in first-seen order.
export function missingAssignmentIds(
    items: AssignmentItem[],
    isKnown: (id: string) => boolean,
): string[] {
    const missing: string[] = [];
    for (const item of items) {
        if (!isKnown(item.id) && !missing.includes(item.id)) {
            missing.push(item.id);
        }
    }
    return missing;
}

// How many items resolve to a known piece, for an "N of M available" message.
export function availableItemCount(
    items: AssignmentItem[],
    isKnown: (id: string) => boolean,
): number {
    return items.filter((item) => isKnown(item.id)).length;
}

// The assignment with its unknown items dropped; survivors keep their order and
// their tempo/note. Pruning every item yields an empty assignment — callers
// decide whether that is a save or a delete.
export function pruneAssignment(
    assignment: Assignment,
    isKnown: (id: string) => boolean,
): Assignment {
    return { ...assignment, items: assignment.items.filter((item) => isKnown(item.id)) };
}

// How many assignments reference a piece id — a delete confirmation can then
// name the blast radius before an imported score is removed.
export function assignmentsReferencing(assignments: Assignment[], id: string): number {
    return assignments.filter((assignment) =>
        assignment.items.some((item) => item.id === id),
    ).length;
}

// The "continue where you left off" pointer for the home page: walk the
// assignments in order and return the first one with an unfinished step, as its
// name, the current step's 1-based position and score, and the step count. Every
// assignment finished (or none saved) → null, and the caller falls back to its
// generated suggestion. A step whose piece is missing can't be continued, so
// `isMissing` skips it to the next playable step; an assignment whose remaining
// steps are all missing yields no pointer rather than a dead link.
export function nextAssignmentStep(
    assignments: Assignment[],
    isDone: (id: string) => boolean,
    isMissing: (id: string) => boolean = () => false,
): { name: string; step: number; total: number; scoreId: string } | null {
    for (const assignment of assignments) {
        const current = assignment.items.findIndex(
            (item) => !isDone(item.id) && !isMissing(item.id),
        );
        if (current >= 0) {
            return {
                name: assignment.name,
                step: current + 1,
                total: assignment.items.length,
                scoreId: assignment.items[current]!.id,
            };
        }
    }
    return null;
}
