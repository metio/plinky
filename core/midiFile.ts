// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Writes a Standard MIDI File (format 0) from a piece's notes, so a score can be
// carried into a DAW or another instrument. The note list is whatever the player
// hears on Listen — pitches and durations in quarter notes — so the export matches
// the playback, transposition and all.

export type MidiNote = {
    midi: number;
    // Onset and length in quarter notes, the unit OSMD reports durations in.
    startQuarters: number;
    durationQuarters: number;
    velocity?: number;
};

const DEFAULT_VELOCITY = 80;

// A MIDI variable-length quantity: 7 bits per byte, high bit set on every byte but
// the last. Delta times and meta-event lengths are both encoded this way.
function varLen(value: number): number[] {
    let remaining = Math.max(0, Math.round(value));
    const sevenBitGroups = [remaining & 0x7f];
    remaining = Math.floor(remaining / 128);
    while (remaining > 0) {
        sevenBitGroups.push((remaining & 0x7f) | 0x80);
        remaining = Math.floor(remaining / 128);
    }
    return sevenBitGroups.reverse();
}

type Event = { tick: number; bytes: number[]; order: number };

export function buildMidiFile(
    notes: MidiNote[],
    options: { tempo?: number; ppq?: number; beatsPerBar?: number } = {},
): Uint8Array<ArrayBuffer> {
    const ppq = options.ppq ?? 480;
    const tempo = options.tempo && options.tempo > 0 ? options.tempo : 100;
    const microsecondsPerQuarter = Math.round(60_000_000 / tempo);
    // A quarter-note beat (denominator power 2) keeps the meter round-trippable:
    // parseMidiFile recovers beatsPerBar from the numerator directly.
    const beatsPerBar = Math.max(1, Math.min(255, Math.round(options.beatsPerBar ?? 4)));

    // Note-off before note-on at the same tick (order 0 vs 1) so a repeated pitch is
    // released before it sounds again rather than being cut short.
    const events: Event[] = [];
    for (const note of notes) {
        const velocity = Math.max(1, Math.min(127, Math.round(note.velocity ?? DEFAULT_VELOCITY)));
        const key = Math.max(0, Math.min(127, Math.round(note.midi)));
        const onTick = Math.round(note.startQuarters * ppq);
        // Every note sounds at least one tick. A note whose duration rounds to zero
        // would otherwise share its on and off tick, and since note-off sorts before
        // note-on there, its own off would precede its on and leave it hanging to the
        // end of the track.
        const offTick = Math.max(
            onTick + 1,
            Math.round((note.startQuarters + note.durationQuarters) * ppq),
        );
        events.push({ tick: onTick, order: 1, bytes: [0x90, key, velocity] });
        events.push({ tick: offTick, order: 0, bytes: [0x80, key, 0] });
    }
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);

    const track: number[] = [];
    // Tempo meta event at the start of the track.
    track.push(
        ...varLen(0),
        0xff,
        0x51,
        0x03,
        (microsecondsPerQuarter >> 16) & 0xff,
        (microsecondsPerQuarter >> 8) & 0xff,
        microsecondsPerQuarter & 0xff,
    );
    // Time-signature meta event: numerator, denominator as a power of two (2 → quarter
    // note), MIDI clocks per metronome click, 32nd notes per quarter.
    track.push(...varLen(0), 0xff, 0x58, 0x04, beatsPerBar, 0x02, 0x18, 0x08);
    let lastTick = 0;
    for (const event of events) {
        track.push(...varLen(event.tick - lastTick), ...event.bytes);
        lastTick = event.tick;
    }
    // End-of-track meta event.
    track.push(...varLen(0), 0xff, 0x2f, 0x00);

    const header = [
        0x4d,
        0x54,
        0x68,
        0x64, // "MThd"
        0x00,
        0x00,
        0x00,
        0x06, // header length
        0x00,
        0x00, // format 0
        0x00,
        0x01, // one track
        (ppq >> 8) & 0xff,
        ppq & 0xff,
    ];
    const trackHeader = [
        0x4d,
        0x54,
        0x72,
        0x6b, // "MTrk"
        (track.length >> 24) & 0xff,
        (track.length >> 16) & 0xff,
        (track.length >> 8) & 0xff,
        track.length & 0xff,
    ];

    return Uint8Array.from([...header, ...trackHeader, ...track]);
}
