// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { art, Drawing, type DrawingProps } from "./drawing";

// A keyboard split down the middle, one half of it lit: one hand at a time.
export function HalfKeyboardDrawing({ className }: DrawingProps) {
    return (
        <Drawing className={className}>
            <ellipse style={art.fl} cx="36" cy="30" rx="31" ry="20" />
            <rect style={art.pp} x="8" y="22" width="56" height="24" rx="3" />
            <path style={art.st} d="M16 22v24M24 22v24M32 22v24M40 22v24M48 22v24M56 22v24" />
            <rect
                style={{ ...art.ac, opacity: 0.55 }}
                x="40.8"
                y="23"
                width="22"
                height="22"
                rx="1"
            />
            <path style={{ ...art.st, strokeDasharray: "2 4" }} d="M36 12v42" />
            <circle style={art.dot} cx="52" cy="14" r="3" />
        </Drawing>
    );
}
