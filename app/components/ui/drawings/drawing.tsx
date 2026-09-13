// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CSSProperties, ReactNode } from "react";

// The drawings are one hand: a 72×56 grid, one 2.2 stroke with round ends and joins, a soft
// ground behind the object and one accent, with staff lines drawn thinner than the objects.
//
// Every colour is a CSS variable whose fallback is a token, so on the page a drawing follows
// the palette and the mode by itself. A surface whose own ground does not follow the mode —
// a piano key stays white in the dark — sets the variables to inks that read on it.
const STROKE = "var(--art-stroke, var(--color-accent))";
const GROUND = "var(--art-fill, var(--color-accent-fill))";
const ACCENT = "var(--art-accent, var(--color-accent-soft))";
const PAPER = "var(--art-paper, var(--color-raised))";

const LINE = {
    fill: "none",
    strokeWidth: 2.2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const;

// The seven ways a mark can be painted, named as the drawings use them.
export const art = {
    // The object's outline.
    st: { ...LINE, stroke: STROKE },
    // A staff line: thinner and fainter than what sits on it.
    thin: { ...LINE, stroke: STROKE, strokeWidth: 1.3, opacity: 0.75 },
    // The soft ground behind the object.
    fl: { fill: GROUND },
    // A filled accent.
    ac: { fill: ACCENT },
    // A stroked accent.
    acs: { ...LINE, stroke: ACCENT },
    // A sheet of paper or a body: filled, and outlined like the object.
    pp: { fill: PAPER, stroke: STROKE, strokeWidth: 2.2, strokeLinejoin: "round" },
    // A notehead or a dot, in the outline's colour.
    dot: { fill: STROKE },
} satisfies Record<string, CSSProperties>;

export type DrawingProps = { className?: string };

// Decorative by definition: the words beside a drawing carry the meaning, so it is hidden
// from assistive technology and never takes focus.
export function Drawing({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <svg viewBox="0 0 72 56" aria-hidden="true" focusable="false" className={className}>
            {children}
        </svg>
    );
}
