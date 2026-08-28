// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Moving a note that fell off the keyboard back onto it, and the .mxl codec that needs.
//
// Shared because it has to run in two places. The standalone `songs:repair` fixes what is
// already in the catalogue; the importer applies the same transform on the way in, which
// is what stops a re-import quietly reintroducing every note it had fixed. A repair that
// lives only in a script that edits files in place is undone by the next import, and
// nothing records that it ever happened.

import { deflateRawSync, inflateRawSync } from "node:zlib";
import { onThePiano, ontoThePiano } from "../core/pianoRange.ts";

const STEPS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const _LETTERS = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];

// The one `<pitch>` shape, matched whole so a rewrite can put the octave back where it was.
const PITCH =
    /<pitch>(\s*<step>)([A-G])(<\/step>\s*)(?:<alter>(-?\d+)<\/alter>(\s*))?(<octave>)(-?\d+)(<\/octave>)/g;

function midiOf(step: string, alter: number, octave: number): number {
    return (octave + 1) * 12 + (STEPS[step] ?? 0) + alter;
}

// Every out-of-range pitch moved into range, and how many moved.
function repaired(xml: string): { xml: string; moved: number } {
    let moved = 0;
    const out = xml.replace(
        PITCH,
        (whole, open, step, close, alterText, afterAlter, octaveOpen, octaveText, octaveClose) => {
            const alter = Number(alterText ?? 0);
            const midi = midiOf(step, alter, Number(octaveText));
            if (onThePiano(midi)) {
                return whole;
            }
            const octaves = Math.round((ontoThePiano(midi) - midi) / 12);
            moved += 1;
            const octave = Number(octaveText) + octaves;
            return `<pitch>${open}${step}${close}${
                alterText === undefined ? "" : `<alter>${alterText}</alter>${afterAlter ?? ""}`
            }${octaveOpen}${octave}${octaveClose}`;
        },
    );
    return { xml: out, moved };
}

// An .mxl is a zip. Only the score entry is rewritten; everything else — the container, any
// meta — is carried across byte for byte, since none of it is about pitch.
type Entry = { name: string; data: Buffer };

// A minimal store/deflate zip reader and writer. The catalogue's .mxl files are produced by
// one pipeline and hold a handful of entries, so this needs to cover exactly the two
// compression methods they use rather than the whole format.
function readZip(buffer: Buffer): Entry[] {
    const entries: Entry[] = [];
    let at = 0;
    while (at + 30 <= buffer.length && buffer.readUInt32LE(at) === 0x04034b50) {
        const method = buffer.readUInt16LE(at + 8);
        const compressed = buffer.readUInt32LE(at + 18);
        const nameLength = buffer.readUInt16LE(at + 26);
        const extraLength = buffer.readUInt16LE(at + 28);
        const name = buffer.subarray(at + 30, at + 30 + nameLength).toString("utf8");
        const start = at + 30 + nameLength + extraLength;
        const raw = buffer.subarray(start, start + compressed);
        entries.push({ name, data: method === 0 ? Buffer.from(raw) : inflateRawSync(raw) });
        at = start + compressed;
    }
    return entries;
}

function writeZip(entries: Entry[]): Buffer {
    const locals: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;
    for (const entry of entries) {
        const name = Buffer.from(entry.name, "utf8");
        const deflated = deflateRawSync(entry.data);
        const crc = crc32(entry.data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(8, 8);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(deflated.length, 18);
        local.writeUInt32LE(entry.data.length, 22);
        local.writeUInt16LE(name.length, 26);
        locals.push(local, name, deflated);

        const head = Buffer.alloc(46);
        head.writeUInt32LE(0x02014b50, 0);
        head.writeUInt16LE(20, 4);
        head.writeUInt16LE(20, 6);
        head.writeUInt16LE(8, 10);
        head.writeUInt32LE(crc, 16);
        head.writeUInt32LE(deflated.length, 20);
        head.writeUInt32LE(entry.data.length, 24);
        head.writeUInt16LE(name.length, 28);
        head.writeUInt32LE(offset, 42);
        central.push(head, name);
        offset += 30 + name.length + deflated.length;
    }
    const directory = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, directory, end]);
}

export { repaired, readZip, writeZip };
export type { Entry };

// Every out-of-range pitch in an .mxl moved into range. The zip is rebuilt only when
// something actually moved, so an untouched file is copied byte for byte.
const TABLE = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
});

function crc32(data: Buffer): number {
    let value = 0xffffffff;
    for (const byte of data) {
        value = (TABLE[(value ^ byte) & 0xff] as number) ^ (value >>> 8);
    }
    return (value ^ 0xffffffff) >>> 0;
}

export function repairMxl(buffer: Buffer): { buffer: Buffer; moved: number } {
    const entries = readZip(buffer);
    let moved = 0;
    for (const entry of entries) {
        if (!/\.(xml|musicxml)$/.test(entry.name) || entry.name.includes("META-INF")) {
            continue;
        }
        const result = repaired(entry.data.toString("utf8"));
        if (result.moved > 0) {
            entry.data = Buffer.from(result.xml, "utf8");
            moved += result.moved;
        }
    }
    return { buffer: moved > 0 ? writeZip(entries) : buffer, moved };
}
