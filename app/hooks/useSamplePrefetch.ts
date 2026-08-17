// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { performanceOf } from "../../core/scorePerformance";
import { useSampleSource } from "../contexts/services";
import { collectMatchSteps } from "./useScoreMatcher";

// Fetches the recordings this piece will ask for, while it is being read rather than while
// it is being played.
//
// This is the one thing a piano app can do that a piano cannot: the score is the complete
// list of notes, with the dynamics written on it, before a single key goes down. So there
// is no guessing about which part of the keyboard somebody is heading for and no fetching a
// note at a time behind the hands — the piece names its own recordings, and measured over
// the catalogue that is three of them for a first study and two dozen for a grade 8.
//
// Nothing waits on it. A recording that has not arrived is a note the synthesised voice
// plays, so the worst case for a slow connection is the instrument Plinky always had.
export function useSamplePrefetch(getOsmd: () => OpenSheetMusicDisplay | null, ready: boolean) {
    const samples = useSampleSource();
    useEffect(() => {
        const osmd = getOsmd();
        if (!ready || !osmd || !samples.state().enabled) {
            return;
        }
        // The written performance, dynamics and all — the same reading the video export
        // plays from, so what is fetched is what will sound. Which recordings that means is
        // the source's question: it holds the manifest, and waiting for one here is what
        // made this never run at all.
        void samples.prepare(performanceOf(collectMatchSteps(osmd, "both")));
    }, [getOsmd, ready, samples]);
}
