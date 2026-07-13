// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A Boomwhacker-style colour per note name, so a beginner can read the notes by hue —
// every C the same red, every D the same orange — the way coloured percussion tubes and
// many first-instrument methods teach note identity, with each colour mapping to a
// position on the staff.
//
// This is the eight-entry set OSMD's CustomColorSet colouring expects: the seven note
// names C, D, E, F, G, A, B in order, then the rest colour. Colouring is by letter, so a
// sharp shares its natural's hue. The score always renders on a white background (see
// scoreCanvas), so each colour is chosen dark and saturated enough to read clearly there
// rather than the pale primaries a coloured-tube set uses on its own; a rest carries no
// pitch, so it stays a neutral grey.
export const BOOMWHACKER_SET = [
    "#d42a2a", // C  red
    "#e8820c", // D  orange
    "#a89400", // E  gold — a legible yellow on white
    "#5ea500", // F  yellow-green
    "#0ca678", // G  teal-green
    "#1971c2", // A  blue
    "#9c36b5", // B  violet
    "#94a3b8", // rest — neutral grey
];
