// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { art, Drawing, type DrawingProps } from "./drawing";

// Headphones with the sound arriving in them: hear it before you play it.
export function HeadphonesDrawing({ className }: DrawingProps) {
    return (
        <Drawing className={className}>
            <ellipse style={art.fl} cx="36" cy="33" rx="30" ry="20" />
            <path style={art.st} d="M18 38v-8a18 18 0 0 1 36 0v8" />
            <rect style={art.pp} x="13" y="34" width="10" height="15" rx="4" />
            <rect style={art.pp} x="49" y="34" width="10" height="15" rx="4" />
            <path style={art.acs} d="M30 20c3 2 3 6 0 8M36 17c5 4 5 10 0 14" />
        </Drawing>
    );
}
