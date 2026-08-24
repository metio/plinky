// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLatest } from "./useLatest";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useCallback, useRef } from "react";
import type { Hand } from "../../core/matcher";
import { vanishedSteps } from "../../core/sightRead";
import {
    collectStepNotes,
    hideNoteElements,
    type StepNotes,
    unhideNoteElements,
} from "../lib/scoreColor";

// The sight-reading read-ahead drill: bars disappear once the run has left them, so
// the eyes have nowhere to go but forward. Looking back at what you just fumbled is
// the habit that keeps a reader behind the music, and the only reliable cure is for
// there to be nothing there.
//
// The inverse of useHiddenNotes — which blanks everything and reveals as you go —
// and it shares that hook's machinery: the same step order the matcher walks, the
// same visibility attribute (so spacing and the cursor are untouched), and the same
// obligation never to leave invisible music behind.
export function useVanishingBars(
    getOsmd: () => OpenSheetMusicDisplay | null,
    options: { enabled: boolean; hand: Hand },
) {
    const stepsRef = useRef<StepNotes[]>([]);
    // Each step's bar, lifted out once. Rebuilding it per note would allocate an
    // array the length of the piece inside the callback that clears a note — the
    // same moment the synth is being asked to sound one.
    const measuresRef = useRef<number[]>([]);
    // The bar the run was in when bars last vanished. While it has not changed there
    // is nothing new to hide, which is true of every note in a bar but its first.
    const lastMeasureRef = useRef<number | null>(null);
    const activeRef = useRef(false);
    // Which step indices are currently hidden, so a re-render that rebuilds the
    // noteheads can restore exactly the same vanished bars rather than bringing the
    // whole piece back into view mid-run.
    const goneRef = useRef<Set<number>>(new Set());
    const optionsRef = useLatest(options);

    // Take the score's step order for a fresh run. A no-op when the mode is off, so
    // call sites don't branch. Collecting walks (and resets) the cursor, so this runs
    // before the matcher seeks the cursor to the run's first note.
    const arm = useCallback(() => {
        const osmd = getOsmd();
        // Already armed means a run in progress (a Practice run resuming after a
        // Listen handoff): re-arming would bring the vanished bars back.
        if (!optionsRef.current.enabled || !osmd || activeRef.current) {
            return;
        }
        stepsRef.current = collectStepNotes(osmd, optionsRef.current.hand);
        measuresRef.current = stepsRef.current.map((step) => step.measure);
        goneRef.current.clear();
        lastMeasureRef.current = null;
        activeRef.current = true;
    }, [getOsmd]);

    // Hide whatever the just-cleared step leaves behind. Only the newly vanished are
    // touched, so a step already hidden is not re-hidden on every note.
    const advance = useCallback((clearedIndex: number) => {
        if (!activeRef.current) {
            return;
        }
        // Bars vanish when the run leaves one, so only the first note of a bar can
        // change anything. Every other note returns here without touching the DOM.
        const measure = measuresRef.current[clearedIndex];
        if (measure === undefined || measure === lastMeasureRef.current) {
            return;
        }
        lastMeasureRef.current = measure;
        for (const index of vanishedSteps(measuresRef.current, clearedIndex)) {
            if (goneRef.current.has(index)) {
                continue;
            }
            goneRef.current.add(index);
            hideNoteElements([stepsRef.current[index]?.elements ?? []]);
        }
    }, []);

    // Re-apply after the score's noteheads were rebuilt (an in-place render, e.g.
    // toggling the printed fingering mid-run): the old elements are detached, so
    // re-collect the fresh ones and hide exactly the bars already left behind.
    const rearm = useCallback(() => {
        const osmd = getOsmd();
        if (!activeRef.current || !osmd) {
            return;
        }
        stepsRef.current = collectStepNotes(osmd, optionsRef.current.hand);
        measuresRef.current = stepsRef.current.map((step) => step.measure);
        for (const index of goneRef.current) {
            hideNoteElements([stepsRef.current[index]?.elements ?? []]);
        }
    }, [getOsmd]);

    // Bring the piece back — leaving the mode, ending the run, or unmounting must
    // never strand invisible music on the staff.
    const restore = useCallback(() => {
        if (activeRef.current) {
            unhideNoteElements(stepsRef.current.map((step) => step.elements));
            stepsRef.current = [];
            measuresRef.current = [];
            goneRef.current.clear();
            lastMeasureRef.current = null;
            activeRef.current = false;
        }
    }, []);

    return { arm, advance, rearm, restore };
}
