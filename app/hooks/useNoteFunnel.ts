// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useMemo, useRef, useState } from "react";
import { holdScaleFor, isPreciseInput, MIC_DEVICE, type MidiNoteEvent } from "../../core/midi";
import type { PedalKind } from "../../core/pedals";
import type { NoteListener } from "../contexts/midi";

// Every handler present. `keys` is deliberately outside it: that flag describes the
// surface rather than what it does with a note, and the surface is what says it.
type NoteHandlers = Required<Omit<NoteListener, "keys">>;

// Where every note the player makes arrives, whatever made it: a MIDI piano, the
// computer keyboard, the on-screen keys, or the microphone listening to a real one.
//
// One funnel, because the surface must not care which. What it does care about is that
// the four sources do not behave alike, and three decisions here are entirely about
// telling them apart:
//
//   - A tempo-locked play-along owns the input while it runs. Notes are caught against
//     its clock, and the self-paced matcher never sees them.
//   - The microphone's note-off is the pitch detector losing the note, not a key coming
//     up. It is too noisy to read as articulation, it opened no voice to end, and a mic
//     note added to the held set would never leave it — holding full screen open for
//     the rest of the session. So mic input joins nothing and releases nothing.
//   - The on-screen and computer keyboards carry no true velocity or rhythm, which
//     widens the run's timing windows; and a jab at either is far shorter than a real
//     key press, so their voices ring on a little to sound musical, where a MIDI key
//     keeps its own articulation exactly.
//
// The held set is the other half. A finished run waits for the last key to come up
// before it leaves full screen and before its take is saved, so "is anything still
// down" has to be a fact the surface can read, not a guess.

export type NoteFunnelOptions = {
    // A play-along is running and owns the input.
    keepUpActive: () => boolean;
    registerKeepUp: (note: number) => void;
    // The self-paced matcher, for every note a play-along did not claim.
    registerNote: (note: number, at: number, velocity: number) => void;
    // The recording.
    markImprecise: () => void;
    recordRelease: (note: number, at: number) => void;
    recordPedal: (down: boolean, at: number) => void;
    // The live sound. `holdScale` stretches a short jab into something musical.
    releaseVoice: (note: number, holdScale: number) => void;
    setPedal: (pedal: PedalKind, down: boolean) => void;
};

export type NoteFunnel = {
    // Whether any key is down right now.
    holding: boolean;
    // Whether this pitch in particular is still down. A position clears when its last
    // pitch lands, but the matcher never sees note-offs — so a rolled chord can clear
    // while an earlier pitch is already up, and pressing a guide voice for that pitch
    // would open one with no key-up left to release it.
    isHeld: (pitch: number) => boolean;
    // What pressed a key that is still down, or null when nothing is. The play surface
    // needs it to decide whether to voice the note: a note from an instrument that makes
    // its own sound must not be answered with a second one.
    deviceOf: (pitch: number) => string | null;
    // Handed to the MIDI context. Returned rather than subscribed here so the decisions
    // above can be exercised directly, without a provider or a device.
    listener: NoteHandlers;
};

export function useNoteFunnel(options: NoteFunnelOptions): NoteFunnel {
    // Note to the device holding it: a set would answer whether a key is down but not
    // what is holding it, and both questions are asked of the same moment.
    const held = useRef(new Map<number, string>());
    const [holding, setHolding] = useState(false);
    const latest = useRef(options);
    latest.current = options;

    const sync = useCallback(() => setHolding(held.current.size > 0), []);

    const listener = useMemo<NoteHandlers>(
        () => ({
            onNoteOn: (event: MidiNoteEvent) => {
                const o = latest.current;
                if (o.keepUpActive()) {
                    o.registerKeepUp(event.note);
                    return;
                }
                if (!isPreciseInput(event.device)) {
                    o.markImprecise();
                }
                // Only keyed input, which releases cleanly, defers the exit.
                if (event.device !== MIC_DEVICE) {
                    held.current.set(event.note, event.device);
                    sync();
                }
                o.registerNote(event.note, event.timestamp, event.velocity);
            },
            onNoteOff: (event: MidiNoteEvent) => {
                if (event.device === MIC_DEVICE) {
                    return;
                }
                const o = latest.current;
                o.releaseVoice(event.note, holdScaleFor(event.device));
                held.current.delete(event.note);
                sync();
                o.recordRelease(event.note, event.timestamp);
            },
            // The pedals shape the live sound; only sustain drives the recording's damper
            // model, so a pedalled take replays as pedalled while sostenuto and soft colour
            // the sound alone. No pedal reaches the matcher — the key press by itself still
            // decides when a note counts.
            onPedal: (pedal: PedalKind, down: boolean, timestamp: number) => {
                const o = latest.current;
                o.setPedal(pedal, down);
                if (pedal === "sustain") {
                    o.recordPedal(down, timestamp);
                }
            },
        }),
        [sync],
    );

    return {
        holding,
        isHeld: (pitch) => held.current.has(pitch),
        deviceOf: (pitch) => held.current.get(pitch) ?? null,
        listener,
    };
}
