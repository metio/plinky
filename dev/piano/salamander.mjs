// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads the Salamander Grand Piano's own SFZ into a map a sampler can play from.
//
// The SFZ is the authority on which recording answers a given key and velocity: the
// library samples every minor third and splits each key into sixteen velocity layers, and
// guessing either mapping is how a sampled piano ends up sounding like a keyboard. Nothing
// here is Plinky's opinion — it is the library's own file, parsed.
//
// Salamander Grand Piano V3 by Alexander Holm, CC-BY-3.0. Not redistributed from this
// repository: the library is downloaded to a scratch directory and this reads it there.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export { regionFor } from "./voicing.mjs";

export function readSfz(sfzPath) {
    const text = readFileSync(sfzPath, "utf8");
    const root = dirname(sfzPath);
    const regions = [];
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("<region>")) {
            continue;
        }
        const field = (name) => {
            const found = new RegExp(`\\b${name}=([^\\s]+)`).exec(trimmed);
            return found ? found[1] : undefined;
        };
        const sample = field("sample");
        const keyCentre = Number(field("pitch_keycenter"));
        if (!sample || !Number.isFinite(keyCentre)) {
            continue;
        }
        regions.push({
            // The SFZ is written with Windows separators, as the format's examples are.
            file: join(root, sample.replace(/\\/g, "/")),
            keyCentre,
            lowKey: Number(field("lokey") ?? keyCentre),
            highKey: Number(field("hikey") ?? keyCentre),
            lowVelocity: Number(field("lovel") ?? 1),
            highVelocity: Number(field("hivel") ?? 127),
            // The release and resonance groups carry no pitch_keycenter, so what is left
            // here is the played notes.
            release: /rel\d+\.wav/.test(sample),
        });
    }
    return regions.filter((region) => !region.release);
}
