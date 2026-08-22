// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { usePrefs } from "../../hooks/usePrefs";
import type { Take } from "../../../core/takes";
import { useTakesStore } from "../../contexts/services";
import { useKnownPieces } from "../../hooks/useKnownPieces";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { linkClasses, sectionHeadingClasses } from "../ui/classes";
import { BakedIncipit } from "../ui/incipit";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { formatAgo } from "./takesPanel";

// Every piece you have recorded yourself playing, newest first.
//
// A take was reachable only from the piece it belongs to: you had to remember which piece
// it was, find it, open it and switch to its runs. Nothing anywhere listed them, so a
// recording somebody was proud of was one forgotten title away from being lost. It
// belongs on Music, beside the scores you brought and the music you compose — one shelf
// for everything of your own.
export function YourTakes() {
    // The reading aid that colours noteheads in a score colours these opening bars
    // too, read once for the whole list rather than per mark.
    const { prefs } = usePrefs();
    const takes = useTakesStore();
    const { titleOf, incipitOf } = useKnownPieces();
    const [pieces, setPieces] = useState(() => takes.all());

    useEffect(() => takes.subscribe(() => setPieces(takes.all())), [takes]);

    if (pieces.length === 0) {
        return null;
    }

    const now = Date.now();
    return (
        <section className="space-y-2">
            {/* The heading belongs to the list, so a device with nothing recorded gets
                neither — a section header over an empty space is the frame promising
                insight it does not have. */}
            <h2 className={sectionHeadingClasses}>{m.takes_panel_heading()}</h2>
            <ul className="space-y-1">
                {pieces.map(({ songId, takes: saved }: { songId: string; takes: Take[] }) => (
                    <li key={songId} className="flex items-center gap-2 py-1">
                        <BakedIncipit
                            mark={incipitOf(songId)}
                            label={titleOf(songId) ?? songId}
                            colored={prefs.colorNotes}
                            className="text-faint"
                        />
                        <Link to={`/play/${songId}?tab=runs`} className={`min-w-0 ${linkClasses}`}>
                            <span className="truncate">{titleOf(songId) ?? songId}</span>
                        </Link>
                        <span className="ml-auto shrink-0 text-xs text-muted">
                            {m.takes_heading({ count: saved.length })}
                            {" · "}
                            {formatAgo(saved[0]?.createdAt ?? now, now, getLocale())}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
