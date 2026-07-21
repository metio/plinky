// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { type Hand, isPracticedHand } from "../../core/matcher";
import { type MeasureBox, PLAYED_COLOR, SELECT_COLOR } from "../../core/scoreCanvas";

// OSMD's graphical notes expose their rendered SVG only on the VexFlow subclass; the
// cursor hands back the base type, so reach the notehead group by shape. Feedback rides a
// halo behind this group rather than recolouring it, so the stem and beam — and the
// note's own pitch colour — are left untouched.
type WithSvg = {
    getSVGGElement?: () => SVGGElement;
};

function svgOf(gNote: unknown): SVGGElement | undefined {
    try {
        return (gNote as WithSvg).getSVGGElement?.();
    } catch {
        return undefined;
    }
}

// Hidden-notes practice: blank a step's noteheads so the player works by ear. The
// group stays in the layout (visibility, not display — spacing and the cursor are
// untouched), and revealing simply lifts the attribute and paints the verdict.
export function hideNoteElements(steps: SVGGElement[][]): void {
    for (const step of steps) {
        for (const element of step) {
            element.setAttribute("visibility", "hidden");
        }
    }
}

export function revealNoteElements(step: SVGGElement[], color: string): void {
    for (const element of step) {
        element.removeAttribute("visibility");
        litHalo(element, color);
    }
}

// Leaving the mode mid-run (or ending it) must never strand invisible music.
export function unhideNoteElements(steps: SVGGElement[][]): void {
    for (const step of steps) {
        for (const element of step) {
            element.removeAttribute("visibility");
        }
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
            if (!isPracticedHand(note.ParentStaff?.idInMusicSheet, hand)) {
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

// Haloes every note in a half-open range of measures (0-based, matching scoreToBars'
// bar index), leaving the rest untouched — used to light up the active window in a
// read-only context staff. Walks the cursor, so it leaves it reset+hidden. The caller
// clears the prior window (clearAllHalos) first.
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
                    litHalo(element, color);
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

// The feedback layer. A note is lit "played", "wrong", "now sounding" or "heard" by a
// translucent rounded rect placed behind its notehead — never by recolouring the
// notehead itself, which the pitch-colour reading aid owns and which must keep its shape
// (a hollow half-note must not fill in). One halo per notehead, tracked in a WeakMap so
// it can be recoloured or lifted; the halos vanish with the SVG on the next render, and a
// halo the bulk clear detached reads as absent through its `isConnected` check.
const halos = new WeakMap<Element, SVGRectElement>();
const HALO_CLASS = "plinky-note-halo";
const HALO_PAD = 3;
const SVG_NS = "http://www.w3.org/2000/svg";

// The colour of a notehead's live halo, or null when it has none — lets the trail decide
// whether a note already wears a persistent mark to keep, without touching the notehead.
export function haloColor(element: SVGElement): string | null {
    const halo = halos.get(element);
    return halo?.isConnected ? halo.getAttribute("fill") : null;
}

// Light a notehead by placing (or recolouring) a halo behind it. The halo sits at the
// back of the SVG so the notehead, stem and beam always draw over it.
export function litHalo(element: SVGElement, color: string): void {
    const svg = element.ownerSVGElement;
    if (!svg) {
        return;
    }
    const { rect: svgRect, sx, sy } = svgScale(svg);
    const box = element.getBoundingClientRect();
    let halo = halos.get(element);
    if (!halo?.isConnected) {
        halo = document.createElementNS(SVG_NS, "rect");
        halo.setAttribute("class", HALO_CLASS);
        halo.setAttribute("rx", "3");
        halo.setAttribute("pointer-events", "none");
        halos.set(element, halo);
    }
    halo.setAttribute("x", String((box.left - svgRect.left) * sx - HALO_PAD));
    halo.setAttribute("y", String((box.top - svgRect.top) * sy - HALO_PAD));
    halo.setAttribute("width", String(box.width * sx + HALO_PAD * 2));
    halo.setAttribute("height", String(box.height * sy + HALO_PAD * 2));
    halo.setAttribute("fill", color);
    halo.setAttribute("fill-opacity", "0.4");
    svg.insertBefore(halo, svg.firstChild);
}

// Lift a notehead's halo, if it has one.
export function clearHalo(element: SVGElement): void {
    const halo = halos.get(element);
    if (halo) {
        halo.remove();
        halos.delete(element);
    }
}

// Lift every note halo on a score — the reset the focus strip does before lighting the
// current bar. Stale WeakMap entries self-heal through the isConnected check.
export function clearAllHalos(svg: SVGSVGElement): void {
    for (const halo of svg.querySelectorAll(`.${HALO_CLASS}`)) {
        halo.remove();
    }
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

// The fingering-difficulty heat-map: a translucent red wash behind each bar whose
// opacity follows its 0..1 heat, so the hard passages size themselves at a glance.
// Its own class, so it coexists with (and clears independently of) the loop's
// selection fill.
const HEAT_CLASS = "plinky-bar-heat";

export function clearBarHeat(svg: SVGSVGElement): void {
    for (const rect of svg.querySelectorAll(`.${HEAT_CLASS}`)) {
        rect.remove();
    }
}

export function paintBarHeat(svg: SVGSVGElement, boxes: MeasureBox[], heats: number[]): void {
    clearBarHeat(svg);
    const pad = 6;
    for (const box of boxes) {
        const heat = heats[box.measure] ?? 0;
        // Cold bars get no wash at all — the map highlights, it doesn't carpet.
        if (heat <= 0.05) {
            continue;
        }
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("class", HEAT_CLASS);
        rect.setAttribute("x", String(box.x - pad));
        rect.setAttribute("y", String(box.y - pad));
        rect.setAttribute("width", String(box.width + pad * 2));
        rect.setAttribute("height", String(box.height + pad * 2));
        rect.setAttribute("rx", "4");
        rect.setAttribute("fill", SELECT_COLOR);
        rect.setAttribute("fill-opacity", String(0.06 + heat * 0.22));
        rect.setAttribute("pointer-events", "none");
        svg.insertBefore(rect, svg.firstChild);
    }
}

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

// One notehead lifted to an "active" halo, remembering the halo colour it wore before —
// null when it wore none. The prior lets the highlight lift back to exactly what was
// there, and lets the trail decide whether the note already carried a persistent mark (a
// practised green, a heard blue) to keep rather than overwrite.
export type PaintedNote = { element: SVGElement; prior: string | null };

// Haloes the playable notes at the cursor's current position an "active" colour, and
// returns them with the halo they wore before, so the caller can restore them as the
// cursor moves on: the moving highlight that follows Listen playback. It touches only the
// halo layer, never the noteheads, so a pitch-coloured score keeps its colours as it plays.
export function highlightCursorNotes(osmd: OpenSheetMusicDisplay, color: string): PaintedNote[] {
    const painted: PaintedNote[] = [];
    // Capture every note's prior halo BEFORE lighting any of them, so a chord's noteheads
    // each record the true original colour rather than a sibling's fresh highlight.
    for (const gNote of osmd.cursor.GNotesUnderCursor()) {
        const note = gNote.sourceNote;
        if (note.isRest() || note.halfTone <= 0) {
            continue;
        }
        const element = svgOf(gNote);
        if (!element) {
            continue;
        }
        painted.push({ element, prior: haloColor(element) });
    }
    for (const { element } of painted) {
        litHalo(element, color);
    }
    return painted;
}

// Restores notes lifted by highlightCursorNotes to the halo they wore before — its prior
// mark, or none.
export function restoreNotes(painted: PaintedNote[]): void {
    for (const { element, prior } of painted) {
        if (prior === null) {
            clearHalo(element);
        } else {
            litHalo(element, prior);
        }
    }
}

// Leaves a persistent trail on notes the highlight is moving off: haloes an untouched note
// `color`, but keeps any prior mark — a practised green — so the trail records where the
// piece was heard without erasing where it was played. Used by Listen to lay its blue trail
// as the cursor advances.
export function trailNotes(painted: PaintedNote[], color: string): void {
    for (const { element, prior } of painted) {
        litHalo(element, prior ?? color);
    }
}

// Each pitched note's halo colour (or null for none) in cursor-walk order — the run's
// whole paint captured independently of the SVG. A fingering toggle re-renders the score,
// which drops every halo; snapshotting before the render and re-applying after restores the
// green cleared notes, the blue Listen trail, a red miss and any revealed hidden note in one
// pass. The fresh noteheads walk in the same order because a fingering change adds no notes.
export function snapshotNotePaint(osmd: OpenSheetMusicDisplay): (string | null)[] {
    const colors: (string | null)[] = [];
    osmd.cursor.show();
    osmd.cursor.reset();
    while (!osmd.cursor.iterator.EndReached) {
        for (const gNote of osmd.cursor.GNotesUnderCursor()) {
            const note = gNote.sourceNote;
            if (note.isRest() || note.halfTone <= 0) {
                continue;
            }
            const element = svgOf(gNote);
            colors.push(element ? haloColor(element) : null);
        }
        osmd.cursor.next();
    }
    osmd.cursor.reset();
    osmd.cursor.hide();
    return colors;
}

// Re-applies a snapshot to the freshly-rendered noteheads, walking them in the same order.
// Returns whether any note wore a mark, so the caller can keep the score's painted flag.
export function restoreNotePaint(osmd: OpenSheetMusicDisplay, colors: (string | null)[]): boolean {
    let index = 0;
    let painted = false;
    osmd.cursor.show();
    osmd.cursor.reset();
    while (!osmd.cursor.iterator.EndReached) {
        for (const gNote of osmd.cursor.GNotesUnderCursor()) {
            const note = gNote.sourceNote;
            if (note.isRest() || note.halfTone <= 0) {
                continue;
            }
            const color = colors[index++];
            if (color == null) {
                continue;
            }
            const element = svgOf(gNote);
            if (element) {
                litHalo(element, color);
                painted = true;
            }
        }
        osmd.cursor.next();
    }
    osmd.cursor.reset();
    osmd.cursor.hide();
    return painted;
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

// Haloes the noteheads at the cursor's current position whose pitch was just played,
// leaving a persistent mark of progress. It lights the halo layer directly rather than
// re-rendering, which would flicker and lose the cursor every note, and never touches the
// notehead, so a pitch-coloured note keeps its colour under the mark. A note with no
// rendered element yet is skipped.
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
            litHalo(element, color);
        }
    }
}
