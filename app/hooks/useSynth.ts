// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useMemo } from "react";
import { noteGain } from "../../core/loudness";
import { soundsOnItsOwn } from "../../core/midi";
import { wetFor } from "../../core/room";
import type { PedalKind } from "../../core/pedals";
import { useAudioEngine, usePrefsStore } from "../contexts/services";

export type PlayNoteOptions = {
    velocity?: number; // 0..127
    duration?: number; // seconds
    delay?: number; // seconds to wait before the strike, for scheduling a chord or arpeggio
    // A sound that is only worth anything at the instant it was asked for — a hover
    // plink, an ornament. Dropped outright when audio is asleep rather than scheduled.
    //
    // A strike is timed against the audio context's own clock, and that clock STOPS
    // while the context is suspended (before the first gesture unlocks audio, or across
    // an interruption). Every strike made during a suspension therefore lands on the
    // same frozen instant, and they all sound together the moment it resumes — five
    // hovers down a list arriving as one chord, minutes later. A note the player asked
    // for is worth hearing late; decoration is not.
    decorative?: boolean;
    // The score asks for the sustain pedal at this note. Listen models pedalling by
    // lengthening notes rather than by pressing the engine's pedal, so this is how the
    // engine learns that the dampers are off and the rest of the instrument is ringing.
    pedalled?: boolean;
    // What the player struck this note on, when it is the player's own note being echoed
    // back — a keep-up run sounds each strike over the guide. An instrument that makes
    // its own sound is not answered with a second one; see pressNote.
    device?: string;
};

export type UseSynthResult = {
    // A fixed-length note for Listen and replay — the caller sets the duration.
    playNote: (note: number, options?: PlayNoteOptions) => void;
    // A live voice for a held key: it rings until releaseNote (or the pedal lifts), so the
    // sound follows the player's own key hold. A quick release sounds staccato, a long hold
    // sustains — the articulation the player actually gave.
    // `device` names what pressed the key, so a note an instrument is already sounding
    // is not sounded twice. Omitted where the caller is not an instrument path.
    // Answers whether a voice was opened, so a caller can end exactly the voices it started.
    pressNote: (note: number, options?: { velocity?: number; device?: string }) => boolean;
    // holdScale (default 1) lets an imprecise input's short tap ring on; see the engine's
    // release. A real MIDI key leaves it at 1.
    releaseNote: (note: number, holdScale?: number) => void;
    // Move one of the three pedals for live voices.
    setPedal: (pedal: PedalKind, down: boolean) => void;
    // Silence every live voice and drop the held keys — the panic a play surface calls on
    // teardown so a guide voice can never ring on past the run. The pedals stay where the
    // player's foot has them; see AudioEngine.allNotesOff.
    silenceAll: () => void;
    // The instrument for the run that starts now; see AudioEngine.commitVoice.
    commitVoice: () => void;
    // The run is over; see AudioEngine.uncommitVoice.
    uncommitVoice: () => void;
};

// Decides what a note should sound like — loudness from velocity and the volume
// preference, silence when muted — and hands it to the injected audio engine. Listen and
// replay strike fixed-length notes; live play presses and releases voices so the sound
// tracks the key hold. The synthesis lives behind the engine seam, so this hook tests
// against a fake that records what would have sounded.
export function useSynth(): UseSynthResult {
    const prefsStore = usePrefsStore();
    const audio = useAudioEngine();

    // The final loudness for a velocity, after the volume preference — or null when muted
    // or silent, so a silent note never reaches the engine's exponential ramps.
    const gainFor = useCallback(
        (velocity: number): number | null => {
            const prefs = prefsStore.load();
            // The room is a property of the graph rather than of a note, so it is set here
            // rather than folded into the gain. Applied on the way to every strike instead
            // of watched from an effect: the room is only audible when something sounds, so
            // the moment before a note is exactly when the setting has to be right — and
            // there is no subscription to mount, unmount or forget. Idempotent, and the
            // engine ramps rather than jumps.
            audio.setRoom(wetFor(prefs.reverb));
            return noteGain(prefs, velocity);
        },
        [prefsStore, audio],
    );

    // Whether the player's own instrument is already making this sound, so Plinky must not
    // make it again; see soundsOnItsOwn. A caller that names no device is not an instrument
    // path and always sounds.
    const ownVoice = useCallback(
        (device: string | undefined) =>
            device !== undefined && soundsOnItsOwn(device, prefsStore.load().instrumentSounds),
        [prefsStore],
    );

    const playNote = useCallback(
        (note: number, options: PlayNoteOptions = {}) => {
            if (ownVoice(options.device)) {
                return;
            }
            const gain = gainFor(options.velocity ?? 90);
            if (gain === null) {
                return;
            }
            if (options.decorative && !audio.running()) {
                // Nor resume(): a hover is not a user gesture, so the browser would
                // refuse it anyway, and decoration has no business waking the audio.
                return;
            }
            audio.resume();
            audio.strike({
                note,
                pedalled: options.pedalled ?? false,
                gain,
                // The force, before the volume preference was folded into the gain: a
                // recorded piano picks its recording by this, and scaling that recording by
                // velocity again would apply the dynamic twice.
                velocity: options.velocity ?? 90,
                duration: options.duration ?? 1.1,
                delay: Math.max(0, options.delay ?? 0),
            });
        },
        [gainFor, audio, ownVoice],
    );

    const pressNote = useCallback(
        (note: number, options: { velocity?: number; device?: string } = {}) => {
            if (ownVoice(options.device)) {
                return false;
            }
            const gain = gainFor(options.velocity ?? 90);
            if (gain === null) {
                return false;
            }
            audio.resume();
            audio.press(note, gain, options.velocity ?? 90);
            return true;
        },
        [gainFor, audio, ownVoice],
    );

    // Release and pedal always reach the engine — a muted session opened no voice, so they
    // are harmless no-ops there, and the pedal state must track regardless of volume.
    const releaseNote = useCallback(
        (note: number, holdScale?: number) => audio.release(note, holdScale),
        [audio],
    );
    const setPedal = useCallback(
        (pedal: PedalKind, down: boolean) => audio.setPedal(pedal, down),
        [audio],
    );
    // Reaches the engine regardless of the volume preference — it clears the voices and
    // held keys, which must happen even for a muted session that opened none.
    const silenceAll = useCallback(() => audio.allNotesOff(), [audio]);

    // A stable result so callers can list the synth in an effect's dependencies without the
    // effect re-firing every render.
    const commitVoice = useCallback(() => audio.commitVoice(), [audio]);
    const uncommitVoice = useCallback(() => audio.uncommitVoice(), [audio]);
    return useMemo(
        () => ({
            playNote,
            pressNote,
            releaseNote,
            setPedal,
            silenceAll,
            commitVoice,
            uncommitVoice,
        }),
        [playNote, pressNote, releaseNote, setPedal, silenceAll, commitVoice, uncommitVoice],
    );
}
