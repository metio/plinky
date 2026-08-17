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
//
// It asks again every time the sheet is re-engraved, because a piece in another key is a
// different set of recordings — a transposed passage needs the notes it now sounds, not the
// ones it was printed with. The trigger is the counter the score hook raises when a render
// completes, rather than `ready`: a reload quick enough to set that false and true again
// inside one commit leaves the dependency list unchanged, and then nothing is ever fetched
// for the new key. That is not hypothetical — it is what Firefox does, and it left every
// transposed note falling back to the synthesised voice while Chromium sounded recorded.
export function useSamplePrefetch({
    getOsmd,
    ready,
    renderVersion,
}: {
    getOsmd: () => OpenSheetMusicDisplay | null;
    ready: boolean;
    // Raised by the score hook once a render has finished; see useOsmdScore.
    renderVersion: number;
}) {
    const samples = useSampleSource();
    // renderVersion is not read in the body — it is the trigger, standing for "the sheet on
    // screen changed".
    // biome-ignore lint/correctness/useExhaustiveDependencies: renderVersion is the render-completed trigger
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
    }, [getOsmd, ready, renderVersion, samples]);
}
