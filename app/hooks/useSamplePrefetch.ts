// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useRef } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { ScoreMarks } from "../../core/musicxmlMarks";
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
// IT IS CALLED WHEN A RENDER FINISHES, not by an effect watching for one. That distinction
// is the whole reliability of it. A piece in another key is a different set of recordings —
// a transposed passage needs the notes it now sounds, not the ones it was printed with — so
// this has to run again on every re-engraving. Watching for that with an effect over
// `ready` and a render counter means observing a state TRANSITION, and an observer that
// checks a condition and returns early has thrown the transition away: the counter does not
// rise again until the next render, so that engraving is never fetched for at all. It has
// gone wrong twice that way. A reload quick enough to set `ready` false and true again
// inside one commit left the dependency list unchanged, which is what Firefox does and
// which the counter was added to fix; and the counter can itself land on a commit where
// `ready` is false, which puts the hole straight back.
//
// Being told cannot miss. The score hook already announces a finished render — the same
// callback that reseeds the hand and the loop — and an announcement is delivered once,
// whatever the surrounding state happens to be.
export function useSamplePrefetch({
    getOsmd,
    marks,
}: {
    getOsmd: () => OpenSheetMusicDisplay | null;
    // The score's own markings — the dynamics above all. Without them every note costs the
    // even velocity, one recording layer is fetched, and a piece marked piano is played by
    // the synthesised voice while the panel says the recordings are ready.
    marks: ScoreMarks;
}) {
    const samples = useSampleSource();
    // Read at call time through a ref: the callback is held in a ref by its caller and
    // must keep its identity, while the marks change with every piece.
    const marksRef = useRef(marks);
    marksRef.current = marks;
    return useCallback(() => {
        const osmd = getOsmd();
        if (!osmd || !samples.state().enabled) {
            return;
        }
        // The written performance, dynamics and all — the same reading the video export
        // plays from, so what is fetched is what will sound. Which recordings that means is
        // the source's question: it holds the manifest, and waiting for one here is what
        // made this never run at all.
        void samples.prepare(performanceOf(collectMatchSteps(osmd, "both", marksRef.current)));
    }, [getOsmd, samples]);
}
