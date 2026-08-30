// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { sectionLabelClasses } from "./classes";

// How a page introduces itself: an optional line of small caps above, the title in the
// display face, an optional line under it, and an optional control on the right.
//
// Every page wrote this out itself, and twenty-two copies drifted — three spacings, two
// pages with no header at all, and three different things floating beside a title with no
// slot to sit in. One component means the shell reads as one piece: whichever page you
// land on, its name is in the same place, at the same size, with the same air beneath it.
export function PageHeader({
    eyebrow,
    title,
    hint,
    actions,
}: {
    eyebrow?: string;
    title: ReactNode;
    hint?: ReactNode;
    // Sits opposite the title on a wide screen and wraps under it on a narrow one — an
    // export button, a recording pill, a counter.
    actions?: ReactNode;
}) {
    return (
        <header className="space-y-1">
            {eyebrow ? <p className={sectionLabelClasses}>{eyebrow}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                {/* Long single words — "Политика конфиденциальности", "Datenschutzerklärung"
                    — are wider at this size than a small phone, and a title has nowhere else
                    to go. Breaking only happens where it must — and min-w-0 is what lets it:
                    overflow-wrap permits a break during layout without reducing the
                    min-content width a flex item is sized from, so the pair is needed. */}
                <h1 className="min-w-0 font-display text-3xl font-semibold tracking-tight break-words">
                    {title}
                </h1>
                {actions}
            </div>
            {hint ? <p className="text-sm text-muted">{hint}</p> : null}
        </header>
    );
}
