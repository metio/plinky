// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { art, Drawing, type DrawingProps } from "./drawing";

// A metronome with its weight slid up the arm: the slow end of the dial.
export function MetronomeDrawing({ className }: DrawingProps) {
    return (
        <Drawing className={className}>
            <ellipse style={art.fl} cx="36" cy="32" rx="28" ry="21" />
            <path style={art.pp} d="M25 50 32 8h8l7 42z" />
            <path style={art.st} d="M22 50h28" />
            <path style={art.st} d="M36 44 49 17" />
            <rect
                style={art.ac}
                x="41"
                y="24"
                width="8"
                height="6"
                rx="1.5"
                transform="rotate(25 45 27)"
            />
            <path style={{ ...art.st, opacity: 0.35 }} d="M30 38h12" />
        </Drawing>
    );
}
