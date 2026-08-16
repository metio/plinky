// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which recording answers a given key and velocity. Split from the SFZ reader so the
// browser can ask the same question the Node side does without reaching for a filesystem:
// one mapping, used in both places, is the only way the two can agree about what a piece
// should sound like.

// The recording that answers this key at this velocity. A pitch outside the sampled range
// falls to the nearest region, which is what the library's own lokey/hikey spans do at the
// ends of the keyboard.
export function regionFor(regions, pitch, velocity) {
    const covering = regions.filter(
        (region) =>
            pitch >= region.lowKey &&
            pitch <= region.highKey &&
            velocity >= region.lowVelocity &&
            velocity <= region.highVelocity,
    );
    if (covering.length > 0) {
        return covering[0];
    }
    // Nothing covers it: take the nearest key centre at the closest velocity, so a piece
    // that strays outside the mapping still sounds rather than falling silent.
    let best = regions[0];
    let bestCost = Number.POSITIVE_INFINITY;
    for (const region of regions) {
        const cost =
            Math.abs(region.keyCentre - pitch) * 4 +
            Math.abs((region.lowVelocity + region.highVelocity) / 2 - velocity) / 8;
        if (cost < bestCost) {
            bestCost = cost;
            best = region;
        }
    }
    return best;
}
