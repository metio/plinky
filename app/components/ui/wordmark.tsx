// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Fragment } from "react";
import { DOMAIN, TITTLE, WORDMARK_PARTS } from "../../../core/wordmark";

// The name, set the way the mark sets it: Fredoka at weight 600, in the brand's own ink, with
// a round fuchsia dot over each i.
//
// A component rather than markup inside the header, because the name is not the header's:
// the header wears it and the stories judge it, and the outlined name the social kit sets
// (brand/name-white.svg) has the same face, the same spacing and the same dot
// (core/wordmark). The ink is
// --color-brand-ink and the dot --color-brand-dot; both belong to the mark and so stay the
// same whatever palette a player picks. The tracking is core/wordmark's TRACKING: none on a
// light ground, 0.05em once the ground turns dark.
//
// Every stem is a DOTLESS ı, so the drawn dots are the only ones. Each is placed from the
// baseline, where the face measures its own tittle: a zero-size inline block just before the
// ı sits on the baseline at the ı's left edge, and the dot hangs off it. Anchoring to the
// text's own box instead would rest on the face's ascent, which the browser rounds and reports
// differently, and the tracking added after each letter would widen that box and pull the dot
// off the stem. The anchors are inline blocks, which a line may break beside, so the name is
// set nowrap: otherwise a tight header row splits it into "Kl" over "ımpı".
//
// Decorative by default: every caller so far sits it inside a link that carries the
// accessible name. A caller that needs it announced passes `label`, and the label is what is
// heard, never the dotless letters the name is drawn with.
export function Wordmark({
    domain = false,
    label,
    className = "",
}: {
    // Whether the address rides along as the name's own tail. One lockup, not the name plus
    // "klimpi.app" beside it — that writes the name twice.
    domain?: boolean;
    // An accessible name, when this is not sitting inside something that already carries
    // one. Absent, the name is hidden from assistive tech as decoration.
    label?: string;
    className?: string;
}) {
    return (
        <span
            {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" })}
            className={`font-display font-semibold tracking-normal whitespace-nowrap text-brand-ink dark:tracking-[0.05em] ${className}`}
        >
            {WORDMARK_PARTS.runs.map((run, at) => (
                // The runs are a fixed description of one name, so their position is their
                // identity; nothing reorders or filters them.
                // biome-ignore lint/suspicious/noArrayIndexKey: the list is a constant
                <Fragment key={at}>
                    {run}
                    {at < WORDMARK_PARTS.runs.length - 1 ? (
                        <>
                            <span className="relative inline-block h-0 w-0 align-baseline">
                                <span
                                    className="absolute -translate-x-1/2 rounded-full bg-brand-dot"
                                    style={{
                                        left: `${TITTLE.stemCentre}em`,
                                        bottom: `${TITTLE.baseAbove}em`,
                                        width: `${TITTLE.size}em`,
                                        height: `${TITTLE.size}em`,
                                    }}
                                />
                            </span>
                            {WORDMARK_PARTS.stem}
                        </>
                    ) : null}
                </Fragment>
            ))}
            {domain ? DOMAIN : null}
        </span>
    );
}
