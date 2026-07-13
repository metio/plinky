// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Articulation } from "../../core/expression";

// Reads the expression marks OSMD parsed from the MusicXML — articulations, slurs,
// ties and the dynamic in force — off a note under the cursor, so Listen can play the
// score as written. OSMD exposes these on the public Note/VoiceEntry types, but the
// fields the transport wants sit behind a few shapes; everything here reads by shape
// and swallows a missing field, so a score OSMD parsed oddly falls back to a plain,
// full-length note rather than throwing mid-playback.

// The ArticulationEnum values from opensheetmusicdisplay@2.0.0 (stable in that
// release). Read by number so a runtime enum import isn't required.
const ART = {
    accent: 0,
    strongaccent: 1, // marcato — MusicXML <strong-accent>
    marcatoup: 3,
    marcatodown: 4,
    staccato: 6,
    staccatissimo: 7,
    tenuto: 9,
    detachedlegato: 25,
} as const;

type NoteShape = {
    Length?: { RealValue?: number };
    ParentVoiceEntry?: { Articulations?: { articulationEnum?: number }[] };
    NoteSlurs?: { StartNote?: unknown; EndNote?: unknown }[];
    NoteTie?: { StartNote?: unknown; Notes?: unknown[]; Duration?: { RealValue?: number } } | null;
};

// What a note contributes to playback: whether to strike it (a tie's later notes are
// already sounding), its own written length in quarter notes for the cursor's dwell,
// and the marks that shape the strike — the sounding length in quarters (the whole tie
// for a tie start), which length articulation applies, and the accent/slur flags.
export type ScoreExpression = {
    strike: boolean;
    notatedQuarters: number;
    soundQuarters: number;
    articulation: Articulation;
    accent: boolean;
    marcato: boolean;
    slurred: boolean;
};

function articulationOf(codes: Set<number>): Articulation {
    // Shortest-held wins when several are present, matching how the marks stack.
    if (codes.has(ART.staccatissimo)) {
        return "staccatissimo";
    }
    if (codes.has(ART.staccato)) {
        return "staccato";
    }
    if (codes.has(ART.detachedlegato)) {
        return "detachedLegato";
    }
    if (codes.has(ART.tenuto)) {
        return "tenuto";
    }
    return "none";
}

export function readScoreExpression(note: unknown): ScoreExpression {
    const shape = (note ?? {}) as NoteShape;
    const notatedQuarters = (shape.Length?.RealValue ?? 0) * 4;

    const codes = new Set<number>();
    for (const art of shape.ParentVoiceEntry?.Articulations ?? []) {
        if (typeof art.articulationEnum === "number") {
            codes.add(art.articulationEnum);
        }
    }
    const accent = codes.has(ART.accent);
    const marcato =
        codes.has(ART.strongaccent) || codes.has(ART.marcatoup) || codes.has(ART.marcatodown);

    // A note is slurred-forward when it starts or lies within a slur — any slur whose
    // end note is a different note. The slur's last note doesn't connect onward.
    const slurred = (shape.NoteSlurs ?? []).some((slur) => slur?.EndNote !== note);

    // A tie's first note sounds the whole tie's combined length; its later notes are
    // held, not re-struck. A note with no tie strikes at its own written length.
    const tie = shape.NoteTie ?? null;
    let strike = true;
    let soundQuarters = notatedQuarters;
    if (tie) {
        const isStart = tie.StartNote === note || tie.Notes?.[0] === note;
        if (isStart) {
            soundQuarters = (tie.Duration?.RealValue ?? shape.Length?.RealValue ?? 0) * 4;
        } else {
            strike = false;
        }
    }

    return {
        strike,
        notatedQuarters,
        soundQuarters,
        articulation: articulationOf(codes),
        accent,
        marcato,
        slurred,
    };
}

type ExpressionShape = {
    getInterpolatedDynamic?: (at: unknown) => number;
    MidiVolume?: number;
};

type IteratorShape = {
    ActiveDynamicExpressions?: unknown[];
    CurrentSourceTimestamp?: unknown;
};

// The loudness in force at the cursor as a 0..127 velocity, or null when the score
// marks no dynamic here (the default velocity then stands). A crescendo/diminuendo
// wedge is read at its interpolated value for the current position; otherwise the
// standing instantaneous dynamic's MIDI volume is used.
export function readActiveDynamic(iterator: unknown): number | null {
    try {
        const shape = (iterator ?? {}) as IteratorShape;
        const active = shape.ActiveDynamicExpressions ?? [];
        for (const raw of active) {
            const expr = raw as ExpressionShape;
            if (typeof expr.getInterpolatedDynamic === "function") {
                const value = expr.getInterpolatedDynamic(shape.CurrentSourceTimestamp);
                if (typeof value === "number" && Number.isFinite(value)) {
                    return value;
                }
            }
        }
        for (const raw of active) {
            const expr = raw as ExpressionShape;
            if (typeof expr.MidiVolume === "number" && Number.isFinite(expr.MidiVolume)) {
                return expr.MidiVolume;
            }
        }
    } catch {
        // A shape OSMD changed, or an expression that threw, falls back to no dynamic
        // rather than breaking playback.
    }
    return null;
}
