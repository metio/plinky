// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The one id scheme for every playable piece — catalogue songs, bundled demos, studies,
// generated scale/arpeggio exercises and user uploads alike. It is a content fingerprint:
// the same notes always hash to the same short, opaque id, so a piece keeps its id across
// re-imports, title cleanups, licence re-classification and re-slugging, and identical
// content collapses to one id. It carries no title, composer, source or licence, so none of
// those churns it.
//
// A pure, synchronous, dependency-free hash (no node:crypto) so it runs identically in the
// import scripts, the build config AND the browser — the catalogue's ids are precomputed at
// build, but the browser computes an uploaded file's id to place it and to detect that it
// duplicates a catalogue piece.

import { STEP_SEMITONES } from "./pitch";

// Base62 (digits + letters): URL- and filename-safe, no leading `-`/`_` edge cases.
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 12;

// Every pitched note as "<midi>:<duration>", in document order across all parts. Rests and
// unpitched percussion are ignored; the raw <duration> is used as-is (stable per document,
// no need to resolve <divisions> — the fingerprint needs stability, not musical meaning).
function noteSignature(xml: string): string {
    const notes: string[] = [];
    for (const match of xml.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)) {
        const body = match[1] ?? "";
        const step = body.match(/<step>\s*([A-G])\s*<\/step>/)?.[1];
        const octave = body.match(/<octave>\s*(-?\d+)\s*<\/octave>/)?.[1];
        if (step === undefined || octave === undefined || STEP_SEMITONES[step] === undefined) {
            continue;
        }
        const alter = Number(body.match(/<alter>\s*(-?\d+)\s*<\/alter>/)?.[1] ?? "0");
        const duration = body.match(/<duration>\s*(\d+)\s*<\/duration>/)?.[1] ?? "0";
        const midi = (Number(octave) + 1) * 12 + STEP_SEMITONES[step]! + alter;
        notes.push(`${midi}:${duration}`);
    }
    return notes.join(",");
}

// FNV-1a over 96 bits (three 32-bit lanes seeded differently), folded into a base62 string.
// 96 bits is far past collision across the catalogue; BigInt keeps it exact and portable.
function fingerprint(signature: string): bigint {
    const PRIME = 0x01000193n;
    const MASK = 0xffffffffn;
    let a = 0x811c9dc5n;
    let b = 0x811c9dc5n ^ 0x9e3779b1n;
    let c = 0x811c9dc5n ^ 0x85ebca77n;
    for (let i = 0; i < signature.length; i++) {
        const byte = BigInt(signature.charCodeAt(i) & 0xff);
        a = ((a ^ byte) * PRIME) & MASK;
        b = ((b ^ byte) * PRIME) & MASK;
        c = ((c ^ byte) * PRIME) & MASK;
    }
    return (a << 64n) | (b << 32n) | c;
}

export function songId(xml: string): string {
    let value = fingerprint(noteSignature(xml));
    let id = "";
    for (let i = 0; i < ID_LENGTH; i++) {
        id = ALPHABET[Number(value % 62n)] + id;
        value /= 62n;
    }
    return id;
}
