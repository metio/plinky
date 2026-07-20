// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The metronome's feel: which beats of the bar it accents. "straight" is the plain
// downbeat accent (the default, and how every metronome starts); "backbeat" leans on
// beats 2 and 4, the pop/rock pulse that makes a groove nod; "twoFeel" accents 1 and 3
// for a walking two-feel. A groove only moves the accent — the tempo, subdivision and
// the accent-on/off toggle are unchanged — so it stays a purely musical flavour.
export const GROOVES = ["straight", "backbeat", "twoFeel"] as const;
export type Groove = (typeof GROOVES)[number];

// Whether a groove accents a given on-beat of the bar (0-based beat index). Bars too
// short to carry a groove's signature beats fall back to the downbeat, so the pulse
// never disappears — a 1/4 or 2/4 bar under "backbeat" still ticks a clear beat one.
export function grooveAccents(groove: Groove, beatInBar: number, beatsPerBar: number): boolean {
    switch (groove) {
        case "backbeat":
            // Beats 2 and 4 (indices 1 and 3); the downbeat when the bar has neither.
            return beatsPerBar >= 2 ? beatInBar === 1 || beatInBar === 3 : beatInBar === 0;
        case "twoFeel":
            // Beats 1 and 3 (indices 0 and 2); just the downbeat when there is no beat 3.
            return beatsPerBar >= 3 ? beatInBar === 0 || beatInBar === 2 : beatInBar === 0;
        default:
            return beatInBar === 0;
    }
}
