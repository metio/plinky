// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AidPrefs } from "../../core/readingLevel";
import {
    DEFAULT_STUDY_SECONDS,
    sightReadAids,
    type StudySeconds,
    studyRemaining,
} from "../../core/sightRead";
import { useScheduler } from "../contexts/services";

// Sight-read mode's session state: whether the mode is on, how long the score can be
// studied first, whether bars vanish behind the run, and the countdown itself.
//
// Session state rather than a saved preference — like keep-up and the duet. Sight
// reading is something you decide to do to a particular piece today, and a mode that
// silently persisted would strip a beginner's aids on their next visit with no
// explanation.
export type SightRead = {
    on: boolean;
    setOn: (on: boolean) => void;
    studySeconds: StudySeconds;
    setStudySeconds: (seconds: StudySeconds) => void;
    vanish: boolean;
    setVanish: (vanish: boolean) => void;
    // Seconds left to study, or null when no countdown is running.
    countdown: number | null;
    // Start the study countdown, resolving once it runs out. Resolves immediately
    // when the mode is off, so a caller can await it before every run without
    // branching. A cancelled countdown never resolves — the run it belonged to is
    // gone, and resolving would start a run nobody asked for.
    study: () => Promise<void>;
    // Abandon a countdown in progress — leaving the mode, or stopping the run.
    cancel: () => void;
    // The aids a run reads with: the sight-reader rung while the mode is on, the
    // player's own settings otherwise.
    aids: AidPrefs;
};

const TICK_MS = 200;

export function useSightRead(saved: AidPrefs): SightRead {
    const scheduler = useScheduler();
    const [on, setOn] = useState(false);
    const [studySeconds, setStudySeconds] = useState<StudySeconds>(DEFAULT_STUDY_SECONDS);
    const [vanish, setVanish] = useState(true);
    const [countdown, setCountdown] = useState<number | null>(null);
    // The ticking handle, so a cancel can stop it, and a generation counter so a
    // tick already in flight cannot resolve a study that no longer applies.
    const tickRef = useRef<number | null>(null);
    const runRef = useRef(0);

    // Stop the count and take it off screen. Both the caller cancelling and the count
    // reaching zero end the same way; a copy of this that forgot to null the handle would
    // leave a cancelled timer looking live.
    const stopTicking = useCallback(() => {
        if (tickRef.current !== null) {
            scheduler.cancel(tickRef.current);
            tickRef.current = null;
        }
        setCountdown(null);
    }, [scheduler]);

    const cancel = useCallback(() => {
        runRef.current++;
        stopTicking();
    }, [stopTicking]);

    // Leaving the mode, or unmounting mid-countdown, must not strand a countdown on
    // screen or leave a timer running against a gone component.
    useEffect(() => {
        if (!on) {
            cancel();
        }
    }, [on, cancel]);
    useEffect(() => cancel, [cancel]);

    const study = useCallback(() => {
        if (!on || studySeconds <= 0) {
            return Promise.resolve();
        }
        const mine = ++runRef.current;
        const startedAt = scheduler.now();
        setCountdown(studySeconds);
        return new Promise<void>((resolve) => {
            tickRef.current = scheduler.every(TICK_MS, () => {
                if (mine !== runRef.current) {
                    return;
                }
                const left = studyRemaining(scheduler.now() - startedAt, studySeconds);
                setCountdown(left);
                if (left <= 0) {
                    stopTicking();
                    resolve();
                }
            });
        });
    }, [on, studySeconds, scheduler, stopTicking]);

    // The aids in force, one object for as long as the mode and the saved aids hold — a
    // fresh one per render was what kept the play session's setup context from holding.
    const aids = useMemo(() => (on ? sightReadAids() : saved), [on, saved]);
    return useMemo(
        () => ({
            on,
            setOn,
            studySeconds,
            setStudySeconds,
            vanish,
            setVanish,
            countdown,
            study,
            cancel,
            aids,
        }),
        [on, studySeconds, vanish, countdown, study, cancel, aids],
    );
}
