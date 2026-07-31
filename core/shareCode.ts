// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { strFromU8, strToU8, unzlibSync, zlibSync } from "fflate";

// One codec for every "pack some JSON into a shareable URL token" need — the ghost
// race link and the teacher-assignment link both use it, and any future share link
// can too. A value is JSON-stringified, zlib-compressed, then base64url-encoded, so
// the result is URL-safe (no +, /, or = to escape) and far shorter than the raw
// JSON. The shape each caller packs is its own concern; this only moves bytes.

export function bytesToBase64url(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlToBytes(code: string): Uint8Array {
    const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// Pack a JSON-serialisable value into a URL-safe token.
export function packToCode(value: unknown): string {
    return bytesToBase64url(zlibSync(strToU8(JSON.stringify(value)), { level: 9 }));
}

// A share link arrives from anywhere — a chat message, a QR code, a stranger — and
// compressed bytes expand by an unbounded ratio, so both ends of the decode are held
// to a budget. Without them a link a few kilobytes long inflates to hundreds of
// megabytes on the main thread before a single field is validated, which reads to the
// player as the tab hanging and then dying.
//
// Both limits sit far above anything the app itself produces: the longest real token
// (a ghost for a long piece, a whole improvisation) is a few kilobytes packed and well
// under a hundred kilobytes expanded.

// The longest token that is decoded at all. Decoding costs time in proportion to the
// COMPRESSED length however small the output is held, so the input is what bounds the
// work a hostile link can demand.
export const MAX_CODE_LENGTH = 64 * 1024;

// The most decompressed bytes a token may yield. fflate fills a supplied buffer and
// stops, so the expansion is bounded by allocation, not just rejected after the fact.
export const MAX_DECODED_BYTES = 512 * 1024;

// Reverse packToCode, returning null for any malformed token rather than throwing,
// so a hand-edited or truncated link is simply ignored. A token that is over-long, or
// that expands past the budget, is refused the same way — an oversized link is not a
// link this app wrote.
export function unpackFromCode(code: string): unknown {
    if (code.length > MAX_CODE_LENGTH) {
        return null;
    }
    try {
        // One byte of headroom, so a payload that fills the buffer exactly is
        // distinguishable from one that was cut short by it.
        const out = new Uint8Array(MAX_DECODED_BYTES + 1);
        const bytes = unzlibSync(base64urlToBytes(code), { out });
        if (bytes.length > MAX_DECODED_BYTES) {
            return null;
        }
        return JSON.parse(strFromU8(bytes));
    } catch {
        return null;
    }
}
