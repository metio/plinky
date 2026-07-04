// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Composition, RecordedNote } from "./composition";

// Reads a Standard MIDI File back into a composition, the inverse of midiFile.ts, so
// a take exported on one device can be carried to another and kept growing. It reads
// what any DAW or keyboard writes — formats 0 and 1 — pairing each note-on with its
// note-off and folding all tracks onto one timeline in milliseconds.

const DEFAULT_TEMPO = 120;
const DEFAULT_BEATS_PER_BAR = 4;

// A cursor over the byte buffer that reads the integer encodings a MIDI file uses.
class Reader {
    pos = 0;
    constructor(private readonly bytes: Uint8Array) {}

    get done(): boolean {
        return this.pos >= this.bytes.length;
    }

    u8(): number {
        return this.bytes[this.pos++]!;
    }

    u16(): number {
        return (this.u8() << 8) | this.u8();
    }

    u32(): number {
        return (this.u8() << 24) | (this.u16() << 8) | this.u8();
    }

    bytesOf(length: number): Uint8Array {
        const slice = this.bytes.subarray(this.pos, this.pos + length);
        this.pos += length;
        return slice;
    }

    // A variable-length quantity: 7 bits per byte, high bit set on all but the last.
    varLen(): number {
        let value = 0;
        for (;;) {
            const byte = this.u8();
            value = (value << 7) | (byte & 0x7f);
            if ((byte & 0x80) === 0) {
                return value;
            }
        }
    }
}

type Pending = { startTicks: number; velocity: number };

// Parses MIDI bytes into a composition, or null if the file is not a MIDI file we can
// read. Timing comes from the first tempo and time signature found; subsequent tempo
// changes are ignored, so a constant-tempo take (what compose writes) is exact.
export function parseMidiFile(bytes: Uint8Array): Composition | null {
    try {
        const reader = new Reader(bytes);
        // "MThd" header chunk.
        if (reader.u32() !== 0x4d546864) {
            return null;
        }
        reader.u32(); // header length, always 6
        reader.u16(); // format
        const trackCount = reader.u16();
        const division = reader.u16();
        // SMPTE timing (high bit set) is not something compose emits; bail rather than
        // misread it as ticks-per-quarter.
        if (division <= 0 || division & 0x8000) {
            return null;
        }
        const ticksPerQuarter = division;

        let microsecondsPerQuarter = 60_000_000 / DEFAULT_TEMPO;
        let beatsPerBar = DEFAULT_BEATS_PER_BAR;
        let tempoSeen = false;
        let timeSignatureSeen = false;
        const notes: {
            midi: number;
            startTicks: number;
            durationTicks: number;
            velocity: number;
        }[] = [];

        for (let track = 0; track < trackCount && !reader.done; track++) {
            if (reader.u32() !== 0x4d54726b) {
                return null;
            }
            const length = reader.u32();
            const end = reader.pos + length;
            let tick = 0;
            let runningStatus = 0;
            // Note-ons waiting for their matching note-off, keyed by channel and pitch.
            const open = new Map<number, Pending[]>();

            while (reader.pos < end) {
                tick += reader.varLen();
                let status = reader.u8();
                if (status < 0x80) {
                    // Running status: this byte is the first data byte, status repeats.
                    reader.pos--;
                    status = runningStatus;
                } else {
                    runningStatus = status;
                }
                const type = status & 0xf0;
                const channel = status & 0x0f;

                if (status === 0xff) {
                    const metaType = reader.u8();
                    const metaLength = reader.varLen();
                    const data = reader.bytesOf(metaLength);
                    if (metaType === 0x51 && metaLength === 3 && !tempoSeen) {
                        microsecondsPerQuarter = (data[0]! << 16) | (data[1]! << 8) | data[2]!;
                        tempoSeen = true;
                    } else if (metaType === 0x58 && metaLength >= 2 && !timeSignatureSeen) {
                        // Numerator, then a power-of-two denominator; a quarter-note beat
                        // means scaling the count to quarters.
                        beatsPerBar = Math.max(1, Math.round((data[0]! * 4) / 2 ** data[1]!));
                        timeSignatureSeen = true;
                    }
                    continue;
                }
                if (status === 0xf0 || status === 0xf7) {
                    reader.bytesOf(reader.varLen()); // sysex, skipped
                    continue;
                }

                if (type === 0x90 || type === 0x80) {
                    const note = reader.u8();
                    const velocity = reader.u8();
                    const key = channel * 128 + note;
                    if (type === 0x90 && velocity > 0) {
                        const stack = open.get(key) ?? [];
                        stack.push({ startTicks: tick, velocity });
                        open.set(key, stack);
                    } else {
                        // Note-off, or a note-on with zero velocity used as one.
                        const started = open.get(key)?.shift();
                        if (started) {
                            notes.push({
                                midi: note,
                                startTicks: started.startTicks,
                                durationTicks: Math.max(1, tick - started.startTicks),
                                velocity: started.velocity,
                            });
                        }
                    }
                } else if (type === 0xc0 || type === 0xd0) {
                    reader.u8(); // one data byte
                } else {
                    reader.u8();
                    reader.u8(); // two data bytes
                }
            }
            reader.pos = end;
        }

        if (notes.length === 0) {
            return null;
        }

        const tempo = 60_000_000 / microsecondsPerQuarter;
        const msPerTick = microsecondsPerQuarter / 1000 / ticksPerQuarter;
        notes.sort((a, b) => a.startTicks - b.startTicks);
        const origin = notes[0]!.startTicks;
        const recorded: RecordedNote[] = notes.map((note) => ({
            pitch: note.midi,
            startMs: (note.startTicks - origin) * msPerTick,
            durationMs: note.durationTicks * msPerTick,
            velocity: note.velocity,
        }));
        return { notes: recorded, tempo, beatsPerBar };
    } catch {
        return null;
    }
}
