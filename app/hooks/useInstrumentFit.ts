// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef, useState } from "react";
import {
    FITS,
    fitToInstrument,
    type InstrumentRange,
    type RangeFit,
} from "../../core/instrumentRange";

// Moves a piece into the octave the player's instrument can actually reach.
//
// The move is a transposition by whole octaves, and Plinky already has transposition —
// the control, the reset, the re-engraving, the grading against the sounding pitch. So
// this sets that value rather than inventing a parallel one: the piece really is being
// played twelve semitones down, the notation says so, and "Reset to the written key" is
// already the way back.
//
// The range it works from is the one the play surface already reads off the engraving to
// frame the keyboard, rather than a second walk of the same cursor: only the engraving
// knows what a repeat, a multi-part score or a hand mapping actually sounds, and walking
// it twice in one commit is two readers moving one cursor. That range arrives carrying
// whatever shift is already applied, so the piece as written is what is on the screen
// less what we put there.
//
// It fits once per piece per instrument. A player who then transposes by hand keeps their
// key, because the pair has not changed; plugging in a different keyboard, or opening a
// different piece, is a new pair and is fitted again.
export function useInstrumentFit({
    sounding,
    xml,
    instrument,
    transpose,
    setTranspose,
}: {
    // What the engraving currently sounds, or null before it has been read.
    sounding: InstrumentRange | null;
    xml: string;
    instrument: InstrumentRange;
    transpose: number;
    setTranspose: (semitones: number) => void;
}): RangeFit {
    const [fit, setFit] = useState<RangeFit>(FITS);
    // The (piece, instrument) pair this has already answered for. Refs rather than state:
    // they are read and written in the pass that decides, so a second render cannot fit
    // again and overwrite a key the player has since chosen by hand.
    const fittedXml = useRef<string | null>(null);
    const fittedRange = useRef<string | null>(null);
    // Read inside the effect without being a trigger: the applied shift is this fit's own
    // output, and depending on it would re-run the fit on its own result.
    const applied = useRef(transpose);
    applied.current = transpose;

    useEffect(() => {
        // Nothing read yet is not a piece that fits — it is a piece nobody has looked at.
        // Latching here would answer for the piece on the strength of no notes at all, and
        // the answer would stand for as long as it stayed open.
        if (!sounding) {
            return;
        }
        const range = `${instrument.from}-${instrument.to}`;
        if (fittedXml.current === xml && fittedRange.current === range) {
            return;
        }
        fittedXml.current = xml;
        fittedRange.current = range;
        const shift = applied.current;
        const written = { from: sounding.from - shift, to: sounding.to - shift };
        const next = fitToInstrument(written, instrument);
        setFit(next);
        if (next.shift !== shift) {
            setTranspose(next.shift);
        }
    }, [sounding, xml, instrument, setTranspose]);

    return fit;
}
