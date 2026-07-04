// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";

// The single tempo readout, shown wherever a piece's speed appears. It renders in
// the surrounding sans font with tabular figures, so the digits hold a fixed width
// — a slider readout doesn't jiggle as the value changes — and the unit sits on the
// same baseline as adjacent labels. A monospace unit instead carries the font's own
// metrics and rides slightly high next to text set in Inter.
export function Bpm({ tempo, className }: { tempo: number; className?: string }) {
    return (
        <span className={`whitespace-nowrap tabular-nums${className ? ` ${className}` : ""}`}>
            {m.home_bpm({ tempo })}
        </span>
    );
}
