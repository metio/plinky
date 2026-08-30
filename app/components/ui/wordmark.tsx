// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DOMAIN, TITTLE, tittleFromBoxTop, WORDMARK } from "../../../core/wordmark";

// The name, set with the plink where the face's own tittle would be.
//
// A component rather than markup inside the header, because the mark is not the header's:
// the header wears it, the promo thumbnails set it, and an exported video's canvas draws
// it. Sharing only the numbers left three places each building their own spans, and one
// of them was free to get the anchoring wrong — which is how the header and the thumbnails
// came to sit the dot 0.02em apart.
//
// The stem is a DOTLESS ı, so the drawn plink is the only dot. Decorative by default: the
// name is set in text a screen reader would read letter-perfect anyway, and every caller so
// far sits it inside a link that carries the accessible name. A caller that needs it to be
// announced passes `label`.
export function Wordmark({
    domain = false,
    label,
    className = "",
}: {
    // Whether the address rides along as the mark's own tail. One lockup, not the mark
    // plus "plinky.fun" beside it — that writes the name twice.
    domain?: boolean;
    // An accessible name, when this is not sitting inside something that already carries
    // one. Absent, the mark is hidden from assistive tech as decoration.
    label?: string;
    className?: string;
}) {
    return (
        <span
            {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" })}
            className={`font-display font-semibold tracking-tight text-ink ${className}`}
        >
            {WORDMARK.before}
            <span className="relative">
                {WORDMARK.stem}
                {/* Anchored to the inline box's top, which is the end CSS gives us here;
                    core/wordmark converts from the baseline the face measures against. */}
                <span
                    className="absolute left-1/2 -translate-x-1/2 rounded-full bg-plink"
                    style={{
                        top: `${tittleFromBoxTop()}em`,
                        width: `${TITTLE.size}em`,
                        height: `${TITTLE.size}em`,
                    }}
                />
            </span>
            {WORDMARK.after}
            {domain ? DOMAIN : null}
        </span>
    );
}
