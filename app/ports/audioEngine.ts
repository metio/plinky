// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
    duration: number; // seconds
    delay: number; // seconds from now on the audio clock
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
    press(note: number, gain: number): void;
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
    // A click at an absolute audio-clock time, `gain` already volume-adjusted.
    click(time: number, kind: ClickKind, gain: number): void;
    // Whether the engine synthesized this pitch recently enough that a
    // microphone could still be hearing it ring — the echo probe the mic input
    // uses to ignore the app's own speaker. Optional: fakes and offline
    // renderers have no speaker to echo.
    recentlyStruck?(note: number, withinMs: number): boolean;
}
