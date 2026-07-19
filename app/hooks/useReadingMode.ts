// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type Dispatch, type SetStateAction, useState } from "react";
import type { Beams } from "../../core/beams";
import { usePrefsStore } from "../contexts/services";
import { usePref } from "./usePref";

// How the score is laid out and read — the toggles that feed the OSMD render: bars per
// row, staff-row numbering, the treadmill (one horizontal scrolling line), the on-staff
// fingering numbers, and follow-the-note scrolling. The layout ones persist per device;
// the two in-play toggles (fingering, follow) are session-only, so a run can flip them
// without changing the saved default.
export type ReadingMode = {
    // Bars forced onto each staff row (0 = fit to width), remembered per device.
    barsPerRow: number;
    setBarsPerRow: (value: number) => void;
    // The score's magnification (1 = normal), remembered per device.
    noteScale: number;
    setNoteScale: (value: number) => void;
    // Number the first bar of each staff row, remembered per device.
    barNumbers: boolean;
    setBarNumbers: (value: boolean) => void;
    // Render the piece as one horizontal line that scrolls under a fixed gaze, remembered
    // per device.
    treadmill: boolean;
    setTreadmill: (value: boolean) => void;
    // Show the upcoming notes as blocks above the keys (the notes highway), remembered
    // per device.
    highway: boolean;
    setHighway: (value: boolean) => void;
    // Whether fast notes are joined into beam groups: "auto" follows the piece's grade,
    // "on"/"off" force it. Remembered per device; the effective visibility is decided
    // per piece by beamsVisible.
    beams: Beams;
    setBeams: (value: Beams) => void;
    // Colour the noteheads by note name (the Boomwhacker reading aid), remembered per device.
    colorNotes: boolean;
    setColorNotes: (value: boolean) => void;
    // Print the suggested fingering numbers on the staff. Seeded from the saved default,
    // flipped live in-play; the setter takes a functional update for the toggle button.
    showFingerings: boolean;
    setShowFingerings: Dispatch<SetStateAction<boolean>>;
    // Whether the staff scrolls to keep the played note in view. On by default; the
    // treadmill drives its own centring, so OSMD's follow is off there.
    scrollFollow: boolean;
    setScrollFollow: Dispatch<SetStateAction<boolean>>;
};

export function useReadingMode(): ReadingMode {
    const prefs = usePrefsStore();
    const [barsPerRow, setBarsPerRow] = usePref(prefs, "barsPerRow");
    const [noteScale, setNoteScale] = usePref(prefs, "noteScale");
    const [barNumbers, setBarNumbers] = usePref(prefs, "barNumbers");
    const [treadmill, setTreadmill] = usePref(prefs, "treadmill");
    const [highway, setHighway] = usePref(prefs, "highway");
    const [beams, setBeams] = usePref(prefs, "beams");
    const [colorNotes, setColorNotes] = usePref(prefs, "colorNotes");
    // The fingering numbers are always baked into the loaded sheet; this only flips whether
    // OSMD draws them, so it stays session state rather than a persisted preference.
    const [showFingerings, setShowFingerings] = useState(() => prefs.load().showFingerings);
    const [scrollFollow, setScrollFollow] = useState(true);

    return {
        barsPerRow,
        setBarsPerRow,
        noteScale,
        setNoteScale,
        barNumbers,
        setBarNumbers,
        treadmill,
        setTreadmill,
        highway,
        setHighway,
        beams,
        setBeams,
        colorNotes,
        setColorNotes,
        showFingerings,
        setShowFingerings,
        scrollFollow,
        setScrollFollow,
    };
}
