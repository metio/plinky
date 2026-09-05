// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { LitKeys } from "../../core/keyLights";
import type { LightChannels } from "../../core/lightProfile";
import { createMidiKeyLights } from "./midiKeyLights";

// The adapter's one promise, stated generally: every light it turns on it turns off
// again, on the channel that lit it, and it never lights a key that is already lit.
// The instrument is modelled as the set of (channel, note) pairs currently lit, fed
// the bytes exactly as sent.

const channel = fc.integer({ min: 1, max: 16 });
const channels: fc.Arbitrary<LightChannels> = fc.record({ left: channel, right: channel });
// A key is lit by one hand: the picture is one set of keys split at a hand boundary.
const picture: fc.Arbitrary<LitKeys> = fc
    .tuple(fc.uniqueArray(fc.integer({ min: 21, max: 108 }), { maxLength: 8 }), fc.nat(8))
    .map(([keys, split]) => ({ left: keys.slice(0, split), right: keys.slice(split) }));
const steps = fc.array(fc.record({ channels, picture }), { minLength: 1, maxLength: 12 });

describe("midi key lights, over any sequence of pictures and channel changes", () => {
    it("lights nothing twice, puts out only what is lit, and leaves nothing lit", () => {
        fc.assert(
            fc.property(steps, (sequence) => {
                let current: LightChannels = sequence[0]?.channels ?? { left: 1, right: 1 };
                const lit = new Set<string>();
                const lights = createMidiKeyLights(
                    (data) => {
                        const status = data[0] ?? 0;
                        const key = `${status & 0x0f}:${data[1] ?? 0}`;
                        if ((status & 0xf0) === 0x90) {
                            expect(lit.has(key)).toBe(false);
                            lit.add(key);
                        } else {
                            expect(lit.has(key)).toBe(true);
                            lit.delete(key);
                        }
                    },
                    () => current,
                );
                for (const step of sequence) {
                    current = step.channels;
                    lights.show(step.picture);
                }
                lights.clear();
                expect(lit.size).toBe(0);
            }),
        );
    });
});
