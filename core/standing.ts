// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the line under the day's greeting says about where you stand — which facts are
// worth stating, given what has actually happened. The wording is the caller's; this
// only decides what there is to say, which is the part that can be wrong.
//
// It has been wrong twice. First it stated every fact whether or not there was one, so a
// first visit read "Not graded yet · Skill 0 · 0 pieces on the stand" — three ways of
// saying you have not started, under a line that had just said good morning. Then it
// dropped every empty fact, which blanked the line for somebody who had played a piece
// but not yet learned one, and a blank line reads as the app having forgotten them.

export type StandingPart = "grade" | "not-graded" | "skill" | "stand" | "notes";

export type Standing = {
    // The grade ladder position: 0 until two pieces in a grade have been played well.
    level: number;
    // Rises with the difficulty of what has been mastered; 0 until something has been.
    skill: number;
    // Pieces learned and not shelved.
    onStand: number;
    // Notes played on this device, ever.
    notes: number;
};

export function standingParts({ level, skill, onStand, notes }: Standing): StandingPart[] {
    // A first visit has nothing to report, and saying so four times is worse than
    // leaving the greeting on its own.
    if (level <= 0 && skill <= 0 && onStand <= 0 && notes <= 0) {
        return [];
    }
    const parts: StandingPart[] = [level > 0 ? "grade" : "not-graded"];
    if (skill > 0) {
        parts.push("skill");
    }
    if (onStand > 0) {
        parts.push("stand");
    }
    // What somebody with no grade yet has to show for turning up. It stands in for the
    // figures that are still zero, so it appears only where the line would otherwise say
    // nothing but "not graded" — never beside a grade, which is the stronger claim and
    // makes the count noise.
    if (parts.length === 1 && parts[0] === "not-graded" && notes > 0) {
        parts.push("notes");
    }
    return parts;
}
