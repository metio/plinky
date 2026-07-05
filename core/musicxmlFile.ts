// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { strFromU8, unzipSync } from "fflate";

// Reads MusicXML out of the files notation software produces. A plain .musicxml/.xml
// is the document itself; a .mxl is a zip whose real score is the rootfile named by
// META-INF/container.xml — the format MuseScore, Finale and the rest export by
// default. The song and exercise catalogues fetch .mxl over the network and reuse
// the same decompression here.

// Extract the MusicXML string from .mxl (compressed) bytes, or null if the zip holds
// no readable score.
export function decompressMxl(bytes: Uint8Array): string | null {
    try {
        const entries = unzipSync(bytes);
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

// Read a chosen or dropped file to its MusicXML text. The leading "PK" zip signature,
// not the extension, decides whether to decompress — so a .mxl saved with the wrong
// name, or a plain .xml, both read correctly. Null when the file can't be read.
export async function readScoreFile(file: File): Promise<string | null> {
    try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
        return isZip ? decompressMxl(bytes) : new TextDecoder().decode(bytes);
    } catch {
        return null;
    }
}
