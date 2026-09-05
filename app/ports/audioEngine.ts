// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { PedalKind } from "../../core/pedals";

// The sound seam. Everything audible goes through this interface, so the hooks
// that decide WHAT to play (which note, how loud after the volume preference,
// when on the beat grid) stay free of the Web Audio graph, and a test hands
// them a fake that records strikes instead of stubbing browser globals.

// One synthesized piano note. `gain` is the final loudness (0..1) — the caller
// has already applied velocity and the volume preference.
export type NoteStrike = {
    note: number; // MIDI note number
    gain: number;
    // How hard the key was hit, 0..127, before the volume preference was folded into
    // `gain`. A synthesised voice needs only the gain; a recorded one needs this, because
    // which recording answers the note IS the dynamic — scaling it by velocity again would
    // play a pianissimo layer pianissimo twice.
    velocity: number;
    duration: number; // seconds
    delay: number; // seconds from now on the audio clock
    // Whether this note sounds with the dampers off — the score asks for the sustain pedal
    // here, or a player is holding it. The other strings answer a struck one, which is what
    // the pedal actually sounds like beyond "notes last longer".
    //
    // Carried on the strike rather than read from the engine's own pedal state, because
    // Listen never presses the pedal: it models pedalling by lengthening each note, so the
    // engine would see a piece with a pedal marking on every bar as one played with the
    // pedal up. Live play sets the pedal for real and answers the same question from it.
    pedalled?: boolean;
};

// A metronome tick: the accented downbeat, a plain beat, or a subdivision.
export type ClickKind = "accent" | "beat" | "sub";

export interface AudioEngine {
    // Seconds on the audio clock, or null when audio is unavailable (server
    // render, browser context limit). Click scheduling anchors to this.
    now(): number | null;
    // Ask the engine to leave the suspended state browsers park audio in until
    // a user gesture. Best-effort.
    resume(): void;
    // Whether a sound struck now would actually be heard now. False before the first
    // gesture unlocks audio, and while the browser has the context suspended.
    //
    // It matters because a strike is scheduled against the context's own clock, and
    // that clock does not advance while the context is suspended — so every strike made
    // during a suspension is scheduled at the same frozen instant and they all sound
    // together the moment it resumes. A caller whose sound is only meaningful NOW
    // should ask first and drop it otherwise.
    running(): boolean;
    // Wake audio from inside a user gesture: resume the context and play a silent
    // buffer through it. iOS Safari parks a freshly opened context suspended until
    // a gesture actually plays something, and a resume() alone does not always
    // move it to running there — the silent buffer does. Call once on the first
    // pointer/key gesture, before any note has been struck. Best-effort.
    unlock(): void;
    strike(strike: NoteStrike): void;
    // Start a sustaining live voice for a held key. Unlike strike (a fixed-length note for
    // Listen and replay), a pressed voice rings until release() or the sustain pedal lifts,
    // so the sound follows the player's own key hold — a quick release sounds staccato, a
    // long hold sustains. Re-pressing a still-sounding note restarts it. `gain` is the final
    // loudness (0..1), velocity and volume already applied.
    press(note: number, gain: number, velocity: number): void;
    // End a sustaining voice, ringing it out over a tail scaled to how long it was held —
    // unless a pedal is holding it, when it keeps ringing until the pedal lifts. holdScale
    // (default 1) lengthens the ring as if the key had been held that many times longer, so
    // a short tap from an imprecise input still sounds musical; a pedal-driven end never
    // passes it, staying at 1.
    release(note: number, holdScale?: number): void;
    // Move one of the three pedals. Sustain holds every released voice, sostenuto holds only
    // the notes sounding when it was pressed, and soft gentles notes struck while it's down.
    setPedal(pedal: PedalKind, down: boolean): void;
    // Silence every live voice at once and drop all held-key and pedal state — a panic for
    // when a play surface tears down or a run ends, so no voice can ring on. The engine
    // state is a process-lifetime singleton, so nothing else guarantees this on unmount or
    // route change. Idempotent; safe with no audio context.
    allNotesOff(): void;
    // How much of the room is heard around the instrument, as a final wet gain (0 = dry).
    //
    // A graph-level property rather than a per-note one, which is why it is a method here
    // where the volume preference is folded into each strike's `gain` instead: there is one
    // room, and every voice already in it is in the same one.
    setRoom(wet: number): void;
    // A click at an absolute audio-clock time, `gain` already volume-adjusted. Returns
    // a cancel that silences the click if it has not sounded yet: a track queued whole on
    // the audio clock — a count-in and a run — can then be taken off it again when the
    // player restarts or leaves, where allNotesOff reaches only the voices.
    click(time: number, kind: ClickKind, gain: number): () => void;
    // Whether the engine synthesized this pitch recently enough that a
    // microphone could still be hearing it ring — the echo probe the mic input
    // uses to ignore the app's own speaker. Optional: fakes and offline
    // renderers have no speaker to echo.
    recentlyStruck?(note: number, withinMs: number): boolean;
}
