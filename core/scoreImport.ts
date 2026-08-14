// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The decisions behind adding your own score: whether a dropped file is a piece at all,
// and what the fields the player may amend are worth once they have amended them. The
// screen collects the answers; these settle them, because a wrong answer here is written
// into a library entry and read back for as long as the piece is kept.

import { NO_TITLE } from "./scoreMeta";
import type { XmlCodec } from "./xml";

// What the tempo control offers, and so what a typed figure is allowed to be. Twenty
// beats a minute is slower than any piece is marked; four hundred is faster than a
// keyboard can be struck.
export const TEMPO_MIN = 20;
export const TEMPO_MAX = 400;

// Anything that parses as MusicXML and carries a pitched note is a piece. The renderer
// draws whatever it can beyond that, so a stricter bar would reject scores that play.
export function hasPitchedNotes(codec: XmlCodec, xml: string): boolean {
    return codec.parse(xml)?.querySelector("note > pitch") != null;
}

// The tempo a confirmed import is saved at. The field is text, so it arrives as anything
// a keyboard can produce; an unusable one falls back to the tempo the score itself is
// marked at rather than to a fixed number, which is the figure the player last saw in the
// box before they emptied it.
export function importTempo(typed: string, marked: number): number {
    const wanted = Number(typed);
    return inRange(Number.isFinite(wanted) && wanted > 0 ? wanted : marked);
}

// A figure that is not a number clamps to nothing at all — Math.max(20, NaN) is NaN — so
// it resolves to the slowest tempo on offer rather than escaping as NaN into the
// 60000/tempo arithmetic every count-in and every judged note runs on.
function inRange(tempo: number): number {
    if (!Number.isFinite(tempo)) {
        return TEMPO_MIN;
    }
    return Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(tempo)));
}

// The title box starts empty for a score whose file names no work, so the player writes
// one instead of editing a placeholder nobody meant as a title.
export function seedTitle(metaTitle: string): string {
    return metaTitle === NO_TITLE ? "" : metaTitle;
}
