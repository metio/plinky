// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
    // A click at an absolute audio-clock time, `gain` already volume-adjusted.
    click(time: number, kind: ClickKind, gain: number): void;
    // Whether the engine synthesized this pitch recently enough that a
    // microphone could still be hearing it ring — the echo probe the mic input
    // uses to ignore the app's own speaker. Optional: fakes and offline
    // renderers have no speaker to echo.
    recentlyStruck?(note: number, withinMs: number): boolean;
}
