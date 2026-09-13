// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { art, Drawing, type DrawingProps } from "./drawing";

const NOTEHEAD = { rx: 4.6, ry: 3.4 };

// Two stacked triads on a staff, the second in the accent: three notes as one shape.
export function TriadDrawing({ className }: DrawingProps) {
    return (
        <Drawing className={className}>
            <ellipse style={art.fl} cx="36" cy="32" rx="31" ry="20" />
            <path style={art.thin} d="M8 20h56M8 26h56M8 32h56M8 38h56M8 44h56" />
            {[41, 35, 29].map((cy) => (
                <ellipse
                    key={`a${cy}`}
                    style={art.dot}
                    cx="30"
                    cy={cy}
                    {...NOTEHEAD}
                    transform={`rotate(-20 30 ${cy})`}
                />
            ))}
            <path style={{ ...art.st, strokeWidth: 1.8 }} d="M34.4 40V18" />
            {[38, 32, 26].map((cy) => (
                <ellipse
                    key={`b${cy}`}
                    style={art.ac}
                    cx="48"
                    cy={cy}
                    {...NOTEHEAD}
                    transform={`rotate(-20 48 ${cy})`}
                />
            ))}
        </Drawing>
    );
}
