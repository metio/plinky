// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { median } from "./stats";

// Which notes you are slow to find.
//
// Every run already records when each note was played; nothing has ever added that
// up per note. A player who reads the top of the treble staff fluently and stalls
// on every ledger line below middle C has no way to discover it — the grade folds
// both into one number, and the feeling of "I'm bad at low notes" stays a hunch.
//
// The measure is the gap between one note landing and the next: in self-paced
// practice that gap IS the reading time for the note that follows it.

export type NoteStat = {
    // How many times this note has been read.
    plays: number;
    // Wrong keys pressed before finding it.
    wrongs: number;
    // Total reading time across those plays, for the mean.
    totalMs: number;
    // How many of the plays carried a measurable gap — the mean is over these alone. A
    // run's first note has no gap before it, and averaging its nothing in with the rest
    // read every piece-opening note as quick to find.
    timed: number;
};

// Keyed by MIDI note. Kept per note rather than per pitch class on purpose: reading
// difficulty lives in where a note sits on the staff, so the C below the staff and
// the C above it are different problems and averaging them together would hide the
// very thing this is for.
export type NoteStats = Record<string, NoteStat>;

// What one cleared note contributes: which pitches sounded, when it landed, and how
// many wrong keys preceded it.
export type StatNote = {
    pitches: number[];
    playedMs: number;
    wrongBefore: number;
};

// A gap longer than this is not reading time — it is a phone call, a cup of tea, or
// a run left open. Counting it would let one interruption swamp a note's average
// for good, and the number is meant to be something a player can act on.
export const MAX_READ_MS = 10_000;

const EMPTY: NoteStat = { plays: 0, wrongs: 0, totalMs: 0, timed: 0 };

// Fold a run's notes into the running totals. The first note of a run has no gap
// before it — nothing says when the player started reading — so it contributes its
// wrong keys but no time.
export function foldRun(stats: NoteStats, notes: StatNote[]): NoteStats {
    const next: NoteStats = { ...stats };
    notes.forEach((note, index) => {
        const previous = notes[index - 1];
        const gap = previous ? note.playedMs - previous.playedMs : null;
        const countable = gap !== null && gap >= 0 && gap <= MAX_READ_MS;
        for (const pitch of note.pitches) {
            const key = String(pitch);
            const current = next[key] ?? EMPTY;
            next[key] = {
                plays: current.plays + 1,
                wrongs: current.wrongs + Math.max(0, note.wrongBefore),
                totalMs: current.totalMs + (countable ? gap : 0),
                timed: current.timed + (countable ? 1 : 0),
            };
        }
    });
    return next;
}

// How long this note takes to find, or null when it has never been read with a
// measurable gap — an average over nothing is a number that lies.
export function meanMs(stat: NoteStat): number | null {
    return stat.timed > 0 && stat.totalMs > 0 ? Math.round(stat.totalMs / stat.timed) : null;
}

export type SlowNote = { note: number; meanMs: number; plays: number; wrongs: number };

// The notes worth practising, slowest first. `minPlays` keeps a note read twice from
// outranking one read fifty times: an average over a handful of readings is noise,
// and pointing a player at noise wastes the practice it prompts.
export function slowestNotes(stats: NoteStats, minPlays = 3, limit = 5): SlowNote[] {
    const rows: SlowNote[] = [];
    for (const [key, stat] of Object.entries(stats)) {
        const mean = meanMs(stat);
        const note = Number(key);
        if (mean === null || stat.plays < minPlays || !Number.isFinite(note)) {
            continue;
        }
        rows.push({ note, meanMs: mean, plays: stat.plays, wrongs: stat.wrongs });
    }
    return rows.sort((a, b) => b.meanMs - a.meanMs || a.note - b.note).slice(0, limit);
}

// The typical reading time across every note with enough readings — the line a slow
// note is slow against. Null when nothing qualifies yet.
export function typicalMs(stats: NoteStats, minPlays = 3): number | null {
    const means = Object.values(stats)
        .filter((stat) => stat.plays >= minPlays)
        .map(meanMs)
        .filter((mean): mean is number => mean !== null);
    if (means.length === 0) {
        return null;
    }
    // A median, not a mean: one note left mid-run should not drag the baseline it is
    // being compared against.
    return Math.round(median(means));
}

// Coerce stored (possibly corrupt or older) data into usable stats, dropping
// anything that could not have come from a run.
export function normalizeNoteStats(raw: unknown): NoteStats {
    if (!raw || typeof raw !== "object") {
        return {};
    }
    const out: NoteStats = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const note = Number(key);
        if (
            !Number.isInteger(note) ||
            note < 0 ||
            note > 127 ||
            !value ||
            typeof value !== "object"
        ) {
            continue;
        }
        const stat = value as Record<string, unknown>;
        const num = (field: unknown) =>
            typeof field === "number" && Number.isFinite(field) && field >= 0 ? field : 0;
        const plays = num(stat.plays);
        if (plays === 0) {
            continue;
        }
        // Stats written before the timed count existed carry none: every play is taken as
        // timed, which is what the mean used to assume.
        const timed = stat.timed === undefined ? plays : Math.min(plays, num(stat.timed));
        out[key] = { plays, wrongs: num(stat.wrongs), totalMs: num(stat.totalMs), timed };
    }
    return out;
}
