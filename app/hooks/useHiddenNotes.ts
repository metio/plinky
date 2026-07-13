// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useCallback, useRef } from "react";
import type { Hand } from "../../core/matcher";
import { MISSED_COLOR, PLAYED_COLOR } from "../../core/scoreCanvas";
import {
    collectNoteElements,
    hideNoteElements,
    revealNoteElements,
    unhideNoteElements,
} from "../lib/scoreColor";

// Hidden-notes (ear) practice: at run start every notehead is blanked (the rhythm
// skeleton — staff, stems, rests — stays), and each position reveals itself as it
// resolves: green when found, red once the tries budget is spent. The matcher's
// whole-piece step indices address the engraved notes via collectNoteElements'
// identical step order.
export function useHiddenNotes(
    getOsmd: () => OpenSheetMusicDisplay | null,
    options: { enabled: boolean; tries: number; hand: Hand },
) {
    const stepsRef = useRef<SVGGElement[][]>([]);
    const activeRef = useRef(false);
    // Which step indices have been revealed, and in which colour (found green / missed red)
    // — so a re-render that rebuilds the noteheads can restore the exact conceal state
    // rather than leaving every blanked answer exposed.
    const revealedRef = useRef<Map<number, string>>(new Map());
    const optionsRef = useRef(options);
    optionsRef.current = options;

    // Blank the noteheads for a fresh run. A no-op when the mode is off, so the
    // call sites don't branch. Collecting walks (and resets) the cursor, so this
    // runs before the matcher seeks the cursor to the run's first note.
    const conceal = useCallback(() => {
        const osmd = getOsmd();
        // Already concealed means a session in progress (a Practice run resuming
        // after a Listen handoff): re-hiding would blank the notes already
        // revealed, erasing the run's story so far.
        if (!optionsRef.current.enabled || !osmd || activeRef.current) {
            return;
        }
        stepsRef.current = collectNoteElements(osmd, optionsRef.current.hand);
        revealedRef.current.clear();
        hideNoteElements(stepsRef.current);
        activeRef.current = true;
    }, [getOsmd]);

    const revealCorrect = useCallback((index: number) => {
        if (activeRef.current) {
            revealedRef.current.set(index, PLAYED_COLOR);
            revealNoteElements(stepsRef.current[index] ?? [], PLAYED_COLOR);
        }
    }, []);

    const revealMissed = useCallback((index: number, misses: number) => {
        if (activeRef.current && misses >= optionsRef.current.tries) {
            revealedRef.current.set(index, MISSED_COLOR);
            revealNoteElements(stepsRef.current[index] ?? [], MISSED_COLOR);
        }
    }, []);

    // Re-apply the conceal after the score's noteheads were rebuilt (an in-place render,
    // e.g. toggling the printed fingering mid-run): the old elements are detached, so
    // re-collect the fresh ones, blank them all, then re-reveal exactly the steps already
    // earned in their colour. Without this a mid-run render would expose every hidden answer.
    const reconceal = useCallback(() => {
        const osmd = getOsmd();
        if (!activeRef.current || !osmd) {
            return;
        }
        stepsRef.current = collectNoteElements(osmd, optionsRef.current.hand);
        hideNoteElements(stepsRef.current);
        for (const [index, color] of revealedRef.current) {
            revealNoteElements(stepsRef.current[index] ?? [], color);
        }
    }, [getOsmd]);

    // Lift every blank — leaving the mode, ending the run, or unmounting must
    // never strand invisible music on the staff.
    const restore = useCallback(() => {
        if (activeRef.current) {
            unhideNoteElements(stepsRef.current);
            stepsRef.current = [];
            revealedRef.current.clear();
            activeRef.current = false;
        }
    }, []);

    return { conceal, revealCorrect, revealMissed, reconceal, restore };
}
