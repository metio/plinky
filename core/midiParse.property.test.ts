// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { COMPOSE_MAX_TEMPO, COMPOSE_MIN_TEMPO, toMidiNotes } from "./composition";
import { buildMidiFile } from "./midiFile";
import { parseMidiFile } from "./midiParse";

describe("parseMidiFile (properties)", () => {
    it("reads back exactly the whole-number tempo buildMidiFile wrote, across Compose's range", () => {
        fc.assert(
            fc.property(fc.integer({ min: COMPOSE_MIN_TEMPO, max: COMPOSE_MAX_TEMPO }), (tempo) => {
                const composition = {
                    notes: [{ pitch: 60, startMs: 0, durationMs: 500, velocity: 80 }],
                    tempo,
                    beatsPerBar: 4,
                };
                const bytes = buildMidiFile(toMidiNotes(composition), { tempo });
                expect(parseMidiFile(bytes)?.tempo).toBe(tempo);
            }),
            { numRuns: COMPOSE_MAX_TEMPO - COMPOSE_MIN_TEMPO + 1 },
        );
    });
});
