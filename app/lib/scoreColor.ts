// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { type Hand, STAFF_FOR } from "../../core/matcher";
import { type MeasureBox, NOTE_COLOR, PLAYED_COLOR, SELECT_COLOR } from "../../core/scoreCanvas";

// OSMD's graphical notes expose their rendered SVG only on the VexFlow subclass; the
// cursor hands back the base type, so reach the accessors by shape. getSVGGElement is the
// notehead group (a flag on an unbeamed short note rides inside it); getStemSVG is the
// stem, a separate element by id; getBeamSVGs are the beams joining short notes, each also
// a separate element by id — colouring the head group alone leaves the stem and beam black,
// so a coloured note reads as only a coloured dot.
type WithSvg = {
    getSVGGElement?: () => SVGGElement;
    getStemSVG?: () => Element | null;
    getBeamSVGs?: () => (Element | null)[];
};

function svgOf(gNote: unknown): SVGGElement | undefined {
    try {
        return (gNote as WithSvg).getSVGGElement?.();
    } catch {
        return undefined;
    }
}

function stemOf(gNote: unknown): SVGElement | undefined {
    try {
        const stem = (gNote as WithSvg).getStemSVG?.();
        return stem instanceof SVGElement ? stem : undefined;
    } catch {
        return undefined;
    }
}

function beamsOf(gNote: unknown): SVGElement[] {
    try {
        const beams = (gNote as WithSvg).getBeamSVGs?.() ?? [];
        return beams.filter((beam): beam is SVGElement => beam instanceof SVGElement);
    } catch {
        return [];
    }
}

// The rendered parts that make up one whole note: the notehead group and, when the note has
// them, the stem and beams it carries. A note OSMD drew no glyph for has no notehead, and
// counts as unrendered — no parts, so callers skip it whole. Elements are shared: a chord's
// noteheads share one stem, and a beam spans the whole group, so the same element can appear
// for several noteheads; painting or restoring it more than once is harmless.
function partsOf(gNote: unknown): SVGElement[] {
    const head = svgOf(gNote);
    if (!head) {
        return [];
    }
    const parts: SVGElement[] = [head];
    const stem = stemOf(gNote);
    if (stem) {
        parts.push(stem);
    }
    parts.push(...beamsOf(gNote));
    return parts;
}

// VexFlow gives each glyph its own explicit paint, so a colour set on the group doesn't
// cascade — set it on the element and every descendant. Both fill and stroke are set, so
// one call colours filled glyphs (noteheads, beams) and stroked ones (stems) alike.
function setColors(element: SVGElement, fill: string, stroke: string): void {
    element.setAttribute("fill", fill);
    element.setAttribute("stroke", stroke);
    for (const child of element.querySelectorAll("*")) {
        child.setAttribute("fill", fill);
        child.setAttribute("stroke", stroke);
    }
}

export function paintElement(element: SVGElement, color: string): void {
    setColors(element, color, color);
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
                for (const part of partsOf(gNote)) {
                    paintElement(part, color);
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

// One whole note captured before being highlighted: each of its parts (notehead group,
// stem) with the exact fill and stroke it wore, plus whether it already carried a mark —
// a practised green — rather than plain black. Grouping the parts lets the highlight lift
// back to precisely what was there, and lets the trail decide once per note (from the
// notehead) whether to keep the prior mark or lay its own, then apply that to the stem too.
type PaintedPart = { element: SVGElement; fill: string; stroke: string };
export type PaintedNote = { parts: PaintedPart[]; marked: boolean };

function capturePart(element: SVGElement): PaintedPart {
    return {
        element,
        fill: element.getAttribute("fill") ?? NOTE_COLOR,
        stroke: element.getAttribute("stroke") ?? NOTE_COLOR,
    };
}

function restorePart({ element, fill, stroke }: PaintedPart): void {
    setColors(element, fill, stroke);
}

// Paints the playable notes at the cursor's current position an "active" colour — whole
// note, stem and all — and returns them with their prior paint, so the caller can restore
// them as the cursor moves on: the moving highlight that follows Listen playback. Like
// paintPlayedNotes, it mutates the rendered SVG directly rather than re-rendering, which
// would lose the cursor every note.
export function highlightCursorNotes(osmd: OpenSheetMusicDisplay, color: string): PaintedNote[] {
    const painted: PaintedNote[] = [];
    // Capture every note's prior paint BEFORE painting any of them. A chord's noteheads are
    // separate gNotes that share one stem and beam, so painting note-by-note would let a
    // later notehead capture that shared element already in the highlight colour and record
    // it as the "prior" — restoreNotes would then leave the stem/beam stuck highlighted.
    // Capturing first means every note records the true original colour.
    for (const gNote of osmd.cursor.GNotesUnderCursor()) {
        const note = gNote.sourceNote;
        if (note.isRest() || note.halfTone <= 0) {
            continue;
        }
        const parts = partsOf(gNote).map(capturePart);
        const head = parts[0];
        if (!head) {
            continue;
        }
        // The notehead is the first part; its prior fill tells whether the note already
        // wore a mark, and the whole note follows that verdict.
        painted.push({ parts, marked: head.fill !== NOTE_COLOR });
    }
    for (const { parts } of painted) {
        for (const { element } of parts) {
            paintElement(element, color);
        }
    }
    return painted;
}

// Restores notes lifted by highlightCursorNotes to the paint they wore before.
export function restoreNotes(painted: PaintedNote[]): void {
    for (const { parts } of painted) {
        for (const part of parts) {
            restorePart(part);
        }
    }
}

// Leaves a persistent trail on notes the highlight is moving off: paints an untouched note
// (plain black) `color`, but keeps any prior mark — a practised green — so the trail records
// where the piece was heard without erasing where it was played. Used by Listen to lay down
// its blue trail as the cursor advances.
export function trailNotes(painted: PaintedNote[], color: string): void {
    for (const { parts, marked } of painted) {
        for (const part of parts) {
            if (marked) {
                restorePart(part);
            } else {
                paintElement(part.element, color);
            }
        }
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
        for (const part of partsOf(gNote)) {
            paintElement(part, color);
        }
    }
}
