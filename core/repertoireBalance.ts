// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which pieces have been getting the time, and which have quietly stopped getting any.
//
// The practice log already records the minutes and the pieces they were spent on, but it
// records them session by session — and the question a player actually has is the other
// way round: not "what did I do on Tuesday" but "when did I last touch the Bach". A
// repertoire drifts by neglect rather than by decision, and neglect is invisible in a
// list ordered by date, because the piece you are forgetting is the one that stops
// appearing.
//
// Nothing here is a target or a scold. A piece nobody has played for a month is reported
// as a piece nobody has played for a month, which is a fact a player can do as they like
// with — put it back in the rotation, or let it go.

import { DAY_MS } from "./dateKey";
import type { PracticeLog } from "./practiceSession";

export type RepertoireEntry = {
    piece: string;
    // Time attributed to this piece across the range.
    activeMs: number;
    sessions: number;
    // When it was last touched, as the start of that session.
    lastAt: number;
};

// A session that touched several pieces splits its time evenly between them.
//
// It is a guess, and it is the only honest one available: the log records which pieces a
// session touched but not how the minutes divided between them, and inventing a weighting
// (first piece counts most, longest list counts least) would dress the same guess up as a
// measurement. An even split at least never claims a piece got time it did not.
export function repertoireBalance(log: PracticeLog): RepertoireEntry[] {
    const byPiece = new Map<string, RepertoireEntry>();
    for (const session of log) {
        if (session.pieces.length === 0) {
            continue;
        }
        const share = session.activeMs / session.pieces.length;
        for (const piece of session.pieces) {
            const entry = byPiece.get(piece);
            if (entry) {
                entry.activeMs += share;
                entry.sessions += 1;
                entry.lastAt = Math.max(entry.lastAt, session.start);
            } else {
                byPiece.set(piece, {
                    piece,
                    activeMs: share,
                    sessions: 1,
                    lastAt: session.start,
                });
            }
        }
    }
    // Most-practised first, and a tie broken by which was touched most recently — so a
    // piece with the same minutes as another is not ordered by the accident of its id.
    return [...byPiece.values()].sort(
        (one, other) => other.activeMs - one.activeMs || other.lastAt - one.lastAt,
    );
}

// Whole days since a piece was last touched, from a reference instant the caller owns —
// core reads no clock.
export function daysSince(entry: RepertoireEntry, now: number): number {
    return Math.max(0, Math.floor((now - entry.lastAt) / DAY_MS));
}
