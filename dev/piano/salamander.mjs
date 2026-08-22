// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads the Salamander Grand Piano's own SFZ into a map a sampler can play from.
//
// The SFZ is the authority on which recording answers a given key and velocity: the
// library samples every minor third and splits each key into sixteen velocity layers, and
// guessing either mapping is how a sampled piano ends up sounding like a keyboard. Nothing
// here is Plinky's opinion — it is the library's own file, parsed.
//
// It is parsed as SFZ rather than as lines, because the format puts real meaning in the
// structure and this library uses all of it:
//
//   * A `<region>` inherits from the `<group>` above it. Read a region's line alone and the
//     pedal noises — whose group says `lokey=-1 hikey=-1 on_locc64=126`, meaning "played by
//     the sustain pedal, never by a key" — arrive looking like ordinary notes.
//   * `pitch_keycenter` defaults to 60 when absent, and this library leans on that: the
//     sixteen recordings of middle C carry no keycenter at all.
//   * `trigger=release` marks a whole group as key-off material: the knocks and the string
//     resonances, which are named harm* and rel* and are not notes.
//
// Salamander Grand Piano V3 by Alexander Holm, CC-BY-3.0. Not redistributed from this
// repository: the library is downloaded to a scratch directory and this reads it there.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export { regionFor } from "./voicing.mjs";

// Every opcode on one line, as a plain object.
function opcodes(line) {
    const found = {};
    for (const [, name, value] of line.matchAll(/\b([a-z_0-9]+)=([^\s]+)/g)) {
        found[name] = value;
    }
    return found;
}

// Walks the file, handing each region its group's opcodes underneath its own.
function* eachRegion(text) {
    let group = {};
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith("<group>")) {
            group = opcodes(trimmed);
            continue;
        }
        if (trimmed.startsWith("<region>")) {
            yield { group, region: { ...group, ...opcodes(trimmed) } };
        }
    }
}

function shape(root, opcode) {
    // SFZ's own default for an unstated key centre is 60 — middle C.
    const keyCentre = Number(opcode.pitch_keycenter ?? 60);
    return {
        // The SFZ is written with Windows separators, as the format's examples are.
        file: join(root, String(opcode.sample).replace(/\\/g, "/")),
        keyCentre,
        lowKey: Number(opcode.lokey ?? keyCentre),
        highKey: Number(opcode.hikey ?? keyCentre),
        lowVelocity: Number(opcode.lovel ?? 1),
        highVelocity: Number(opcode.hivel ?? 127),
    };
}

// A group that no key can trigger: the pedal noises answer a controller, and a release
// group answers a key coming up rather than going down.
const playedByAKey = (group) =>
    group.trigger !== "release" && group.on_locc64 === undefined && group.on_locc66 === undefined;

// The played notes: every recording a key press can reach.
export function readSfz(sfzPath) {
    const text = readFileSync(sfzPath, "utf8");
    const root = dirname(sfzPath);
    const regions = [];
    for (const { group, region } of eachRegion(text)) {
        if (!region.sample || !playedByAKey(group)) {
            continue;
        }
        const found = shape(root, region);
        // A group can say lokey=-1 to mean "no key at all"; anything outside the keyboard
        // is not a note however it got there.
        if (found.lowKey >= 0 && found.highKey >= 0 && Number.isFinite(found.keyCentre)) {
            regions.push(found);
        }
    }
    return regions;
}

// The release group: key-off noises and the string resonance a lifted damper leaves
// behind. They carry a decay rate rather than a length, so they are read apart from the
// notes rather than filtered out of them.
export function readSfzExtras(sfzPath) {
    const text = readFileSync(sfzPath, "utf8");
    const root = dirname(sfzPath);
    const regions = [];
    for (const { group, region } of eachRegion(text)) {
        if (!region.sample || group.trigger !== "release") {
            continue;
        }
        const sample = String(region.sample);
        regions.push({
            ...shape(root, region),
            // A resonance rings; a key-off knock does not.
            kind: /harm/.test(sample) ? "resonance" : "knock",
            decay: Number(region.rt_decay ?? 4),
        });
    }
    return regions;
}
