// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { m } from "../../paraglide/messages.js";

// The staff a piece is about to appear on, drawn while it is still being fetched and set.
//
// A piece is expensive to open — a megabyte of engraver, the catalogue, the notation, and
// then the engraving itself — and on a slow device that is several seconds. What stood here
// before was nothing at all: a blank page, then a blank box, with no sign that anything was
// happening. So the wait is drawn as the thing being waited for. Five hairlines in the
// score's own slot, a band travelling along them, and a word for which part of the wait this
// is — because "still fetching" and "nearly drawn" are different news to somebody deciding
// whether to give up.
//
// It fills its parent rather than setting its own height: the score box already reserves the
// staff area to keep the page from shifting when the notation lands, and a placeholder with
// a height of its own would defeat that.
export function ScoreSkeleton({ engraving = false }: { engraving?: boolean }) {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6">
            <div className="relative w-full max-w-xl overflow-hidden" aria-hidden="true">
                <div className="flex flex-col gap-2 py-2">
                    {[0, 1, 2, 3, 4].map((line) => (
                        <div key={line} className="h-px w-full bg-line" />
                    ))}
                </div>
                {/* The travelling band. Placed over the staff rather than tinting it, so the
                lines keep their weight and the movement reads as light passing across. */}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-sight-read bg-gradient-to-r from-transparent via-accent-surface to-transparent motion-reduce:animate-none" />
            </div>
            <p role="status" className="text-sm text-muted">
                {engraving ? m.score_loading_engraving() : m.score_loading_fetching()}
            </p>
        </div>
    );
}
