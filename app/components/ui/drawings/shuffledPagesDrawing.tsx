// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { art, Drawing, type DrawingProps } from "./drawing";

// Two pages of music tilted apart, with an arrow swapping them: mix them up.
export function ShuffledPagesDrawing({ className }: DrawingProps) {
    return (
        <Drawing className={className}>
            <ellipse style={art.fl} cx="36" cy="32" rx="31" ry="20" />
            <rect
                style={art.pp}
                x="12"
                y="14"
                width="22"
                height="30"
                rx="2"
                transform="rotate(-9 23 29)"
            />
            <rect
                style={art.pp}
                x="38"
                y="14"
                width="22"
                height="30"
                rx="2"
                transform="rotate(9 49 29)"
            />
            <path style={art.st} d="M17 22h11M17 28h11M17 34h7" transform="rotate(-9 23 29)" />
            <path style={art.st} d="M43 22h11M43 28h11M43 34h7" transform="rotate(9 49 29)" />
            <path style={art.acs} d="M22 50c6-6 22-6 28 0M46 46l4 4-5 2" />
        </Drawing>
    );
}
