// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { strFromU8, unzipSync } from "fflate";

// Reads MusicXML out of the files notation software produces. A plain .musicxml/.xml
// is the document itself; a .mxl is a zip whose real score is the rootfile named by
// META-INF/container.xml — the format MuseScore, Finale and the rest export by
// default. The song and exercise catalogues fetch .mxl over the network and reuse
// the same decompression here.

// Extract the MusicXML string from .mxl (compressed) bytes, or null if the zip holds
// no readable score.
// The most a .mxl may weigh once unpacked. A score is prose and numbers — the whole
// bundled catalogue's largest is a few hundred kilobytes — so this is far above anything
// real and far below what a zip bomb asks for. Without a ceiling a one-megabyte file
// expands to gigabytes and takes the tab with it; the file is the player's own, so this is
// a guard against a mistake or a malicious download rather than an attack on a server.
const MAX_UNPACKED_BYTES = 32 * 1024 * 1024;

export function decompressMxl(bytes: Uint8Array): string | null {
    try {
        // Refused before inflating, off the sizes the zip's own directory declares — a
        // bomb announces itself there — and again after, since a header can lie.
        let declared = 0;
        let refused = false;
        const entries = unzipSync(bytes, {
            filter: (file) => {
                declared += file.originalSize;
                if (file.originalSize > MAX_UNPACKED_BYTES || declared > MAX_UNPACKED_BYTES) {
                    refused = true;
                    return false;
                }
                return true;
            },
        });
        if (refused) {
            return null;
        }
        const unpacked = Object.values(entries).reduce((total, entry) => total + entry.length, 0);
        if (unpacked > MAX_UNPACKED_BYTES) {
            return null;
        }
        const container = strFromU8(entries["META-INF/container.xml"] ?? new Uint8Array());
        // Prefer the rootfile container.xml names, but fall back to scanning the zip when
        // it's missing or points at an absent entry (a mislabelled or hand-zipped .mxl),
        // and accept a .musicxml rootfile as well as .xml.
        const named = container.match(/full-path="([^"]+)"/)?.[1];
        const scanned = Object.keys(entries).find(
            (name) =>
                !name.startsWith("META-INF") &&
                (name.endsWith(".xml") || name.endsWith(".musicxml")),
        );
        const root = named && entries[named] ? named : scanned;
        return root && entries[root] ? strFromU8(entries[root]) : null;
    } catch {
        return null;
    }
}

// Decodes the document's bytes, honouring the byte-order mark a UTF-16 file carries.
//
// MusicXML is XML, and XML may be UTF-16 — Finale and some older tools write it that way.
// Decoded as UTF-8 those bytes come out interleaved with NULs, the parser finds no notes,
// and the import failed for a reason nobody could see: the file was perfectly valid.
function decodeXml(bytes: Uint8Array): string {
    const [a, b] = [bytes[0], bytes[1]];
    if (a === 0xff && b === 0xfe) {
        return new TextDecoder("utf-16le").decode(bytes);
    }
    if (a === 0xfe && b === 0xff) {
        return new TextDecoder("utf-16be").decode(bytes);
    }
    return new TextDecoder().decode(bytes);
}

// Read a chosen or dropped file to its MusicXML text. The leading "PK" zip signature,
// not the extension, decides whether to decompress — so a .mxl saved with the wrong
// name, or a plain .xml, both read correctly. Null when the file can't be read.
export async function readScoreFile(file: File): Promise<string | null> {
    try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
        return isZip ? decompressMxl(bytes) : decodeXml(bytes);
    } catch {
        return null;
    }
}
