// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { MidiNote } from "./midiFile";
import { packToCode, unpackFromCode } from "./shareCode";

// A free improvisation captured at the keyboard: the raw notes a player struck,
// timed in milliseconds from the first one. The audio plays back from these exact
// times — the staff that toMusicXml draws is an approximate sketch of the same
// performance, snapped to a grid so it reads as notation at all.

export type RecordedNote = {
    // MIDI pitch number (60 = middle C).
    pitch: number;
    // Onset and held length in milliseconds; startMs is measured from the first note.
    startMs: number;
    durationMs: number;
    velocity: number; // 0..127
};

export type Composition = {
    notes: RecordedNote[];
    tempo: number; // beats per minute, the grid the staff and exports are measured against
    beatsPerBar: number;
};

// The pitch at and above which a note belongs on the treble (right-hand) staff;
// anything lower falls to the bass staff. Middle C is the conventional split.
export const DEFAULT_SPLIT_POINT = 60;

// The staff is drawn on a sixteenth-note grid: four divisions per quarter note lets
// every snapped onset and length be an integer count of grid cells.
const DIVISIONS = 4;

// Snaps every note's onset and length to a subdivision of the beat, so a loosely
// played phrase lands on a clean grid. Lengths never round below a single grid cell,
// so a note can't vanish. The audio path keeps the unquantized notes; this is only
// for a tidier staff and a tidier MIDI export when the player opts in.
export function quantize(
    notes: RecordedNote[],
    tempo: number,
    subdivisionsPerBeat: number,
): RecordedNote[] {
    const beatMs = 60_000 / tempo;
    const gridMs = beatMs / subdivisionsPerBeat;
    return notes.map((note) => ({
        ...note,
        startMs: Math.round(note.startMs / gridMs) * gridMs,
        durationMs: Math.max(gridMs, Math.round(note.durationMs / gridMs) * gridMs),
    }));
}

// Truncates a composition back to its first `count` notes — the safety bar. A
// checkpoint records how many notes had landed; resetting drops everything after it
// so the player keeps the good part and retries the tail.
export function truncateTo(composition: Composition, count: number): Composition {
    return { ...composition, notes: composition.notes.slice(0, Math.max(0, count)) };
}

// The note list in the quarter-note unit the MIDI writer expects, so a composition
// exports to a Standard MIDI File that sounds like the recorded performance.
export function toMidiNotes(composition: Composition): MidiNote[] {
    const beatMs = 60_000 / composition.tempo;
    return composition.notes.map((note) => ({
        midi: note.pitch,
        startQuarters: note.startMs / beatMs,
        durationQuarters: note.durationMs / beatMs,
        velocity: note.velocity,
    }));
}

// --- Share codec ---------------------------------------------------------------

// A composition packed for a URL. The note fields are stored column-wise — onset
// gaps, then lengths, pitches and velocities each in their own run — because zlib
// compresses a run of similar numbers far better than interleaved tuples. Onsets
// ascend, so their inter-note gaps are small and repetitive like a ghost's.
type Packed = [
    tempo: number,
    beatsPerBar: number,
    gaps: number[],
    durations: number[],
    pitches: number[],
    velocities: number[],
];

export function encodeComposition(composition: Composition): string {
    const gaps: number[] = [];
    let previous = 0;
    for (const note of composition.notes) {
        const start = Math.round(note.startMs);
        gaps.push(start - previous);
        previous = start;
    }
    const durations = composition.notes.map((note) => Math.round(note.durationMs));
    const pitches = composition.notes.map((note) => note.pitch);
    const velocities = composition.notes.map((note) => Math.round(note.velocity));
    const packed: Packed = [
        composition.tempo,
        composition.beatsPerBar,
        gaps,
        durations,
        pitches,
        velocities,
    ];
    return packToCode(packed);
}

function isNumberArray(value: unknown): value is number[] {
    return Array.isArray(value) && value.every((n) => typeof n === "number" && Number.isFinite(n));
}

// Parses a shared composition, returning null for anything that isn't the expected
// shape (a tempo, a bar length, and four equal-length numeric columns).
export function decodeComposition(code: string): Composition | null {
    if (!code) {
        return null;
    }
    const unpacked = unpackFromCode(code);
    if (!Array.isArray(unpacked) || unpacked.length !== 6) {
        return null;
    }
    const [tempo, beatsPerBar, gaps, durations, pitches, velocities] = unpacked as unknown[];
    if (typeof tempo !== "number" || typeof beatsPerBar !== "number") {
        return null;
    }
    if (
        !isNumberArray(gaps) ||
        !isNumberArray(durations) ||
        !isNumberArray(pitches) ||
        !isNumberArray(velocities)
    ) {
        return null;
    }
    const count = gaps.length;
    if (durations.length !== count || pitches.length !== count || velocities.length !== count) {
        return null;
    }
    const notes: RecordedNote[] = [];
    let running = 0;
    for (let i = 0; i < count; i++) {
        running += gaps[i]!;
        notes.push({
            startMs: running,
            durationMs: durations[i]!,
            pitch: pitches[i]!,
            velocity: velocities[i]!,
        });
    }
    return { notes, tempo, beatsPerBar };
}

// --- MusicXML sketch -----------------------------------------------------------

// A note's letter, chromatic alteration and octave, spelled with sharps since the
// sketch carries no key signature.
const PITCH_CLASSES: { step: string; alter: number }[] = [
    { step: "C", alter: 0 },
    { step: "C", alter: 1 },
    { step: "D", alter: 0 },
    { step: "D", alter: 1 },
    { step: "E", alter: 0 },
    { step: "F", alter: 0 },
    { step: "F", alter: 1 },
    { step: "G", alter: 0 },
    { step: "G", alter: 1 },
    { step: "A", alter: 0 },
    { step: "A", alter: 1 },
    { step: "B", alter: 0 },
];

function spell(midi: number): { step: string; alter: number; octave: number } {
    const pitchClass = ((midi % 12) + 12) % 12;
    const { step, alter } = PITCH_CLASSES[pitchClass]!;
    return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

// The note values, longest first, that a span of grid cells decomposes into. Each is
// a plain or single-dotted power-of-two duration, enough to notate any cell count by
// greedily taking the largest that fits and tying the remainder.
const DURATIONS: { cells: number; type: string; dots: number }[] = [
    { cells: 16, type: "whole", dots: 0 },
    { cells: 12, type: "half", dots: 1 },
    { cells: 8, type: "half", dots: 0 },
    { cells: 6, type: "quarter", dots: 1 },
    { cells: 4, type: "quarter", dots: 0 },
    { cells: 3, type: "eighth", dots: 1 },
    { cells: 2, type: "eighth", dots: 0 },
    { cells: 1, type: "16th", dots: 0 },
];

function splitDuration(cells: number): { cells: number; type: string; dots: number }[] {
    const pieces: { cells: number; type: string; dots: number }[] = [];
    let remaining = cells;
    while (remaining > 0) {
        const piece = DURATIONS.find((d) => d.cells <= remaining)!;
        pieces.push(piece);
        remaining -= piece.cells;
    }
    return pieces;
}

// A contiguous span on one staff's timeline: either a held pitch or a rest, measured
// in grid cells. Cells tile the whole timeline with no gaps or overlaps.
type Cell = { pitch: number | null; cells: number };

// Collapses one hand's notes into a single-voice timeline. Overlapping or
// simultaneous notes are reduced to one representative pitch per onset (the melody
// on top for the right hand, the bass below for the left), and each note is clipped
// so it never runs into the next onset — the sketch is monophonic per staff by
// design. Gaps between notes become rests, and the line is padded with a final rest
// so every staff spans the same whole number of bars.
function buildCells(
    notes: RecordedNote[],
    gridMs: number,
    totalCells: number,
    pick: (a: number, b: number) => number,
): Cell[] {
    // One representative pitch per grid slot, and the longest length struck there.
    const bySlot = new Map<number, { pitch: number; cells: number }>();
    for (const note of notes) {
        const slot = Math.round(note.startMs / gridMs);
        const length = Math.max(1, Math.round(note.durationMs / gridMs));
        const existing = bySlot.get(slot);
        if (!existing) {
            bySlot.set(slot, { pitch: note.pitch, cells: length });
        } else {
            bySlot.set(slot, {
                pitch: pick(existing.pitch, note.pitch),
                cells: Math.max(existing.cells, length),
            });
        }
    }
    const slots = [...bySlot.keys()].sort((a, b) => a - b);
    const cells: Cell[] = [];
    let cursor = 0;
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]!;
        const next = i + 1 < slots.length ? slots[i + 1]! : totalCells;
        if (slot > cursor) {
            cells.push({ pitch: null, cells: slot - cursor });
            cursor = slot;
        }
        const struck = bySlot.get(slot)!;
        const length = Math.max(1, Math.min(struck.cells, next - slot));
        cells.push({ pitch: struck.pitch, cells: length });
        cursor = slot + length;
    }
    if (cursor < totalCells) {
        cells.push({ pitch: null, cells: totalCells - cursor });
    }
    return cells;
}

// Splits a staff's cells at every barline, so no cell straddles a measure boundary —
// a split note keeps sounding, marked so the two halves render tied.
type BarCell = Cell & { tiedToNext: boolean };

function intoBars(cells: Cell[], cellsPerBar: number): BarCell[][] {
    const bars: BarCell[][] = [];
    let bar: BarCell[] = [];
    let filled = 0;
    for (const cell of cells) {
        let remaining = cell.cells;
        while (remaining > 0) {
            const room = cellsPerBar - filled;
            const take = Math.min(room, remaining);
            const crosses = take < remaining;
            bar.push({
                pitch: cell.pitch,
                cells: take,
                tiedToNext: crosses && cell.pitch !== null,
            });
            filled += take;
            remaining -= take;
            if (filled >= cellsPerBar) {
                bars.push(bar);
                bar = [];
                filled = 0;
            }
        }
    }
    if (bar.length > 0) {
        bars.push(bar);
    }
    return bars;
}

function noteElements(
    cell: BarCell,
    staff: number,
    holdingIn: boolean,
): { xml: string; holdingOut: boolean } {
    const pieces = splitDuration(cell.cells);
    const lines: string[] = [];
    let holding = holdingIn;
    for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i]!;
        const isRest = cell.pitch === null;
        // A pitched piece ties forward when more pieces follow it or the cell carries
        // into the next bar; it ties back whenever the previous piece was holding.
        const tieForward = !isRest && (i < pieces.length - 1 || cell.tiedToNext);
        const tieBack = !isRest && holding;
        const head = isRest
            ? "<rest/>"
            : (() => {
                  const { step, alter, octave } = spell(cell.pitch!);
                  const alterTag = alter === 0 ? "" : `<alter>${alter}</alter>`;
                  return `<pitch><step>${step}</step>${alterTag}<octave>${octave}</octave></pitch>`;
              })();
        const ties =
            (tieBack ? `<tie type="stop"/>` : "") + (tieForward ? `<tie type="start"/>` : "");
        const dots = "<dot/>".repeat(piece.dots);
        const accidental =
            !isRest && spell(cell.pitch!).alter !== 0 ? "<accidental>sharp</accidental>" : "";
        const tiedNotations =
            tieBack || tieForward
                ? `<notations>${tieBack ? `<tied type="stop"/>` : ""}${tieForward ? `<tied type="start"/>` : ""}</notations>`
                : "";
        lines.push(
            `      <note>${head}<duration>${piece.cells}</duration>${ties}<type>${piece.type}</type>${dots}${accidental}<staff>${staff}</staff>${tiedNotations}</note>`,
        );
        holding = tieForward;
    }
    return { xml: lines.join("\n"), holdingOut: holding };
}

function escapeXml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type MusicXmlOptions = {
    title?: string;
    // Snap the staff to this many subdivisions per beat before notating. A higher
    // value keeps more of the played feel; the default sixteenth grid reads cleanly.
    subdivisionsPerBeat?: number;
    // Notes at or above this MIDI pitch go on the treble staff, the rest on the bass.
    splitPoint?: number;
};

// Renders a composition to a two-staff MusicXML sketch. The notes are snapped to the
// grid, split by hand, reduced to one voice per staff and padded with rests so both
// staves span the same whole bars — an approximate engraving of an exact performance.
export function toMusicXml(composition: Composition, options: MusicXmlOptions = {}): string {
    const title = options.title ?? "Improvisation";
    const subdivisions = options.subdivisionsPerBeat ?? DIVISIONS;
    const splitPoint = options.splitPoint ?? DEFAULT_SPLIT_POINT;
    const beatsPerBar = composition.beatsPerBar > 0 ? composition.beatsPerBar : 4;

    const beatMs = 60_000 / composition.tempo;
    // The render grid is always sixteenths; a coarser quantize is applied first so the
    // staff stays clean while the cell math keeps integer durations.
    const gridMs = beatMs / DIVISIONS;
    const cellsPerBar = beatsPerBar * DIVISIONS;

    const snapped = quantize(composition.notes, composition.tempo, subdivisions);
    const ends = snapped.map((note) => note.startMs + note.durationMs);
    const lastEnd = ends.length > 0 ? Math.max(...ends) : 0;
    const usedCells = Math.max(1, Math.ceil(lastEnd / gridMs));
    const totalCells = Math.ceil(usedCells / cellsPerBar) * cellsPerBar;

    const treble = snapped.filter((note) => note.pitch >= splitPoint);
    const bass = snapped.filter((note) => note.pitch < splitPoint);
    const trebleBars = intoBars(buildCells(treble, gridMs, totalCells, Math.max), cellsPerBar);
    const bassBars = intoBars(buildCells(bass, gridMs, totalCells, Math.min), cellsPerBar);

    const attributes = `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>0</fifths></key><time><beats>${beatsPerBar}</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;

    const measures: string[] = [];
    const barCount = Math.max(trebleBars.length, bassBars.length, 1);
    // A tie carries across the barline, so the holding state lives outside the bar loop.
    let trebleHolding = false;
    let bassHolding = false;
    for (let i = 0; i < barCount; i++) {
        const number = i + 1;
        const head = number === 1 ? `      ${attributes}\n` : "";
        const trebleXml = (
            trebleBars[i] ?? [{ pitch: null, cells: cellsPerBar, tiedToNext: false }]
        )
            .map((cell) => {
                const { xml, holdingOut } = noteElements(cell, 1, trebleHolding);
                trebleHolding = holdingOut;
                return xml;
            })
            .join("\n");
        const bassXml = (bassBars[i] ?? [{ pitch: null, cells: cellsPerBar, tiedToNext: false }])
            .map((cell) => {
                const { xml, holdingOut } = noteElements(cell, 2, bassHolding);
                bassHolding = holdingOut;
                return xml;
            })
            .join("\n");
        const body = `${head}${trebleXml}\n      <backup><duration>${cellsPerBar}</duration></backup>\n${bassXml}`;
        measures.push(`    <measure number="${number}">\n${body}\n    </measure>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>${escapeXml(title)}</work-title></work>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
${measures.join("\n")}
  </part>
</score-partwise>
`;
}
