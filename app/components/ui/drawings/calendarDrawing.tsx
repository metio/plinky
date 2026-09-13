// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { art, Drawing, type DrawingProps } from "./drawing";

// A calendar page with one day marked and an arrow coming round to it: come back later.
export function CalendarDrawing({ className }: DrawingProps) {
    return (
        <Drawing className={className}>
            <ellipse style={art.fl} cx="36" cy="32" rx="30" ry="20" />
            <rect style={art.pp} x="16" y="14" width="34" height="32" rx="3" />
            <path style={art.st} d="M16 22h34M24 10v7M42 10v7" />
            <circle style={art.dot} cx="24" cy="30" r="2.2" />
            <circle style={art.dot} cx="33" cy="30" r="2.2" />
            <circle style={art.dot} cx="24" cy="38" r="2.2" />
            <circle style={art.ac} cx="42" cy="38" r="3.4" />
            <path style={art.acs} d="M54 44c6-6 5-16-2-21M52 18l0 5 5 1" />
        </Drawing>
    );
}
