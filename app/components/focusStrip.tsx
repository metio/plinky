// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useEffect, useRef, useState } from "react";
import { NOTE_COLOR, WINDOW_COLOR } from "../../core/scoreCanvas";
import { paintMeasureRange, scrollMeasureIntoView } from "../lib/scoreColor";

// A compact, always-visible strip of the piece pinned just above the on-screen keyboard
// while practising: it shows the bar you're playing (and its neighbour) big and lit, and
// slides to follow the cursor — so on a phone the notes you need sit right above the
// keys instead of scrolling off behind them. `bar` is the 0-based bar the matcher cursor
// is in. Its own OSMD instance (the matcher's progress stays on the full score), mounted
// only while practising, so it costs nothing the rest of the time.
export function FocusStrip({ xml, bar, label }: { xml: string; bar: number; label: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const [ready, setReady] = useState(false);

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
                // Two bars per row so the current bar reads large in the short strip.
                (
                    osmd as unknown as { rules: { RenderXMeasuresPerLineAkaSystem: number } }
                ).rules.RenderXMeasuresPerLineAkaSystem = 2;
                return osmd.load(xml).then(() => {
                    if (!cancelled) {
                        osmd.render();
                        setReady(true);
                    }
                });
            })
            // A render failure just leaves the strip empty; the full score is the fallback.
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [xml]);

    // Light the current two bars and slide them to the centre as the cursor advances.
    useEffect(() => {
        const osmd = osmdRef.current;
        const container = containerRef.current;
        if (!ready || !osmd || !container) {
            return;
        }
        paintMeasureRange(osmd, 0, Number.POSITIVE_INFINITY, NOTE_COLOR);
        paintMeasureRange(osmd, bar, bar + 2, WINDOW_COLOR);
        scrollMeasureIntoView(osmd, bar, container);
    }, [bar, ready]);

    useEffect(() => () => osmdRef.current?.clear(), []);

    return (
        <div
            ref={containerRef}
            role="img"
            aria-label={label}
            className="no-scrollbar max-h-[150px] overflow-auto rounded-md border border-indigo-200 bg-white p-2 dark:border-indigo-900"
        />
    );
}
