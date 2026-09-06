// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFile } from "node:fs/promises";
import { readHarmony } from "../core/harmony.ts";
import { decompressMxl } from "../core/musicxmlFile.ts";
import { readTimeline } from "../core/musicxmlTimeline.ts";
import { summarizeChords } from "../core/pieceChords.ts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import { scorePath } from "./manifest.mts";

// The loop a piece keeps coming back to, read off its notes for the manifest at bake
// time — so the shelf can answer "other pieces built on this" without a visitor's browser
// reading three thousand scores. Solo piano only, like the reach: a song's harmony is the
// piano's, but the ladder and the shelf's ways in are about piano writing.
export async function progressionOf(song: {
    id: string;
    license?: string;
    scoreKind?: string;
}): Promise<string | null> {
    if (song.scoreKind !== "solo-piano") {
        return null;
    }
    const path = scorePath(song.id, song.license);
    if (path === null) {
        return null;
    }
    const bytes = await readFile(path).catch(() => null);
    const xml = bytes === null ? null : decompressMxl(new Uint8Array(bytes));
    const doc = xml === null ? null : linkedomXmlCodec.parse(xml);
    if (!doc) {
        return null;
    }
    const summary = summarizeChords(readHarmony(readTimeline(doc)));
    return summary?.progression ? summary.progression.join(" ") : null;
}
