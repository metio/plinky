// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { Hand } from "../hooks/useScoreMatcher";

// The colour a note turns once it has been played, marking progress on the score.
export const PLAYED_COLOR = "#22c55e";
// The colour marking where the racing ghost currently is, distinct from played
// (green) and the score's own black so all three read apart at a glance.
export const GHOST_COLOR = "#a855f7";
// The score is always rendered on white, so an unplayed note is plain black.
export const NOTE_COLOR = "#000000";
// The active window in a read-only context staff — the bars currently being fingered
// or heard, indigo to match the app's accent and stand out from the black notes.
export const WINDOW_COLOR = "#6366f1";

// Which staff (treble = 0, bass = 1) each hand reads from — mirrors the matcher,
// so the notes collected for the ghost line up with the positions it counts.
const STAFF_FOR: Record<Exclude<Hand, "both">, number> = { right: 0, left: 1 };

// OSMD's graphical notes expose their rendered SVG group only on the VexFlow
// subclass; the cursor hands back the base type, so reach the accessor by shape.
type WithSvg = { getSVGGElement?: () => SVGGElement };

function svgOf(gNote: unknown): SVGGElement | undefined {
    try {
        return (gNote as WithSvg).getSVGGElement?.();
    } catch {
        return undefined;
    }
}

// VexFlow sets an explicit fill on each glyph path, so the group's colour doesn't
// cascade — paint the group and every descendant.
export function paintElement(element: SVGGElement, color: string): void {
    element.setAttribute("fill", color);
    for (const child of element.querySelectorAll("*")) {
        child.setAttribute("fill", color);
    }
}

// The rendered SVG groups of the playable notes at each step, in the same order
// and with the same hand filter the matcher steps through — so index i here is the
// note the ghost's i-th onset belongs to. Leaves the cursor reset for the caller.
export function collectNoteElements(osmd: OpenSheetMusicDisplay, hand: Hand): SVGGElement[][] {
    const steps: SVGGElement[][] = [];
    // The graphical notes under the cursor are only exposed once it's shown, so
    // make it visible before walking; the matcher reshows and repositions it after.
    osmd.cursor.show();
    osmd.cursor.reset();
    while (!osmd.cursor.iterator.EndReached) {
        const elements: SVGGElement[] = [];
        for (const gNote of osmd.cursor.GNotesUnderCursor()) {
            const note = gNote.sourceNote;
            if (note.isRest() || note.halfTone <= 0) {
                continue;
            }
            if (hand !== "both" && note.ParentStaff?.idInMusicSheet !== STAFF_FOR[hand]) {
                continue;
            }
            const element = svgOf(gNote);
            if (element) {
                elements.push(element);
            }
        }
        if (elements.length > 0) {
            steps.push(elements);
        }
        osmd.cursor.next();
    }
    osmd.cursor.reset();
    return steps;
}

// Paints every note in a half-open range of measures (0-based, matching scoreToBars'
// bar index) one colour, leaving the rest untouched — used to light up the active
// window in a read-only context staff. Walks the cursor, so it leaves it reset+hidden.
export function paintMeasureRange(
    osmd: OpenSheetMusicDisplay,
    from: number,
    to: number,
    color: string,
): void {
    osmd.cursor.show();
    osmd.cursor.reset();
    while (!osmd.cursor.iterator.EndReached) {
        const measure = osmd.cursor.iterator.CurrentMeasureIndex;
        if (measure >= from && measure < to) {
            for (const gNote of osmd.cursor.GNotesUnderCursor()) {
                const element = svgOf(gNote);
                if (element) {
                    paintElement(element, color);
                }
            }
        }
        osmd.cursor.next();
    }
    osmd.cursor.reset();
    osmd.cursor.hide();
}

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
        const element = svgOf(gNote);
        if (element) {
            paintElement(element, color);
        }
    }
}
