// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { art, Drawing, type DrawingProps } from "./drawing";

// Two bars of notes with an arrow curling back over them: the bar that keeps going wrong,
// played round again.
export function LoopDrawing({ className }: DrawingProps) {
    return (
        <Drawing className={className}>
            <ellipse style={art.fl} cx="36" cy="33" rx="31" ry="19" />
            <path style={art.thin} d="M12 30h48M12 36h48M12 42h48" />
            <path style={art.st} d="M36 27v18" />
            <circle style={art.dot} cx="21" cy="36" r="3" />
            <circle style={art.dot} cx="29" cy="30" r="3" />
            <circle style={art.dot} cx="45" cy="39" r="3" />
            <circle style={art.dot} cx="53" cy="33" r="3" />
            <path style={art.acs} d="M58 20c0-9-10-13-22-13S15 11 14 18" />
            <path style={art.acs} d="M10 14l4 5 5-3" />
        </Drawing>
    );
}
