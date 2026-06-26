// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

// The colour a note turns once it has been played, marking progress on the score.
export const PLAYED_COLOR = "#22c55e";

// OSMD's graphical notes expose their rendered SVG group only on the VexFlow
// subclass; the cursor hands back the base type, so reach the accessor by shape.
type WithSvg = { getSVGGElement?: () => SVGGElement };

// Paints the noteheads at the cursor's current position whose pitch was just
// played. It mutates the already-rendered SVG directly — colouring per note via
// NoteheadColor would force a full re-render, which would flicker and lose the
// cursor every note. A note with no rendered element yet is skipped.
export function paintPlayedNotes(
    osmd: OpenSheetMusicDisplay,
    pitches: number[],
    color: string = PLAYED_COLOR,
): void {
    for (const gNote of osmd.cursor.GNotesUnderCursor()) {
        if (!pitches.includes(gNote.sourceNote.halfTone + 12)) {
            continue;
        }
        let element: SVGGElement | undefined;
        try {
            element = (gNote as unknown as WithSvg).getSVGGElement?.();
        } catch {
            element = undefined;
        }
        if (!element) {
            continue;
        }
        // VexFlow sets an explicit fill on the glyph paths, so colouring the group
        // alone wouldn't cascade — paint the group and every descendant.
        element.setAttribute("fill", color);
        for (const child of element.querySelectorAll("*")) {
            child.setAttribute("fill", color);
        }
    }
}
