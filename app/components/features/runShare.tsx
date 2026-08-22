// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Grid, RunNote } from "../../../core/shareCard";
import { handsPlayed } from "../../../core/shareCard";
import type { Letter } from "../../../core/grade";
import { m } from "../../paraglide/messages.js";
import { ShareCard } from "./shareCard";

// Everything worth showing somebody else, at the very foot of a finished run.
//
// Last on purpose, and its own component so it can be: the readouts above it — the grade,
// the note-by-note strip, the tempo curve, this piece's best sections — are what the player
// is here for, and are read in order. Showing somebody else is the thing you do after
// reading them, so it comes after them rather than in the middle.
export function RunShare({
    grid,
    notes,
    letter,
    title,
    daily,
}: {
    grid: Grid;
    notes: RunNote[];
    letter: Letter;
    title: string;
    daily: number | null | undefined;
}) {
    const hands = handsPlayed(notes);
    return (
        <ShareCard
            grid={grid}
            caption={m.share_heading()}
            gridLabel={m.share_grid_label()}
            rowLabels={
                hands.length > 1
                    ? hands.map((staff) => (staff === 0 ? m.hand_right() : m.hand_left()))
                    : [m.share_row_you()]
            }
            boast={
                daily != null
                    ? m.daily_share_boast({ number: daily, grade: letter })
                    : m.share_boast({ title })
            }
            heading={daily != null ? m.daily_share_boast({ number: daily, grade: letter }) : title}
        />
    );
}
