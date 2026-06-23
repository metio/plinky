// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Encode an ABC tune into a URL-safe string for share links, and back. Songs are
// small, so plain base64url of the UTF-8 bytes keeps links short without a
// compression dependency.

function toBase64Url(base64: string): string {
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
    return encoded.replace(/-/g, "+").replace(/_/g, "/");
}

export function encodeSong(abc: string): string {
    const bytes = new TextEncoder().encode(abc);
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return toBase64Url(btoa(binary));
}

export function decodeSong(encoded: string): string | null {
    try {
        const binary = atob(fromBase64Url(encoded));
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    } catch {
        return null;
    }
}
