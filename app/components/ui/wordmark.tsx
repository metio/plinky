// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DOMAIN, WORDMARK } from "../../../core/wordmark";

// The name, set the way the mark sets it: Fredoka at weight 600, in the brand's own ink.
//
// A component rather than markup inside the header, because the name is not the header's:
// the header wears it and the stories judge it, and the outlined lockups in brand/mark set
// the same face with the same spacing (core/wordmark). The ink is --color-brand-ink, which
// belongs to the mark and so stays the same whatever palette a player picks. The tracking is
// core/wordmark's TRACKING: none on a light ground, 0.05em once the ground turns dark.
//
// Decorative by default: every caller so far sits it inside a link that carries the
// accessible name. A caller that needs it announced passes `label`.
export function Wordmark({
    domain = false,
    label,
    className = "",
}: {
    // Whether the address rides along as the name's own tail. One lockup, not the name plus
    // "plinky.fun" beside it — that writes the name twice.
    domain?: boolean;
    // An accessible name, when this is not sitting inside something that already carries
    // one. Absent, the name is hidden from assistive tech as decoration.
    label?: string;
    className?: string;
}) {
    return (
        <span
            {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" })}
            className={`font-display font-semibold tracking-normal text-brand-ink dark:tracking-[0.05em] ${className}`}
        >
            {WORDMARK}
            {domain ? DOMAIN : null}
        </span>
    );
}
