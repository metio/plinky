// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useEffect, useRef } from "react";

// A read-only staff: loads MusicXML into OpenSheetMusicDisplay and renders it, with
// none of the playback or matching the full viewer carries. OSMD needs a real DOM
// and is large, so it loads on the client only; nothing renders during prerender.
export function StaffPreview({ xml, label }: { xml: string; label: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);

    useEffect(() => {
        let cancelled = false;
        import("opensheetmusicdisplay")
            .then(({ OpenSheetMusicDisplay }) => {
                if (cancelled || !containerRef.current) {
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
                    if (!cancelled) {
                        osmd.render();
                    }
                });
            })
            // A render failure leaves the chip picker below as the usable fallback,
            // so a broken staff need not be surfaced.
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [xml]);

    // Release OSMD (and its resize listener) when the preview unmounts.
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
