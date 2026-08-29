// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Reduction } from "../../core/reduction";
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
    // Engrave the parts besides the piano — a song's vocal line, a chamber partner.
    // Off by default, remembered per device; when off those parts are dropped from the
    // sheet before it loads, so the score is a plain grand staff throughout.
    showAccompaniment: boolean;
    setShowAccompaniment: (value: boolean) => void;
    // How much of each piece to leave on the page, remembered per device: "" for every note
    // as written, or a reduction from core/simplify. Applied to the sheet before it loads,
    // so the staff, the cursor and the matcher all see the same thinner piece.
    reduction: "" | Reduction;
    setReduction: (value: "" | Reduction) => void;
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
    const [barsPerRow, setBarsPerRow] = usePref("barsPerRow");
    const [noteScale, setNoteScale] = usePref("noteScale");
    const [barNumbers, setBarNumbers] = usePref("barNumbers");
    const [treadmill, setTreadmill] = usePref("treadmill");
    const [highway, setHighway] = usePref("highway");
    const [beams, setBeams] = usePref("beams");
    const [showAccompaniment, setShowAccompaniment] = usePref("showAccompaniment");
    const [reduction, setReduction] = usePref("reduction");
    const [colorNotes, setColorNotes] = usePref("colorNotes");
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
        showAccompaniment,
        setShowAccompaniment,
        reduction,
        setReduction,
        colorNotes,
        setColorNotes,
        showFingerings,
        setShowFingerings,
        scrollFollow,
        setScrollFollow,
    };
}
