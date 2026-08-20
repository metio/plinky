// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Articulation } from "../../core/expression";
import type { DynamicPoint } from "../../core/dynamics";
import type { PedalSpan } from "../../core/pedal";
import type { OrnamentKind } from "../../core/ornament";
import type { SlurSpan } from "../../core/slur";
import { GRAND_STAFF, partsOf, type ScoreParts } from "../../core/parts";

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
    fermata: 10,
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
    // The note is held beyond its written length at the performer's discretion. The
    // score says to wait, not how long, so a fixed stretch stands in for the judgement
    // a performer makes.
    fermata: boolean;
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
        fermata: codes.has(ART.fermata),
    };
}

type GraceShape = {
    IsGraceNote?: boolean;
    ParentVoiceEntry?: unknown;
};

// Whether a note is an ornament rather than the note it decorates.
export function isGraceNote(note: unknown): boolean {
    return (note as GraceShape | null)?.IsGraceNote === true;
}

// The notes at one cursor position, split into the order they are actually played: each
// ornament on its own, in written order, then everything that falls on the beat.
//
// The engraver gives a grace note and its principal one position, so a walk that takes a
// position as a chord asks for both keys at once — which is precisely what the score
// says not to do. Grouping by voice entry keeps a grace CHORD together (its notes are
// struck as one) while separating one ornament from the next.
//
// Shared by every walker over the score — the matcher, the note colouring, Listen and the
// play-along — because they index into each other's results. Two walkers splitting a
// position differently would slide every later ghost marker, trail note and highway
// block onto the wrong note.
export function playOrder<T>(items: readonly T[], noteOf: (item: T) => unknown): T[][] {
    const groups: T[][] = [];
    const onBeat: T[] = [];
    let graceEntry: unknown;
    for (const item of items) {
        const note = noteOf(item);
        if (!isGraceNote(note)) {
            onBeat.push(item);
            continue;
        }
        const entry = (note as GraceShape).ParentVoiceEntry;
        if (groups.length === 0 || entry !== graceEntry) {
            groups.push([]);
            graceEntry = entry;
        }
        (groups[groups.length - 1] as T[]).push(item);
    }
    // The on-beat notes are a group even when there are none: a position of nothing but
    // ornaments still ends at the beat, and an empty tail keeps every walker agreeing on
    // how many steps a position is worth.
    groups.push(onBeat);
    return groups;
}

// Where the score asks for the sustain pedal, as whole-note spans. A pedal the engraving
// never lifts runs to the end of the piece, which is what a reader would do with it.
// OSMD's ornament enum, as numbers because the bundle is minified and the enum object it
// came from is not exported in a form worth importing. Confirmed against a live engraving
// by the browser test beside this file — the values are the whole contract.
const ORNAMENT: Record<number, OrnamentKind> = {
    0: "trill",
    1: "turn",
    2: "inverted-turn",
    // A delayed turn is a turn that waits; the wait is a nuance this does not model, and
    // playing it as a turn is much closer than not playing it at all.
    3: "turn",
    4: "inverted-turn",
    5: "mordent",
    6: "inverted-mordent",
};

// Which little sign, if any, is written over a note.
export function readOrnament(note: unknown): OrnamentKind | null {
    const container = (note as OrnamentNoteShape | null)?.ParentVoiceEntry?.OrnamentContainer;
    const code = container?.ornament;
    return typeof code === "number" ? (ORNAMENT[code] ?? null) : null;
}

type OrnamentNoteShape = {
    ParentVoiceEntry?: { OrnamentContainer?: { ornament?: unknown } | null };
};

// The key signature the score opens in, as its count of sharps (positive) or flats
// (negative). Zero when the engraving says nothing, which is also what C major says.
//
// Ornaments need it: a trill reaches for the next note OF THE KEY, so the same sign over
// the same note means different pitches in different keys. A fixed interval would put a
// wrong note inside every ornament the catalogue contains.
//
// The instruction is found by the shape of its data rather than by its class name — the
// bundled OSMD is minified, so every class here is called something like `l` or `o`, and
// matching on that would break on their next release with no test able to say why.
export function readKeyFifths(osmd: unknown): number {
    try {
        const measures =
            (osmd as { sheet?: { SourceMeasures?: KeyMeasureShape[] } } | null)?.sheet
                ?.SourceMeasures ?? [];
        for (const measure of measures) {
            for (const entry of measure?.firstInstructionsStaffEntries ?? []) {
                for (const instruction of entry?.instructions ?? []) {
                    const key = instruction?.Key;
                    if (typeof key === "number" && Number.isFinite(key)) {
                        return key;
                    }
                }
            }
        }
    } catch {
        // An engraving whose shape moved reads as C major rather than breaking playback:
        // every ornament then reaches for the white keys, which is wrong in a way somebody
        // can hear — but a thrown error would stop the piece sounding at all.
        return 0;
    }
    return 0;
}

type KeyMeasureShape = {
    firstInstructionsStaffEntries?: ({ instructions?: ({ Key?: unknown } | null)[] } | null)[];
};

// The arches the score draws, as whole-note spans.
//
// It has to be a walk. OSMD hangs a slur on the two notes at its ends and on nothing in
// between, so a note in the middle of a four-note arch reports no slur of its own — and
// reading each note in isolation joins only the opening pair and leaves the rest of the
// phrase detached. Walking once and holding the arch open between its ends is what turns
// two marks back into the span the engraver drew.
export function readSlurSpans(osmd: unknown): SlurSpan[] {
    const spans: SlurSpan[] = [];
    try {
        const cursor = (osmd as { cursor?: CursorShape } | null)?.cursor;
        if (!cursor) {
            return [];
        }
        cursor.reset();
        // Keyed by the slur object OSMD hands back, so two arches open at once — one per
        // hand, or nested phrasing — do not close each other.
        const open = new Map<unknown, number>();
        while (!cursor.iterator?.EndReached) {
            const whole = cursor.iterator?.currentTimeStamp?.RealValue ?? 0;
            for (const note of cursor.NotesUnderCursor() ?? []) {
                for (const slur of (note as SlurNoteShape)?.NoteSlurs ?? []) {
                    if (!slur) {
                        continue;
                    }
                    if (slur.StartNote === note && !open.has(slur)) {
                        open.set(slur, whole);
                    }
                    if (slur.EndNote === note) {
                        const from = open.get(slur);
                        if (from !== undefined) {
                            spans.push({ from, to: whole });
                            open.delete(slur);
                        }
                    }
                }
            }
            cursor.next();
        }
        // An arch the engraving opens and never closes joins to the end of what it opened
        // over, rather than being dropped — a dropped one plays as no slur at all, which is
        // the failure this whole reader exists to stop being silent.
        const last = cursor.iterator?.currentTimeStamp?.RealValue ?? 0;
        for (const from of open.values()) {
            spans.push({ from, to: Math.max(from, last) });
        }
        cursor.reset();
    } catch {
        // A shape OSMD changed falls back to an unslurred score rather than breaking
        // playback: no slurs is what every score without arches already reports.
        return [];
    }
    return spans;
}

type SlurNoteShape = { NoteSlurs?: ({ StartNote?: unknown; EndNote?: unknown } | null)[] };

type CursorShape = {
    reset: () => void;
    next: () => void;
    iterator?: { EndReached?: boolean; currentTimeStamp?: { RealValue?: number } };
    NotesUnderCursor: () => unknown[];
};

export function readPedalSpans(osmd: unknown): PedalSpan[] {
    const spans: PedalSpan[] = [];
    try {
        const measures =
            (osmd as { sheet?: { SourceMeasures?: SourceMeasureShape[] } } | null)?.sheet
                ?.SourceMeasures ?? [];
        // Where the music stops, for a pedal the engraving never lifts.
        let end = 0;
        let open: number | null = null;
        for (const measure of measures) {
            const measureStart = measure?.AbsoluteTimestamp?.RealValue ?? 0;
            end = Math.max(end, measureStart + (measure?.Duration?.RealValue ?? 0));
            for (const staff of measure?.staffLinkedExpressions ?? []) {
                for (const entry of staff ?? []) {
                    const at = measureStart + (entry?.timestamp?.RealValue ?? 0);
                    end = Math.max(end, at);
                    // A second start without a lift between them is a re-pedal on the
                    // spot: the sound carries on either way, so the span simply runs on.
                    if (entry?.PedalStart != null && open === null) {
                        open = at;
                    } else if (entry?.PedalEnd != null && open !== null) {
                        spans.push({ from: open, to: at });
                        open = null;
                    }
                }
            }
        }
        if (open !== null) {
            spans.push({ from: open, to: Math.max(open, end) });
        }
    } catch {
        // A shape OSMD changed falls back to an unpedalled score rather than breaking
        // playback: no pedal is what every score without markings already reports.
        return [];
    }
    return spans;
}

type MeasureShape = { CurrentMeasure?: { TempoInBPM?: number } };

// The tempo in force at the cursor, in beats per minute, or null where the score marks
// none. OSMD resolves it per measure and carries the last mark forward, so a piece that
// changes tempo reports the new one from the measure the mark sits in. Sub-measure
// resolution is not available: a mark placed mid-bar takes effect at the barline.
export function readTempo(iterator: unknown): number | null {
    const bpm = (iterator as MeasureShape | null)?.CurrentMeasure?.TempoInBPM;
    return typeof bpm === "number" && bpm > 0 ? bpm : null;
}

// The tempo the score opens at, which the practice dial is read against: setting the
// dial to 80 asks for the opening at 80, and every later mark keeps its ratio to it.
export function readStartTempo(osmd: unknown): number | null {
    const sheet = (osmd as { sheet?: { DefaultStartTempoInBpm?: number } } | null)?.sheet;
    const bpm = sheet?.DefaultStartTempoInBpm;
    return typeof bpm === "number" && bpm > 0 ? bpm : null;
}

// Where OSMD keeps the dynamics it parsed: on the measure, not on the cursor.
//
// The iterator advertises an ActiveDynamicExpressions array, one slot per staff, and it
// is the obvious place to look — but through the cursor it is never filled. Reading the
// loudness there returns null on every position of every score, which is silent: the
// expressive reading has nothing to measure and says so, and playback sounds every note
// at one volume. So the marks are gathered off the source measures instead, where they
// certainly are, and turned into a timeline the printed position is looked up in.
type DynamicShape = { MidiVolume?: number };
// A continuous dynamic starting here — a hairpin, or a written "cresc." — which is what
// makes the mark a ramp toward the next one. Its presence is the whole signal; the
// object's own start and end volumes are not read, because the marks either side of it
// are what the score actually asks for.
type ContinuousShape = object;
type MultiExpressionShape = {
    timestamp?: { RealValue?: number };
    instantaneousDynamic?: DynamicShape | null;
    startingContinuousDynamic?: ContinuousShape | null;
    // The sustain pedal going down and coming up, which OSMD hangs on the same measure
    // expressions as the dynamics.
    PedalStart?: unknown;
    PedalEnd?: unknown;
};
type SourceMeasureShape = {
    AbsoluteTimestamp?: { RealValue?: number };
    Duration?: { RealValue?: number };
    staffLinkedExpressions?: (MultiExpressionShape[] | undefined)[];
};

// Every dynamic the score writes, in printed order, as whole-note positions with the
// loudness they ask for. A hairpin starting at a mark makes it a ramp toward the next.
//
// Read across all staves together: a piano score marks its dynamic once, under whichever
// staff the engraver chose, and means it for both hands.
export function readDynamics(osmd: unknown): DynamicPoint[] {
    const points: DynamicPoint[] = [];
    try {
        const measures =
            (osmd as { sheet?: { SourceMeasures?: SourceMeasureShape[] } } | null)?.sheet
                ?.SourceMeasures ?? [];
        for (const measure of measures) {
            const measureStart = measure?.AbsoluteTimestamp?.RealValue ?? 0;
            for (const staff of measure?.staffLinkedExpressions ?? []) {
                for (const entry of staff ?? []) {
                    const volume = entry?.instantaneousDynamic?.MidiVolume;
                    if (typeof volume !== "number" || !Number.isFinite(volume)) {
                        continue;
                    }
                    points.push({
                        whole: measureStart + (entry.timestamp?.RealValue ?? 0),
                        volume,
                        ramp: entry.startingContinuousDynamic != null,
                    });
                }
            }
        }
    } catch {
        // A shape OSMD changed falls back to an unmarked score rather than breaking
        // playback: no dynamics is what every score without them already reports.
        return [];
    }
    return points.sort((a, b) => a.whole - b.whole);
}

// How the engraved sheet lays its instruments out, as staff counts in score order —
// what partsOf needs to work out which staves are the piano.
//
// Read defensively like everything else here: this is OSMD's internal model, and a
// score it could not resolve gives a plain grand staff, which is what every
// single-instrument piece is anyway.
type SheetShape = { Instruments?: { Staves?: unknown[] }[] };

export function readParts(osmd: unknown): ScoreParts {
    try {
        const sheet = (osmd as { sheet?: SheetShape } | null)?.sheet;
        const counts = (sheet?.Instruments ?? []).map(
            (instrument) => instrument?.Staves?.length ?? 0,
        );
        return counts.length > 0 ? partsOf(counts) : GRAND_STAFF;
    } catch {
        return GRAND_STAFF;
    }
}
