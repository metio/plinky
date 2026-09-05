// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useEffect, useRef, useState } from "react";
import { WINDOW_COLOR } from "../../../core/scoreCanvas";
import { clearAllHalos, focusMeasures } from "../../lib/scoreColor";
import { useAsyncEffect } from "../../hooks/useAsyncEffect";

// A compact, always-visible strip of the piece pinned just above the on-screen keyboard
// while practising: it shows the bar you're playing (and its neighbour) big and lit, and
// follows the cursor — so on a phone the notes you need sit right above the keys instead
// of scrolling off behind them. `bar` is the 0-based bar the matcher cursor is in. Its
// own OSMD instance (the matcher's progress stays on the full score), mounted only while
// practising, so it costs nothing the rest of the time.
//
// Only the two bars are engraved. The whole piece is parsed once, since the engraver
// reads nothing less, but drawing it all a second time beside the full score was a
// second engraving of a long piece on a phone for a strip that ever shows two bars of
// it; each bar change now engraves two bars, restating the clef, key and metre at their
// start, which is also what makes them readable as a piece in their own right.
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

    // The bar the strip is drawn around, read live by the loader so a bar change while
    // the engraver is still arriving is not drawn one bar behind.
    const barRef = useRef(bar);
    barRef.current = bar;
    // Which bar the current engraving is of, so a re-render is asked for on a change of
    // bar and not again when readiness flips after the load already drew it.
    const drawnRef = useRef<number | null>(null);

    useAsyncEffect(
        (alive) => {
            setReady(false);
            drawnRef.current = null;
            import("opensheetmusicdisplay")
                .then(({ OpenSheetMusicDisplay }) => {
                    if (!alive() || !containerRef.current) {
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
                        if (alive()) {
                            drawWindow(osmd, barRef.current);
                            drawnRef.current = barRef.current;
                            setReady(true);
                            setRenders((count) => count + 1);
                        }
                    });
                })
                // A render failure just leaves the strip empty; the full score is the fallback.
                .catch(() => {});
        },
        [xml],
    );

    // Engrave the next two bars as the cursor advances.
    useEffect(() => {
        const osmd = osmdRef.current;
        if (!ready || !osmd || drawnRef.current === bar) {
            return;
        }
        drawWindow(osmd, bar);
        drawnRef.current = bar;
        setRenders((count) => count + 1);
    }, [bar, ready]);

    // Light the two bars just drawn.
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

// Draw only the bar and its neighbour. OSMD's range is in 1-based measure numbers; the
// options can be set after the load and take effect on the next render.
function drawWindow(osmd: OpenSheetMusicDisplay, bar: number): void {
    osmd.setOptions({ drawFromMeasureNumber: bar + 1, drawUpToMeasureNumber: bar + 2 });
    osmd.render();
}
