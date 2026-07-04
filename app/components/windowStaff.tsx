// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useEffect, useRef, useState } from "react";
import { NOTE_COLOR, WINDOW_COLOR } from "../../core/scoreCanvas";
import { paintMeasureRange } from "../lib/scoreColor";

// A read-only staff of the whole piece with the active window of bars lit up, so a
// drill that works on a two-bar slice still shows where that slice sits in the music.
// The half-open [from, to) range is in 0-based bar indices, matching scoreToBars. OSMD
// needs a real DOM and is large, so it loads on the client only.
export function WindowStaff({
    xml,
    from,
    to,
    label,
}: {
    xml: string;
    from: number;
    to: number;
    label: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const [ready, setReady] = useState(false);

    // Load and render the whole piece once; re-render only when the piece changes.
    useEffect(() => {
        let cancelled = false;
        setReady(false);
        import("opensheetmusicdisplay")
            .then(({ OpenSheetMusicDisplay }) => {
                if (cancelled || !containerRef.current) {
                    return;
                }
                osmdRef.current ??= new OpenSheetMusicDisplay(containerRef.current, {
                    autoResize: true,
                    drawingParameters: "compact",
                });
                const osmd = osmdRef.current;
                return osmd.load(xml).then(() => {
                    if (!cancelled) {
                        osmd.render();
                        setReady(true);
                    }
                });
            })
            // A render failure leaves the drill below as the usable fallback.
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [xml]);

    // Move the highlight as the window slides — reset the whole piece to black, then
    // paint the active bars, without the flicker of a full reload.
    useEffect(() => {
        const osmd = osmdRef.current;
        if (!ready || !osmd) {
            return;
        }
        paintMeasureRange(osmd, 0, Number.POSITIVE_INFINITY, NOTE_COLOR);
        paintMeasureRange(osmd, from, to, WINDOW_COLOR);
    }, [from, to, ready]);

    useEffect(() => () => osmdRef.current?.clear(), []);

    return (
        <div
            ref={containerRef}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a horizontally scrollable region needs keyboard access
            tabIndex={0}
            role="img"
            aria-label={label}
            className="no-scrollbar overflow-x-auto rounded-md border border-gray-200 bg-white p-2 dark:border-gray-800"
        />
    );
}
