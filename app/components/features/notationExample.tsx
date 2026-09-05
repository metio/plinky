// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useEffect, useRef, useState } from "react";
import { m } from "../../paraglide/messages.js";

// A single bar of notation, drawn on the same engine as a real score.
//
// Held apart from useOsmdScore on purpose: that hook is the play surface's — a cursor
// walks it, a dozen reading preferences re-render it, and a matcher reads bar boxes off
// it. An example has none of that. It loads once, draws once, and is read rather than
// played, so it carries none of that machinery.
//
// The rendered SVG is a thicket of paths that a screen reader can only read as noise,
// so the figure carries the description as its label and hides its own contents.
export function NotationExample({ xml, label }: { xml: string; label: string }) {
    const hostRef = useRef<HTMLDivElement>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let display: OpenSheetMusicDisplay | null = null;
        setFailed(false);
        import("opensheetmusicdisplay")
            .then(async ({ OpenSheetMusicDisplay }) => {
                if (cancelled || !hostRef.current) {
                    return;
                }
                // No autoResize: it registers a window resize listener the engine never
                // removes, so every mount of an example left one behind for the life of
                // the tab. The host scrolls sideways, so a static render is the right one.
                display = new OpenSheetMusicDisplay(hostRef.current, {
                    autoResize: false,
                    drawingParameters: "compact",
                    drawTitle: false,
                    drawPartNames: false,
                    drawCredits: false,
                    followCursor: false,
                });
                await display.load(xml);
                if (cancelled) {
                    return;
                }
                display.render();
            })
            .catch(() => {
                if (!cancelled) {
                    setFailed(true);
                }
            });
        return () => {
            cancelled = true;
            // OSMD leaves its SVG behind on unmount, and a remount would draw a second
            // one beside it. Tearing down mid-load reaches an engine part-way through
            // reading a file, which is its own business to complain about — and a throw
            // from a cleanup function would take the unmount down with it.
            try {
                display?.clear();
            } catch {
                // Nothing to salvage: the element is going away regardless.
            }
        };
    }, [xml]);

    return (
        // The warm paper field, soft lift and inset hairline are the play surface's
        // engraved-plate frame: an example should look like the page it prepares you to
        // read. Paper stays light in both themes, as it does there.
        <figure className="relative rounded-xl bg-paper p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_12px_32px_-14px_rgba(0,0,0,0.20)]">
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-2 rounded-lg border border-paper-line/70"
            />
            {failed ? (
                // The same reserved height as the drawing, so failing to draw doesn't
                // shift the buttons below into a different place than success does.
                <p className="flex min-h-24 items-center justify-center px-2 text-center text-sm text-muted">
                    {m.glossary_example_unavailable()}
                </p>
            ) : (
                <div
                    ref={hostRef}
                    role="img"
                    aria-label={label}
                    // The engine loads and draws after the page has painted, so the slot
                    // holds a bar's worth of height from the start. Without it the buttons
                    // below sit under an empty box and get shoved down when the staff
                    // arrives — a jump right where the reader is about to press.
                    className="min-h-24 overflow-x-auto [&_svg]:!h-auto"
                />
            )}
        </figure>
    );
}
