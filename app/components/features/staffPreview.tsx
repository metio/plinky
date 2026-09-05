// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useEffect, useRef } from "react";
import { useAsyncEffect } from "../../hooks/useAsyncEffect";

// A read-only staff: loads MusicXML into OpenSheetMusicDisplay and renders it, with
// none of the playback or matching the full viewer carries. OSMD needs a real DOM
// and is large, so it loads on the client only; nothing renders during prerender.
export function StaffPreview({
    xml,
    label,
    onRendered,
}: {
    xml: string;
    label: string;
    // Called once the staff is actually on screen. A caller that reacts to the drawing
    // — scrolling to follow it as it grows — has to wait for this: the engraving happens
    // after a dynamic import and an async load, so anything measured before it reads the
    // previous staff's height.
    onRendered?: () => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);

    useAsyncEffect(
        (alive) => {
            import("opensheetmusicdisplay")
                .then(({ OpenSheetMusicDisplay }) => {
                    if (!alive() || !containerRef.current) {
                        return;
                    }
                    // Reuse one instance and reload it on each drill. A fresh instance per
                    // render leaves the previous staff in the container and draws the new
                    // one beneath it, so the staves pile up as the drill changes.
                    osmdRef.current ??= new OpenSheetMusicDisplay(containerRef.current, {
                        autoResize: true,
                        drawingParameters: "compact",
                    });
                    const osmd = osmdRef.current;
                    return osmd.load(xml).then(() => {
                        if (alive()) {
                            osmd.render();
                            onRendered?.();
                        }
                    });
                })
                // A render failure leaves the chip picker below as the usable fallback,
                // so a broken staff need not be surfaced.
                .catch(() => {});
        },
        [xml, onRendered],
    );

    // Release OSMD (and its resize listener) when the preview unmounts.
    useEffect(() => () => osmdRef.current?.clear(), []);

    return (
        <div
            ref={containerRef}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a horizontally scrollable region needs keyboard access
            tabIndex={0}
            role="img"
            aria-label={label}
            className="no-scrollbar overflow-x-auto rounded-md border border-line bg-white p-2"
        />
    );
}
