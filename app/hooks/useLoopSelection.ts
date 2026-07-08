// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import {
    type Dispatch,
    type RefObject,
    type SetStateAction,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { type MeasureBox, measureAtPoint } from "../../core/scoreCanvas";
import { clearBarSelection, clientPointToSvg, paintBarSelection } from "../lib/scoreColor";

// Section looping: Listen repeats a bar range over and over so a hard passage can be
// drilled. The range is 1-based for the player (the cursor walks it 0-based, hence the
// offsets here). It's held apart from the score render: the red overlay is repainted onto
// each fresh SVG, and a click on the score builds the range. Bars survive a relayout —
// only a genuinely new piece reseeds them (the caller drives that through reseedWholeSong).
export type LoopSelection = {
    on: boolean;
    from: number;
    to: number;
    // The raw range setters, so the range bar's number inputs can nudge one end relative
    // to the other with a functional update.
    setFrom: Dispatch<SetStateAction<number>>;
    setTo: Dispatch<SetStateAction<number>>;
    // The live range, read by the listening transport during playback so the loop reacts
    // to a change of range without restarting the cursor loop. Stable across renders.
    read: () => { on: boolean; from: number; to: number };
    // Turn the loop on or off; turning it on repeats the whole piece by default, so
    // narrowing to a passage (click two bars) stays optional.
    toggle: (next: boolean) => void;
    // Reset the range to the whole piece, leaving the loop on.
    wholeSong: () => void;
    // Arm the next click as a genuine selection: called on a real pointer press on the
    // score, so a compatibility click that carries no press (see selectBarAt) is ignored.
    arm: () => void;
    // Click a bar to build the range: the first click drops the anchor (a one-bar loop),
    // the next extends to the far end. A no-op while a run or playback owns the score.
    selectBarAt: (clientX: number, clientY: number) => void;
    // Drop any in-progress click selection — a relayout invalidates the anchor's bar.
    cancelSelection: () => void;
    // Seed the range to the whole piece with the loop off — for a genuinely new piece.
    reseedWholeSong: (bars: number) => void;
};

export function useLoopSelection({
    containerRef,
    measureBoxes,
    measureCount,
    renderVersion,
    canSelect,
}: {
    containerRef: RefObject<HTMLDivElement | null>;
    // Each bar's rendered box, for placing the overlay and mapping a click to a bar.
    measureBoxes: () => MeasureBox[];
    // The number of bars, the upper bound for the whole-song range.
    measureCount: number;
    // Bumped after every render; the overlay lives on OSMD's SVG, which a render replaces,
    // so the loop must repaint whenever this changes.
    renderVersion: number;
    // Whether a click may build the range now — false while a run or playback owns the
    // score. Read at click time, so it may close over transports created after this hook.
    canSelect: () => boolean;
}): LoopSelection {
    const [on, setOn] = useState(false);
    const [from, setFrom] = useState(1);
    const [to, setTo] = useState(1);
    const loopRef = useRef({ on: false, from: 1, to: 1 });
    loopRef.current = { on, from, to };
    // The first bar of an in-progress click selection; the next click sets the far end.
    const anchorRef = useRef<number | null>(null);
    // Set by a real pointer press on the score, cleared as the ensuing click is consumed.
    // A browser's compatibility click — the one that retargets onto the score when the
    // on-screen keyboard unmounts at a run's end — carries no such press, so it finds this
    // false and builds no loop.
    const armedRef = useRef(false);
    const canSelectRef = useRef(canSelect);
    canSelectRef.current = canSelect;

    const read = useCallback(() => loopRef.current, []);
    const arm = useCallback(() => {
        armedRef.current = true;
    }, []);
    const cancelSelection = useCallback(() => {
        anchorRef.current = null;
    }, []);
    const reseedWholeSong = useCallback((bars: number) => {
        setFrom(1);
        setTo(bars);
        setOn(false);
    }, []);
    const wholeSong = useCallback(() => {
        anchorRef.current = null;
        setFrom(1);
        setTo(measureCount);
    }, [measureCount]);
    const toggle = useCallback(
        (next: boolean) => {
            anchorRef.current = null;
            if (next) {
                setFrom(1);
                setTo(measureCount);
            }
            setOn(next);
        },
        [measureCount],
    );

    // Fill the selected bars with the red overlay, or clear it when the loop is off,
    // reading the live range from the ref so the callback stays stable.
    const paint = useCallback(() => {
        const svg = containerRef.current?.querySelector("svg");
        if (!(svg instanceof SVGSVGElement)) {
            return;
        }
        if (loopRef.current.on) {
            paintBarSelection(
                svg,
                measureBoxes(),
                loopRef.current.from - 1,
                loopRef.current.to - 1,
            );
        } else {
            clearBarSelection(svg);
        }
    }, [containerRef, measureBoxes]);

    const selectBarAt = useCallback(
        (clientX: number, clientY: number) => {
            // Only a click backed by a genuine pointer press on the score counts; a
            // press-less compatibility click is dropped here rather than building a loop.
            if (!armedRef.current) {
                return;
            }
            armedRef.current = false;
            if (!canSelectRef.current()) {
                return;
            }
            const svg = containerRef.current?.querySelector("svg");
            if (!(svg instanceof SVGSVGElement) || measureBoxes().length === 0) {
                return;
            }
            const point = clientPointToSvg(svg, clientX, clientY);
            const measure = measureAtPoint(measureBoxes(), point.x, point.y);
            if (measure === null) {
                return;
            }
            const bar = measure + 1;
            if (anchorRef.current === null) {
                anchorRef.current = bar;
                setOn(true);
                setFrom(bar);
                setTo(bar);
            } else {
                setFrom(Math.min(anchorRef.current, bar));
                setTo(Math.max(anchorRef.current, bar));
                anchorRef.current = null;
            }
        },
        [containerRef, measureBoxes],
    );

    // Keep the overlay in step with the range and each fresh render.
    // biome-ignore lint/correctness/useExhaustiveDependencies: the range and renderVersion are re-paint triggers, not inputs
    useEffect(() => {
        paint();
    }, [on, from, to, renderVersion, paint]);

    return {
        on,
        from,
        to,
        setFrom,
        setTo,
        read,
        toggle,
        wholeSong,
        arm,
        selectBarAt,
        cancelSelection,
        reseedWholeSong,
    };
}
