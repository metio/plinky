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
        hideNoteElements(stepsRef.current);
        activeRef.current = true;
    }, [getOsmd]);

    const revealCorrect = useCallback((index: number) => {
        if (activeRef.current) {
            revealNoteElements(stepsRef.current[index] ?? [], PLAYED_COLOR);
        }
    }, []);

    const revealMissed = useCallback((index: number, misses: number) => {
        if (activeRef.current && misses >= optionsRef.current.tries) {
            revealNoteElements(stepsRef.current[index] ?? [], MISSED_COLOR);
        }
    }, []);

    // Lift every blank — leaving the mode, ending the run, or unmounting must
    // never strand invisible music on the staff.
    const restore = useCallback(() => {
        if (activeRef.current) {
            unhideNoteElements(stepsRef.current);
            stepsRef.current = [];
            activeRef.current = false;
        }
    }, []);

    return { conceal, revealCorrect, revealMissed, restore };
}
