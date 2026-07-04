// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { Hand } from "../hooks/useScoreMatcher";
import { type MeasureBox, NOTE_COLOR, PLAYED_COLOR, SELECT_COLOR } from "../../core/scoreCanvas";

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
        let playable = false;
        for (const gNote of osmd.cursor.GNotesUnderCursor()) {
            const note = gNote.sourceNote;
            if (note.isRest() || note.halfTone <= 0) {
                continue;
            }
            if (hand !== "both" && note.ParentStaff?.idInMusicSheet !== STAFF_FOR[hand]) {
                continue;
            }
            // This position counts as a step the moment it holds a playable note,
            // matching the matcher's collectSteps. The SVG group may be missing (a
            // note OSMD didn't render a glyph for); push the step regardless so a
            // bare position can't shift every later ghost marker onto the wrong note.
            playable = true;
            const element = svgOf(gNote);
            if (element) {
                elements.push(element);
            }
        }
        if (playable) {
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

// A measure's rendered box in the SVG's own coordinate space, unioned over every note
// and rest it holds — enough to place a highlight behind the bar and to map a click to
// it. `measure` is the 0-based index matching scoreToBars / the cursor's measure index.

// The SVG's client rectangle plus the factor from rendered pixels to its own user units,
// so a click position and the note boxes share one coordinate space. OSMD renders 1:1
// (no viewBox) in the normal case, where the factor is simply 1.
function svgScale(svg: SVGSVGElement): { rect: DOMRect; sx: number; sy: number } {
    const rect = svg.getBoundingClientRect();
    const box = svg.viewBox.baseVal;
    return {
        rect,
        sx: rect.width > 0 && box.width > 0 ? box.width / rect.width : 1,
        sy: rect.height > 0 && box.height > 0 ? box.height / rect.height : 1,
    };
}

// Converts a viewport (client) point — e.g. a click — into the SVG's own coordinate
// space, the space the measure boxes live in.
export function clientPointToSvg(
    svg: SVGSVGElement,
    clientX: number,
    clientY: number,
): { x: number; y: number } {
    const { rect, sx, sy } = svgScale(svg);
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

// The rendered box of each measure, in the SVG's coordinate space, unioned over its notes
// and rests. Walks the cursor (leaving it reset+hidden), reading each glyph group's client
// rect and folding it into that measure's bounds — measured once per render and reused for
// both the selection overlay and click hit-testing.
export function collectMeasureBoxes(osmd: OpenSheetMusicDisplay, svg: SVGSVGElement): MeasureBox[] {
    const { rect: svgRect, sx, sy } = svgScale(svg);
    const bounds = new Map<number, { minX: number; minY: number; maxX: number; maxY: number }>();
    // Walking the cursor would otherwise make OSMD scroll the staff to follow it — an
    // unwanted jump on every render just to measure. Suspend the follow for the walk.
    const follow = osmd.FollowCursor;
    osmd.FollowCursor = false;
    osmd.cursor.show();
    osmd.cursor.reset();
    while (!osmd.cursor.iterator.EndReached) {
        const measure = osmd.cursor.iterator.CurrentMeasureIndex;
        for (const gNote of osmd.cursor.GNotesUnderCursor()) {
            const element = svgOf(gNote);
            if (!element) {
                continue;
            }
            const box = element.getBoundingClientRect();
            const x1 = (box.left - svgRect.left) * sx;
            const y1 = (box.top - svgRect.top) * sy;
            const x2 = (box.right - svgRect.left) * sx;
            const y2 = (box.bottom - svgRect.top) * sy;
            const bound = bounds.get(measure);
            if (!bound) {
                bounds.set(measure, { minX: x1, minY: y1, maxX: x2, maxY: y2 });
            } else {
                bound.minX = Math.min(bound.minX, x1);
                bound.minY = Math.min(bound.minY, y1);
                bound.maxX = Math.max(bound.maxX, x2);
                bound.maxY = Math.max(bound.maxY, y2);
            }
        }
        osmd.cursor.next();
    }
    osmd.cursor.reset();
    osmd.cursor.hide();
    osmd.FollowCursor = follow;
    return [...bounds.entries()].map(([measure, b]) => ({
        measure,
        x: b.minX,
        y: b.minY,
        width: b.maxX - b.minX,
        height: b.maxY - b.minY,
    }));
}

// Fills the chosen inclusive range of 0-based measures with a translucent backdrop rect
// behind the notes, so the selected bars read as coloured. The rects are tagged and
// inserted at the back of the SVG; clearBarSelection lifts them. Idempotent — it clears
// any prior selection first.
const SELECTION_CLASS = "plinky-bar-selection";

export function clearBarSelection(svg: SVGSVGElement): void {
    for (const rect of svg.querySelectorAll(`.${SELECTION_CLASS}`)) {
        rect.remove();
    }
}

export function paintBarSelection(
    svg: SVGSVGElement,
    boxes: MeasureBox[],
    from: number,
    to: number,
    color: string = SELECT_COLOR,
): void {
    clearBarSelection(svg);
    const pad = 6; // a little breathing room so the fill reads as a bar, not a tight box
    for (const box of boxes) {
        if (box.measure < from || box.measure > to) {
            continue;
        }
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("class", SELECTION_CLASS);
        rect.setAttribute("x", String(box.x - pad));
        rect.setAttribute("y", String(box.y - pad));
        rect.setAttribute("width", String(box.width + pad * 2));
        rect.setAttribute("height", String(box.height + pad * 2));
        rect.setAttribute("rx", "4");
        rect.setAttribute("fill", color);
        rect.setAttribute("fill-opacity", "0.2");
        // The backdrop must never eat clicks meant for selecting a bar.
        rect.setAttribute("pointer-events", "none");
        svg.insertBefore(rect, svg.firstChild);
    }
}

// One note and the fill it wore before being highlighted, so the highlight can be
// lifted without assuming the note was plain black (it may already be played-green).
export type PaintedNote = { element: SVGGElement; fill: string };

// Paints the playable notes at the cursor's current position an "active" colour and
// returns them with their prior fill, so the caller can restore them as the cursor
// moves on — the moving highlight that follows Listen playback. Like paintPlayedNotes,
// it mutates the rendered SVG directly rather than re-rendering, which would lose the
// cursor every note.
export function highlightCursorNotes(osmd: OpenSheetMusicDisplay, color: string): PaintedNote[] {
    const painted: PaintedNote[] = [];
    for (const gNote of osmd.cursor.GNotesUnderCursor()) {
        const note = gNote.sourceNote;
        if (note.isRest() || note.halfTone <= 0) {
            continue;
        }
        const element = svgOf(gNote);
        if (element) {
            painted.push({ element, fill: element.getAttribute("fill") ?? NOTE_COLOR });
            paintElement(element, color);
        }
    }
    return painted;
}

// Restores notes lifted by highlightCursorNotes to the fill they wore before.
export function restoreNotes(painted: PaintedNote[]): void {
    for (const { element, fill } of painted) {
        paintElement(element, fill);
    }
}

// Scrolls a measure to the vertical centre of its own container — used by the focus
// strip to slide to the bar being played. Scrolls the container directly (not
// scrollIntoView, which would also scroll the page). Walks the cursor to the measure to
// find a rendered note there; leaves the cursor reset and hidden.
export function scrollMeasureIntoView(
    osmd: OpenSheetMusicDisplay,
    measure: number,
    container: HTMLElement,
): void {
    osmd.cursor.show();
    osmd.cursor.reset();
    while (!osmd.cursor.iterator.EndReached && osmd.cursor.iterator.CurrentMeasureIndex < measure) {
        osmd.cursor.next();
    }
    for (const gNote of osmd.cursor.GNotesUnderCursor()) {
        const element = svgOf(gNote);
        if (element) {
            const elementRect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const top =
                elementRect.top -
                containerRect.top +
                container.scrollTop -
                (container.clientHeight - elementRect.height) / 2;
            // Set scrollTop directly (not scrollTo's smooth, which headless browsers may
            // drop). The bar only changes a few times a piece, so a jump reads fine.
            container.scrollTop = Math.max(0, top);
            break;
        }
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
