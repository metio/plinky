// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How the player's two sound preferences become a loudness, for everything Plinky plays.
//
// One rule, in one place, because the alternative was three copies of it — the synth, the
// metronome, the rhythm trainer — that had to agree and had no way of being made to. Turning
// the sound off is a promise, and a promise kept in three places is one nobody can check.
//
// The seam is the shape of it: what a sound is *worth* is the caller's business — a
// subdivision is softer than a downbeat, a note's velocity is the score's business — and
// what the player wants to hear is this. A caller says how loud on its own terms; this says
// how loud in the room, or that there is nothing to play.
//
// What a caller does with "nothing to play" stays the caller's own: the synth drops the note
// before it reaches the engine's ramps, while the two that queue a beat grid whole keep the
// slot at zero gain, so unmuting resumes on the beat instead of starting a fresh grid.

// A note's velocity as its share of full loudness. 127 is the MIDI ceiling.
export const FULL_VELOCITY = 127;

// The ceiling a struck note is allowed, before the volume preference. Well under 1: several
// notes of a chord sum in the mix, and a piano that clips on a forte chord is worse than a
// quiet one.
export const NOTE_CEILING = 0.32;

export type SoundPrefs = { sound: boolean; volume: number };

// The loudness a sound at `level` (0..1 on the caller's own scale) is actually played at,
// or null when it would not be heard — muted, or the volume at zero. Null rather than 0 so
// a caller drops the sound instead of scheduling silence: a strike at zero gain still costs
// an exponential ramp, and a click at zero gain still occupies the audio clock.
export function audibleGain(prefs: SoundPrefs, level: number): number | null {
    if (!prefs.sound) {
        return null;
    }
    const gain = level * (clampUnit(prefs.volume) / 100);
    return gain > 0 ? gain : null;
}

// The same, for a struck note given the velocity it is played at.
export function noteGain(prefs: SoundPrefs, velocity: number): number | null {
    return audibleGain(prefs, (velocity / FULL_VELOCITY) * NOTE_CEILING);
}

// A volume outside 0..100 says the stored preference was tampered with or written by an
// older shape; clamping keeps a bad value from being amplified into a painful one.
function clampUnit(volume: number): number {
    return Number.isFinite(volume) ? Math.max(0, Math.min(100, volume)) : 0;
}
