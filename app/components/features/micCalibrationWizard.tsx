// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useState } from "react";
import {
    beginCalibration,
    type CalibrationSample,
    type CalibrationStep,
    deriveCalibration,
    heardNote,
    nextStep,
    observe,
    stepProgress,
    stepReady,
} from "../../../core/micCalibration";
import { noteName } from "../../../core/midi";
import { useMidiConnection } from "../../contexts/midi";
import { usePrefs } from "../../hooks/usePrefs";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";

// A guided setup that tunes the pitch detector to the player's own room, piano
// and microphone: it asks for quiet, then for a named note, then for a soft and
// a firm strike, and folds what it hears into a saved calibration. Each step
// fills on its own and hands off after a beat, so the player just follows along.
// The heavy lifting is the pure state machine in core/micCalibration; this drives
// it off the microphone and paints where the run is.

// Middle C — the anchor for the octave check. Named on screen so a beginner
// knows exactly which key to strike.
const TARGET_NOTE = 60;

// The measuring steps in order (everything before `done`), for the "Step 2 of 4"
// counter and the per-step copy.
const STEPS: CalibrationStep[] = ["quiet", "note", "soft", "loud"];

// A satisfied step lingers briefly so its "got it" reads before the next begins.
const DWELL_MS = 800;

const STEP_MESSAGE: Record<CalibrationStep, () => string> = {
    quiet: m.mic_calibrate_quiet,
    note: m.mic_calibrate_note,
    soft: m.mic_calibrate_soft,
    loud: m.mic_calibrate_loud,
    done: m.mic_calibrate_done,
};

export function MicCalibrationWizard() {
    const { micStatus, startCalibration, stopMic } = useMidiConnection();
    const { prefs, update } = usePrefs();
    const [open, setOpen] = useState(false);
    const [state, setState] = useState(() => beginCalibration(TARGET_NOTE));
    const [saved, setSaved] = useState(false);

    // Every heard frame folds into the current step; a functional update keeps it
    // correct however fast the frames arrive.
    const onSample = useCallback(
        (sample: CalibrationSample) => setState((current) => observe(current, sample)),
        [],
    );

    const begin = () => {
        setState(beginCalibration(TARGET_NOTE));
        setSaved(false);
        setOpen(true);
        startCalibration(onSample);
    };

    const close = useCallback(() => {
        stopMic();
        setOpen(false);
    }, [stopMic]);

    // Release the microphone if the panel unmounts mid-run (navigating away).
    useEffect(() => () => stopMic(), [stopMic]);

    // Hand off to the next step once the current one has heard enough, after a
    // short dwell so the confirmation is visible.
    const ready = open && stepReady(state);
    useEffect(() => {
        if (!ready) {
            return;
        }
        const id = window.setTimeout(() => setState((current) => nextStep(current)), DWELL_MS);
        return () => window.clearTimeout(id);
        // `ready` alone drives this: it dips to false at every step change (the new
        // step's collector starts empty), so a fresh step always re-arms the dwell.
    }, [ready]);

    // At the end, derive and persist the calibration once, then release the mic.
    useEffect(() => {
        if (open && state.step === "done" && !saved) {
            update({ micCalibration: deriveCalibration(state) });
            stopMic();
            setSaved(true);
        }
    }, [open, state, saved, update, stopMic]);

    const calibrated = prefs.micCalibration !== null;

    if (!open) {
        return (
            <div className="space-y-2">
                <Button variant={calibrated ? "secondary" : "primary"} onClick={begin}>
                    {calibrated ? m.mic_calibrate_redo() : m.mic_calibrate_start()}
                </Button>
                {calibrated && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {m.mic_calibrate_saved()}
                    </p>
                )}
            </div>
        );
    }

    const failed = micStatus === "denied" || micStatus === "error";
    const done = state.step === "done";
    const stepIndex = STEPS.indexOf(state.step);
    const heard = heardNote(state);

    return (
        <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
            {failed ? (
                <div className="space-y-3">
                    <p className="text-sm text-gray-700 dark:text-gray-200" role="status">
                        {micStatus === "denied" ? m.mic_denied() : m.mic_error()}
                    </p>
                    <Button variant="secondary" onClick={close}>
                        {m.mic_calibrate_cancel()}
                    </Button>
                </div>
            ) : done ? (
                <div className="space-y-3 text-center">
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                        {m.mic_calibrate_done()}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {m.mic_calibrate_saved()}
                    </p>
                    <Button variant="primary" onClick={close}>
                        {m.mic_calibrate_finish()}
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                        {m.mic_calibrate_step({ current: stepIndex + 1, total: STEPS.length })}
                    </p>
                    <p
                        className="text-base text-gray-900 dark:text-gray-50"
                        role="status"
                        aria-live="polite"
                    >
                        {STEP_MESSAGE[state.step]()}
                    </p>
                    {state.step === "note" && (
                        <div className="flex items-center gap-3">
                            <span className="rounded-md bg-white px-3 py-1.5 font-mono text-lg font-semibold text-indigo-800 shadow-sm dark:bg-gray-900 dark:text-indigo-200">
                                {noteName(TARGET_NOTE)}
                            </span>
                            {heard !== null && (
                                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                                    {m.mic_calibrate_heard()}
                                </span>
                            )}
                        </div>
                    )}
                    <div
                        className="h-2 overflow-hidden rounded-full bg-indigo-200 dark:bg-indigo-900"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(stepProgress(state) * 100)}
                    >
                        <div
                            className="h-full rounded-full bg-indigo-600 transition-[width] dark:bg-indigo-400"
                            style={{ width: `${Math.round(stepProgress(state) * 100)}%` }}
                        />
                    </div>
                    <Button variant="ghost" onClick={close}>
                        {m.mic_calibrate_cancel()}
                    </Button>
                </div>
            )}
        </div>
    );
}
