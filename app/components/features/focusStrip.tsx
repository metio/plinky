// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useEffect, useRef, useState } from "react";
import { WINDOW_COLOR } from "../../../core/scoreCanvas";
import { clearAllHalos, focusMeasures } from "../../lib/scoreColor";

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
    // Raised each time the strip finishes a render, and what the halo painting below waits
    // on. `ready` alone cannot serve as that signal: a reload sets it false and then true
    // again, and where those land without a committed render between them — a two-bar strip
    // whose module is already imported resolves very fast — the value never appears to
    // change, the painting effect's dependencies look untouched, and the freshly rendered
    // bars keep none of their highlight.
    const [renders, setRenders] = useState(0);

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
                        setRenders((count) => count + 1);
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
    //
    // `renders` is not read in the body — it is the trigger, standing for "the strip drew
    // itself again", which is when the halo has to go back on.
    // biome-ignore lint/correctness/useExhaustiveDependencies: renders is the render-completed trigger
    useEffect(() => {
        const osmd = osmdRef.current;
        const container = containerRef.current;
        if (!ready || !osmd || !container) {
            return;
        }
        const svg = container.querySelector("svg");
        if (svg instanceof SVGSVGElement) {
            clearAllHalos(svg);
        }
        focusMeasures(osmd, bar, bar + 2, WINDOW_COLOR, container);
    }, [bar, ready, renders]);

    useEffect(() => () => osmdRef.current?.clear(), []);

    return (
        <div
            ref={containerRef}
            role="img"
            aria-label={label}
            className="no-scrollbar max-h-[150px] overflow-auto rounded-md border border-accent-line bg-white p-2"
        />
    );
}
