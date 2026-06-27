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

// Reverse packToCode, returning null for any malformed token rather than throwing,
// so a hand-edited or truncated link is simply ignored.
export function unpackFromCode(code: string): unknown {
    try {
        return JSON.parse(strFromU8(unzlibSync(base64urlToBytes(code))));
    } catch {
        return null;
    }
}
