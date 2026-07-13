// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { XmlCodec } from "./xml";

// Beams are the bars joining eighth notes and shorter into beat groups. They tell a
// fluent reader where the pulse falls, but for a beginner first meeting fast notes
// they read as clutter — one note at a time, each with its own flag, is easier to
// track. This preference, and the pure decision below, let a player hide the beams
// while learning and bring them back once beat-grouping is the point.
export type Beams = "auto" | "on" | "off";

export const BEAMS: Beams[] = ["auto", "on", "off"];

// Above this difficulty grade, "auto" shows beams. Grades at or below it are the
// early sight-reading stage — the reader is still finding the notes, so flags read
// more clearly than beat groups. Beams only appear on eighth notes and shorter
// anyway, which the very easiest grades barely carry, so this bites exactly where a
// learner first meets fast notes.
export const BEAM_AUTO_MAX_HIDDEN_GRADE = 3;

// Whether OSMD should draw the score's beams, given the player's preference and the
// piece's difficulty grade. "on"/"off" force it; "auto" follows the grade, and a
// piece with no known grade (a generated exercise, a composition) keeps standard
// beams rather than guessing.
export function beamsVisible(mode: Beams, grade: number | undefined): boolean {
    if (mode === "on") {
        return true;
    }
    if (mode === "off") {
        return false;
    }
    return grade === undefined || grade > BEAM_AUTO_MAX_HIDDEN_GRADE;
}

// Removes every <beam> element from a score's MusicXML so OSMD renders each short
// note with its own flag instead of joining them into beam groups. The notes and
// their durations are untouched — only the visual grouping is dropped — so playback,
// timing and matching are unaffected. Returns the input unchanged when it carries no
// beams or is not well-formed, so a no-op stays cheap and malformed input is a normal
// condition rather than a throw.
export function stripBeams(codec: XmlCodec, xml: string): string {
    const doc = codec.parse(xml);
    if (!doc) {
        return xml;
    }
    const beams = doc.querySelectorAll("beam");
    if (beams.length === 0) {
        return xml;
    }
    for (const beam of beams) {
        beam.remove();
    }
    return codec.serialize(doc);
}
