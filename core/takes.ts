// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import {
    type Composition,
    decodeComposition,
    encodeComposition,
    type RecordedNote,
} from "./composition";
import { type Grade, parseGrade } from "./grade";

// A saved performance of a piece — your own play, kept per song so you can hear it
// back, download it, and (the fastest one) race it as your ghost. A take IS a
// Composition, so it reuses Compose's compact share codec for storage and its MIDI /
// MusicXML exporters and synth playback for free.
export type Take = {
    id: string;
    // Wall-clock ms when saved, for ordering and a "2m ago" label.
    createdAt: number;
    // The grade letter earned on this run, so the list scans at a glance ("Take · B").
    letter: string;
    // True once the player reached the end of the piece (vs stopped partway) — only a
    // complete take is eligible to become the race ghost.
    complete: boolean;
    // The run's full grade (accuracy/timing/flow/dynamics/score/letter), so past takes
    // can show their metrics, not just the summary letter. Null for a take saved from a
    // run that was never graded (stopped before finishing).
    metrics: Grade | null;
    composition: Composition;
};

// At most this many takes per song; the oldest are dropped so storage can't grow
// without bound. The cap is generous enough to keep a few good attempts.
export const MAX_TAKES_PER_SONG = 5;

// Compact on-disk shape: the meta plus the composition as a share code, so a take
// costs little more than its note list zlib-compressed.
export type StoredTake = {
    id: string;
    createdAt: number;
    letter: string;
    complete: boolean;
    // The grade is small (a handful of numbers), so it rides along as a plain object
    // rather than through the note codec; null when the run was never graded.
    metrics: Grade | null;
    code: string;
};

// One cleared step of a run: the pitches sounded together (a chord shares one
// onset), the onset relative to the run's first note, and the velocity they were
// struck at. This is what the play surface captures per matched step. heldMs is the
// real key-hold length when a MIDI piano reported the release, so the take can replay
// the actual articulation; it's absent for input that reports no meaningful hold.
export type RunStep = {
    pitches: number[];
    startMs: number;
    velocity: number;
    heldMs?: number;
};

// The shortest note a derived duration may take, so a near-simultaneous pair still
// renders and exports as a real note rather than collapsing to nothing.
const MIN_DURATION_MS = 60;

// The keys still held during a run, each mapped to the run note it belongs to and when
// it was struck, so a release can measure how long it was held. A pitch appears at most
// once — a key can only be held once at a time.
export type ActiveHolds = Map<number, { index: number; onMs: number }>;

// Record a struck pitch as held by the run note at `index`. A repeat of the same pitch
// replaces its earlier hold rather than stacking.
export function beginHold(holds: ActiveHolds, pitch: number, index: number, onMs: number): void {
    holds.set(pitch, { index, onMs });
}

// Resolve a released pitch to the run note it belongs to and how long it was held, or
// null when the pitch wasn't tracked (a stray release, or input we don't measure). The
// caller applies the length, keeping the longest across a chord's separate releases.
export function endHold(
    holds: ActiveHolds,
    pitch: number,
    offMs: number,
): { index: number; heldMs: number } | null {
    const hold = holds.get(pitch);
    if (!hold) {
        return null;
    }
    holds.delete(pitch);
    return { index: hold.index, heldMs: offMs - hold.onMs };
}

// Reconstruct a Composition from a run's cleared steps. Each pitch in a step becomes a
// note at that step's onset. Its length is the real key-hold when a MIDI piano captured
// one (so the take replays your actual articulation — a clipped staccato or a note held
// long), and otherwise the gap to the next onset, so notes from imprecise input still
// connect on the staff and in exports. The final step, with no successor to measure
// against, falls back to a beat.
export function compositionFromRun(
    steps: RunStep[],
    tempo: number,
    beatsPerBar: number,
): Composition {
    const beatMs = 60_000 / tempo;
    const notes: RecordedNote[] = [];
    steps.forEach((step, index) => {
        const next = steps[index + 1];
        const gapMs = next ? next.startMs - step.startMs : beatMs;
        const durationMs = Math.max(MIN_DURATION_MS, step.heldMs ?? gapMs);
        for (const pitch of step.pitches) {
            notes.push({ pitch, startMs: step.startMs, durationMs, velocity: step.velocity });
        }
    });
    return { notes, tempo, beatsPerBar };
}

// Decode one stored entry, or null for anything unreadable — a corrupt take is
// skipped rather than failing the whole list.
export function takeFromStored(entry: unknown): Take | null {
    const value = entry as Partial<StoredTake> | null;
    if (!value || typeof value.id !== "string" || typeof value.code !== "string") {
        return null;
    }
    const composition = decodeComposition(value.code);
    if (!composition) {
        return null;
    }
    return {
        id: value.id,
        createdAt: typeof value.createdAt === "number" ? value.createdAt : 0,
        letter: typeof value.letter === "string" ? value.letter : "",
        complete: value.complete === true,
        // Older takes predate stored metrics, and the value is untrusted, so an
        // absent or malformed grade simply reads as null rather than failing the load.
        metrics: parseGrade(value.metrics),
        composition,
    };
}

export function takeToStored(take: Take): StoredTake {
    return {
        id: take.id,
        createdAt: take.createdAt,
        letter: take.letter,
        complete: take.complete,
        metrics: take.metrics,
        code: encodeComposition(take.composition),
    };
}

// A take's note onsets normalised to start at zero — the ghost a friend races when
// they open its share link, and the shape fastestTakeOnsets returns for your own race.
export function ghostOnsets(take: Take): number[] {
    const notes = take.composition.notes;
    if (notes.length === 0) {
        return [];
    }
    const origin = notes[0]!.startMs;
    return notes.map((note) => note.startMs - origin);
}

// The onsets of the fastest complete take — the ghost to race — or null when there's
// no complete take. "Fastest" is the shortest span from first note to last, so the
// quickest clean run sets the pace.
export function fastestTakeOnsets(takes: Take[]): number[] | null {
    const span = (take: Take): number => {
        const notes = take.composition.notes;
        if (notes.length === 0) {
            return Number.POSITIVE_INFINITY;
        }
        return notes[notes.length - 1]!.startMs - notes[0]!.startMs;
    };
    const complete = takes.filter((take) => take.complete && take.composition.notes.length > 0);
    if (complete.length === 0) {
        return null;
    }
    return ghostOnsets(complete.reduce((best, take) => (span(take) < span(best) ? take : best)));
}
